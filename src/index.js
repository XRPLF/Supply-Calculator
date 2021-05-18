const log = require('debug')('xrplstats')
const assert = require('assert')
const store = require('./sqlite3')
const xrpl = require('./xrpl')

const main = async () => {
  try {
    log('Starting...')

    const ledger = Number(process.argv[2] || (await xrpl.getLastLedger()).seq)
    log('Processing ledger index', ledger)

    await store.open(ledger, xrpl.getLedgerInfo)
    const storeStats = await store.getStats()

    assert(storeStats.supplyCount === 0, 'Supply already calculated')
    assert(!(storeStats.accountCount > 1000 && storeStats.marker === null), 'Already done fetching')

    log('Fetching transactions from the XRPL...')
    await xrpl.fetch(store.persistObject, await store.getMarker(true), store.persistMarker)
    log('Done fetching transactions from the XRPL')

    xrpl.close()
    store.close()
  } catch (e) {
    log('Error!', e.message, e)
    process.exit(0)
  }
}

main()
