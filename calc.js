const fs = require('fs')
const JSONStream = require('JSONStream')
const log = require('debug')('xrplstats-parse')

const blackholeAccounts = [
  'rrrrrrrrrrrrrrrrrrrrrhoLvTp', // Account Zero
  'rrrrrrrrrrrrrrrrrrrrBZbvji', // Account One
  'rrrrrrrrrrrrrrrrrrrn5RM1rHd', // NaN
  'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh' // Genesis (blackholed)
]

const verbosity = process.env.VERBOSE || 0

const lsfDisableMaster = 0x00100000

/**
  Total coins in last closed ledger
    Minus the funds in escrow (they are locked away)
    Minus funds in accounts that are not accessible (account_one, rrrrrrrrrrrrrrrrrrrn5RM1rHd …)
    Minus funds in accounts that are black holed (master key disabled, regular key set to account_one)
    Minus funds locked in "longer term" reserves (trust lines, base reserves, signer list …, but not offers)
*/
if (verbosity > 0) log('Start reading', process.argv[2])

const ledgerContents = {}
const meta = {}
let accountCount = 0

if (verbosity > 0) log('Reading...')
const record = fs.createReadStream(__dirname + '/output/' + process.argv[2] + '.json')
const recordStream = record.pipe(JSONStream.parse('data.$*'))
const metaStream = record.pipe(JSONStream.parse('meta'))

metaStream.on('data', ledgerMeta => {
  Object.assign(meta, ledgerMeta)
  if (verbosity > 0) log({meta})
})

recordStream.on('data', record => {
  accountCount++
  if (typeof ledgerContents[record.key] === 'undefined') {
    Object.assign(ledgerContents, { [record.key]: {} })
  }
  Object.keys(record.value).forEach(type => {
    if (typeof ledgerContents[record.key][type] === 'undefined') {
      Object.assign(ledgerContents[record.key], { [type]: [] })
    }
    record.value[type].forEach(ledgerObject => {
      ledgerContents[record.key][type].push(ledgerObject)
    })
  })
})

/**
 * Sample format "ledgerContents"
  {
    rwietsevLFg8XSmG3bEZzFein1g8RBqWDZ: { Offer: [ [Object] ], AccountRoot: [ [Object] ] },
    rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT: {
      Escrow: [ [Object], [Object], [Object], [Object] ],
      AccountRoot: [ [Object] ]
    },
    rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B: { AccountRoot: [ [Object] ] }
  } +0ms
 */

/**
 * Sample format AccountRoot[]
  {
    Account: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B',
    Balance: '6545061017106',
    Domain: '6269747374616D702E6E6574',
    EmailHash: '5B33B93C7FFE384D53450FC666BB11FB',
    Flags: 9043968,
    LedgerEntryType: 'AccountRoot',
    OwnerCount: 397,
    PreviousTxnID: 'EB097B64B403121618F721B10EA92729A96494FCD83B586BE8A5C5B987A5C2CA',
    PreviousTxnLgrSeq: 63558680,
    Sequence: 4480,
    TransferRate: 1002000000,
    index: 'B7D526FDDF9E3B3F95C3DC97C353065B0482302500BBB8051A5C090B596C6133'
  }
 */

recordStream.on('end', () => {
  if (verbosity > 0) log('Done reading, accounts:', accountCount)

  if (verbosity > 0) log(`\nProcessing:\n`)

  const calculated = Object.keys(ledgerContents).map(account => {
    const blackHoled = (
      blackholeAccounts.indexOf(ledgerContents[account].AccountRoot[0]?.RegularKey || '') > -1
      && (lsfDisableMaster & (ledgerContents[account].AccountRoot[0]?.Flags || 0)) === lsfDisableMaster
    ) || blackholeAccounts.indexOf(account) > -1

    const calculated = {
      account,
      xrpSpendable: blackHoled
        ? 0
        : Number(ledgerContents[account].AccountRoot[0].Balance) / 1000000,
      xrpReserved: meta.reserve_base_xrp + ledgerContents[account].AccountRoot[0].OwnerCount * meta.reserve_inc_xrp,
      xrpReservedOffers: (ledgerContents[account]?.Offer || []).length * meta.reserve_inc_xrp,
    }

    return {
      account,
      supply: Math.max(calculated.xrpSpendable - calculated.xrpReserved + calculated.xrpReservedOffers, 0)
    }
  })

  const supplyPerAccount = calculated.reduce((a, b) => {
    return Object.assign(a, {
      [b.account]: b.supply
    })
  }, {})

  if (verbosity > 2) log({supplyPerAccount})

  const supply = calculated.reduce((a, b) => {
    return a + b.supply
  }, 0)

  const output = {meta, accountCount, supply}
  log(output)

  fs.writeFileSync(__dirname + '/output/' + process.argv[2] + '.output.json', JSON.stringify(output))
})
