const log = require('debug')('xrplstats:xrpl')
const Client = require('rippled-ws-client')

const limitAccounts = (process.env.ACCOUNTS || '').trim().replace(/[^a-zA-Z0-9]+/g, ',').split(',')
// const lsfDisableMaster = 0x00100000

let connection
let ledger

const main = async () => {
  const endpoint = process.env.SERVER || 'wss://xrplcluster.com'
  connection = await new Client(endpoint)
  log('Connected to the XRPL', {endpoint})
  return
}

const ready = main()

const getLastLedger = async () => {
  await ready
  return (await connection.send({command: 'server_info'})).info.validated_ledger
}

const getLedgerInfo = async ledgerIndex => {
  ledger = ledgerIndex
  await ready
  return (await connection.send({command: 'ledger', ledger_index: ledgerIndex})).ledger
}

const fetch = async (persist, initialMarker, persistMarker) => {
  if (process.env.LIMIT && Number(process.env.LIMIT) < 1) {
    return
  }

  const call = async marker => {
    log('Fetching...')
    const data = await connection.send({
      ledger_index: ledger,
      command: 'ledger_data',
      limit: 500,
      binary: false,
      marker: marker === '_' ? undefined : marker
    })
    log('Done...')
    return {
      state: data.state.filter(s => typeof s.Account !== 'undefined'),
      marker: data.marker
    }
  }

  let marker = initialMarker ? initialMarker : '_'
  let i = 0
  let accounts = 0

  while (marker) {
    i++
    const results = await call(marker)
    accounts += results.state.length

    for await (record of results.state) {
      let account = record?.Account
      if (record.LedgerEntryType === 'RippleState' && record?.HighLimit?.issuer) {
        account = record?.HighLimit?.issuer
      }

      if (account && limitAccounts.indexOf(account) < 0) {
        await persist(account, record.LedgerEntryType, record)
      }
    }

    log(i, accounts)

    marker = results.marker

    await persistMarker(marker)

    if (process.env.LIMIT && i >= Number(process.env.LIMIT)) {
      marker = null
    }
  }

  return
}

const close = async () => {
  log('Disconnecting XRPL connection')
  return await connection.close()
}

module.exports = {
  getLastLedger,
  getLedgerInfo,
  fetch,
  close
}
