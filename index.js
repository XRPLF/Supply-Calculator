const Client = require('rippled-ws-client')
const log = require('debug')('xrplstats')
const fs = require('fs')

/**
  Total coins in last closed ledger
    Minus the funds in escrow (they are locked away)
    Minus funds in accounts that are not accessible (account_one, rrrrrrrrrrrrrrrrrrrn5RM1rHd …)
    Minus funds in accounts that are black holed (master key disabled, regular key set to account_one)
    Minus funds locked in "longer term" reserves (trust lines, base reserves, signer list …, but not offers)
*/

// Development: limit output to a short list of accounts to test calculation
const limitAccounts = (process.env.ACCOUNTS || '').trim().replace(/[^a-zA-Z0-9]+/g, ',').split(',')

const ledgerContents = {}

const main = async ledgerIndex => {
  const connection = await new Client(process.env.SERVER || 'wss://xrplcluster.com')

  const ledgerInfo = (await connection.send({
    command: 'server_info'
  })).info.validated_ledger

  const call = async marker => {
    const data = await connection.send({
      ledger_index: ledgerIndex,
      command: 'ledger_data',
      limit: 500,
      binary: false,
      marker: marker === '_' ? undefined : marker
   })
   return {
     state: data.state.filter(s => typeof s.Account !== 'undefined'),
     marker: data.marker
   }
  }

  let marker = '_'
  let i = 0
  let accounts = 0

  while (marker) {
    i++
    const results = await call(marker)
    accounts += results.state.length

    results.state.forEach(record => {
      let account = record?.Account
      if (record.LedgerEntryType === 'RippleState' && record?.HighLimit?.issuer) {
        account = record?.HighLimit?.issuer
      }

      if (account && limitAccounts.indexOf(account) < 0) {
        if (typeof ledgerContents[account] === 'undefined') {
          Object.assign(ledgerContents, { [account]: {} })
        }
        if (typeof ledgerContents[account][record.LedgerEntryType] === 'undefined') {
          Object.assign(ledgerContents[account], { [record.LedgerEntryType]: [] })
        }

        ledgerContents[account][record.LedgerEntryType].push(record)
      }
    })

    log(i, accounts)

    marker = results.marker
    if (process.env.LIMIT && i >= Number(process.env.LIMIT)) {
      marker = null
    }
  }

  log(`\n\nDone! Got ${Object.values(ledgerContents).length} accounts from ledger ${ledgerIndex}`)
  connection.close()

  log(`\n\nWriting file...`)

  const writeStream = fs.createWriteStream(__dirname + '/output/' + ledgerIndex + '.json')

  writeStream.write('{"meta":')
  writeStream.write(JSON.stringify(ledgerInfo))
  writeStream.write(',"data":{')

  const a = Object.keys(ledgerContents)
  const accountLength = a.length

  a.forEach((account, i) => {
    const line = '"' + account + '":' + JSON.stringify(ledgerContents[account]) + (i + 1 === accountLength ? '' : ',')
    writeStream.write(line)
  })
  writeStream.write('}}')

  writeStream.on('finish', () => {
    log('Wrote all data to file')
  })

  writeStream.end()

  log('Done.')
}

main(process.argv[2])

module.exports = main
