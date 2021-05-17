const log = require('debug')('xrplstats')
const store = require('./sqlite3')
const xrpl = require('./xrpl')

const main = async () => {
  log('Starting...')
  const ledger = Number(process.argv[2] || (await xrpl.getLastLedger()).seq)
  log('Processing ledger index', ledger)
  await store.open(ledger)
  log('Fetching transactions from the XRPL...')
  await xrpl.fetch(store.persistObject, await store.getMarker(), store.persistMarker)
  log('Done fetching transactions from the XRPL')

  xrpl.close()
  store.close()
}

main()
