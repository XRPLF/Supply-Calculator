const log = require('debug')('xrplstats:sqlite3')
const assert = require('assert')
const sqlite3 = require('sqlite3').verbose()
const sqlite = require('sqlite')
const xrpl = require('./xrpl')

let db
let ledger

const open = async ledgerIndex => {
  assert(Number(ledgerIndex) > 32570, 'Invalid ledger index')
  ledger = ledgerIndex

  const filename = './output/' + ledgerIndex + '.sqlite'
  db = await sqlite.open({
    filename,
    driver: sqlite3.cached.Database
  })
  log('Connected to database', {filename})

  const ledgerInfo = await xrpl.getLedgerInfo(ledgerIndex)
  log('Got ledger human close time (from XRPL)', ledgerInfo.close_time_human)

  await db.run(`
    CREATE TABLE IF NOT EXISTS meta (
      ledger INTEGER PRIMARY KEY,
      closeTimeHuman TEXT,
      marker TEXT
    ) WITHOUT ROWID
  `)

  await db.run(`INSERT OR IGNORE INTO meta (ledger, closeTimeHuman) VALUES (?, ?)`, {
    1: ledgerIndex,
    2: ledgerInfo.close_time_human
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

  await db.run(`CREATE INDEX IF NOT EXISTS objects_account_type ON objects(account, type)`)

  log('Created [ objects ] table & index')

  await db.run(`
    CREATE TABLE IF NOT EXISTS supply (
      account TEXT PRIMARY KEY,
      dropsSpendable INTEGER DEFAULT 0,
      dropsReserved INTEGER DEFAULT 0,
      dropsReservedOffers INTEGER DEFAULT 0,
      accountDropsSupply INTEGER DEFAULT 0
    ) WITHOUT ROWID
  `)

  await db.run(`CREATE INDEX IF NOT EXISTS supply_account ON supply(account)`)

  log('Created [ supply ] table & index')

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

const persistMarker = async marker => {
  await db.run(`UPDATE meta SET marker = ? WHERE ledger = ?`, {
    1: marker,
    2: ledger
  })
  log('Persisted marker', ledger, marker)
}

const getMarker = async () => {
  const marker = await db.get(`SELECT marker FROM meta WHERE ledger = ?`, {
    1: ledger
  })
  if (marker.marker) {
    log('Got marker', marker.marker)
  } else {
    log('Start fetching from scratch')
  }
  return marker.marker
}

const close = async () => {
  log('Closing database')
  return await db.close()
}

module.exports = {
  open,
  close,
  persistObject,
  persistMarker,
  getMarker
}
