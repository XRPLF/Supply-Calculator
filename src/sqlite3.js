const log = require('debug')('xrplstats:sqlite3')
const assert = require('assert')
const sqlite3 = require('sqlite3').verbose()
const sqlite = require('sqlite')

let db
let ledger
let mode

const open = async (ledgerIndex, getLedgerInfo) => {
  assert(Number(ledgerIndex) > 32570, 'Invalid ledger index')

  ledger = ledgerIndex

  mode = getLedgerInfo
    ? sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
    : sqlite3.OPEN_READWRITE

  const filename = './output/' + ledgerIndex + '.sqlite'
  db = await sqlite.open({
    filename,
    driver: sqlite3.cached.Database,
    mode
  })
  log('Connected to database', {filename})

  if (getLedgerInfo) {
    /**
     * Passed from index, fetch data
     */
    const ledgerInfo = await getLedgerInfo(ledgerIndex)
    log('Got ledger human close time (from XRPL)', ledgerInfo.close_time_human)
    const ledgerFees = await getLedgerInfo(ledgerIndex, true)

    await db.run(`
      CREATE TABLE IF NOT EXISTS meta (
        ledger INTEGER PRIMARY KEY,
        closeTimeHuman TEXT,
        reserveBaseXrp INTEGER,
        reserveIncXrp INTEGER,
        coins INTEGER,
        marker TEXT
      ) WITHOUT ROWID
    `)

    await db.run(`INSERT OR IGNORE INTO meta (ledger, closeTimeHuman, reserveBaseXrp, reserveIncXrp, coins) VALUES (?, ?, ?, ?, ?)`, {
      1: ledgerIndex,
      2: ledgerInfo.close_time_human,
      3: ledgerFees.reserve_base_xrp,
      4: ledgerFees.reserve_inc_xrp,
      5: Number(ledgerInfo.total_coins) / 1_000_000,
    })
    log('Created [ meta ] table & inserted meta data')

    await db.run(`
      CREATE TABLE IF NOT EXISTS objects (
        record_id INTEGER PRIMARY KEY AUTOINCREMENT,
        account TEXT,
        type TEXT,
        json BLOB
      )
    `)

    await db.run(`CREATE INDEX IF NOT EXISTS objects_account ON objects(account)`)
    await db.run(`CREATE INDEX IF NOT EXISTS objects_account_type ON objects(account, type)`)

    log('Created [ objects ] table & index')

    await db.run(`
      CREATE TABLE IF NOT EXISTS supply (
        account TEXT PRIMARY KEY,
        dropsBalanceSpendable INTEGER DEFAULT 0,
        dropsReserved INTEGER DEFAULT 0,
        dropsReservedOffers INTEGER DEFAULT 0,
        accountDropsSupply INTEGER DEFAULT 0
      ) WITHOUT ROWID
    `)

    await db.run(`CREATE INDEX IF NOT EXISTS supply_account ON supply(account)`)
    await db.run(`CREATE INDEX IF NOT EXISTS supply_account_dropsBalanceSpendable ON supply(account, dropsBalanceSpendable)`)
    await db.run(`CREATE INDEX IF NOT EXISTS supply_dropsBalanceSpendable ON supply(dropsBalanceSpendable)`)
    await db.run(`CREATE INDEX IF NOT EXISTS supply_dropsReserved ON supply(dropsReserved)`)
    await db.run(`CREATE INDEX IF NOT EXISTS supply_dropsReservedOffers ON supply(dropsReservedOffers)`)

    log('Created [ supply ] table & index')
  }

  return
}

const persistObject = async (account, type, object) => {
  await db.run(`INSERT OR IGNORE INTO objects (account, type, json) VALUES (?, ?, ?)`, {
    1: account,
    2: type,
    3: JSON.stringify(object)
  })
  // log('Stored', account, type)
}

const persistSupply = async (account, calculated, supply) => {
  await db.run(`
    UPDATE
      supply
    SET
      dropsBalanceSpendable = ?,
      dropsReserved = ?,
      dropsReservedOffers = ?,
      accountDropsSupply = ?
    WHERE
      account = ?
  `, {
    1: (calculated.xrpSpendable || 0) * 1000000,
    2: calculated.xrpReserved * 1000000,
    3: calculated.xrpReservedOffers * 1000000,
    4: supply * 1000000,
    5: account
  })
  // log('Stored', account, type)
}

const persistMarker = async marker => {
  await db.run(`UPDATE meta SET marker = ? WHERE ledger = ?`, {
    1: marker,
    2: ledger
  })
  log('Persisted marker', ledger, marker)
}

const getMarker = async verbose => {
  const marker = await db.get(`SELECT marker FROM meta WHERE ledger = ?`, {
    1: ledger
  })
  if (marker.marker) {
    if (verbose) log('Got marker', marker.marker)
  } else {
    if (verbose) log(`Start ${mode === sqlite3.OPEN_READWRITE ? 'fetching from scratch' : 'cruncing numbers'}`)
  }
  return marker.marker
}

const getStats = async () => {
  const {reserveBaseXrp, reserveIncXrp} = await db.get(`SELECT * FROM meta LIMIT 1`)
  return {
    marker: await getMarker(),
    closeTimeHuman: (await db.get(`SELECT closeTimeHuman FROM meta`)).closeTimeHuman,
    accountCount: (await db.get(`SELECT COUNT(1) accountCount FROM objects`)).accountCount,
    supplyCount: (await db.get(`SELECT COUNT(1) supplyCount FROM supply`)).supplyCount,
    toProcess: (await db.get(`SELECT COUNT(1) toProcessCount FROM supply WHERE dropsBalanceSpendable IS NULL`)).toProcessCount,
    reserveBaseXrp,
    reserveIncXrp,
    coins: (await db.get(`SELECT coins FROM meta`)).coins,
  }
}

const clearSupply = async () => {
  log('Clearing [ supply ] table')
  return await db.run(`DELETE FROM supply`)
}

const prepareSupply = async () => {
  log('Preparing [ supply ] table (fill distinct accounts)')
  return await db.run(`INSERT INTO supply SELECT DISTINCT account, null, null, null, null FROM objects`)
}

const close = async () => {
  log('Closing database')
  return await db.close()
}

const getSupply = async () => {
  return (await db.get(`
    SELECT
      sum(accountDropsSupply) / 1000000 as xrpTotalSupply,
      sum(dropsBalanceSpendable) / 1000000 as xrpTotalBalance,
      sum(dropsReserved) / 1000000 as xrpTotalReserved,
      sum(dropsReservedOffers) / 1000000 as xrpTotalReservedOffers
    FROM
      supply
  `))
}

const getOne = async () => {
  const account = (await db.get(`SELECT account FROM supply WHERE dropsBalanceSpendable IS NULL LIMIT 1`))?.account
  if (!account) return
  return {
    account,
    objects: (await db.all(`SELECT type, json FROM objects WHERE account = ?`, account)).map(r => {
      return {
        type: r.type,
        object: JSON.parse(r.json)
      }
    })
  }
}

module.exports = {
  open,
  close,
  persistObject,
  persistMarker,
  getMarker,
  getStats,
  clearSupply,
  prepareSupply,
  getOne,
  persistSupply,
  getSupply
}
