const log = require('debug')('xrplstats:calc')
const assert = require('assert')
const store = require('./sqlite3')
const fs = require('fs')

const blackholeAccounts = [
  'rrrrrrrrrrrrrrrrrrrrrhoLvTp',        // Account Zero
  'rrrrrrrrrrrrrrrrrrrrBZbvji',         // Account One
  'rrrrrrrrrrrrrrrrrrrn5RM1rHd',        // NaN
  'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'  // Genesis (blackholed)
]

const lsfDisableMaster = 0x00100000

const main = async () => {
  try {
    log('Starting...')

    const ledger = process.argv[2]
    log('Calculating ledger index', ledger)

    await store.open(ledger)
    const storeStats = await store.getStats()

    if (storeStats.supplyCount === 0) {
      await store.prepareSupply()
      Object.assign(storeStats, await store.getStats())
    }

    // assert(storeStats.toProcess !== 0, 'Supply already calculated')
    assert(storeStats.accountCount > 1000 && storeStats.marker === null, 'Not yet done fetching')

    // await store.clearSupply()
    
    let processed = 0

    let record
    while(record = await store.getOne()) {
      const {account, objects} = record
      log(processed, storeStats.toProcess, Math.floor(processed / storeStats.toProcess * 100) + '%', account)

      const accountRoot = objects.filter(o => o.type === 'AccountRoot')[0]?.object
      const offers = objects.filter(o => o.type === 'Offer').map(o => o.object)

      const blackHoled = (
        blackholeAccounts.indexOf(accountRoot?.RegularKey || '') > -1
        && (lsfDisableMaster & (accountRoot?.Flags || 0)) === lsfDisableMaster
      ) || blackholeAccounts.indexOf(account) > -1
  
      const calculated = {
        account,
        xrpSpendable: blackHoled
          ? 0
          : Number(accountRoot?.Balance) / 1000000,
        xrpReserved: storeStats.reserveBaseXrp + accountRoot?.OwnerCount * storeStats.reserveIncXrp,
        xrpReservedOffers: (offers || []).length * storeStats.reserveIncXrp,
      }
  
      const supply = Math.max(calculated.xrpSpendable - calculated.xrpReserved + calculated.xrpReservedOffers, 0)

      store.persistSupply(account, calculated, supply)

      processed++
    }

    log('Done')

    log('Calculating total supply')

    const crunched = {
      ledger: Number(ledger),
      closeTimeHuman: storeStats.closeTimeHuman,
      xrp: await store.getSupply(),
      accounts: storeStats.supplyCount,
      xrpExisting: storeStats.coins
    }
    log(crunched)

    fs.writeFileSync(__dirname + '/../output/' + ledger + '.json', JSON.stringify(crunched))

    store.close()
  } catch (e) {
    log('Error!', e.message, e)
    process.exit(0)
  }
}

main()
