# XRPL Supply calculator

## Work in progress!

### Fetch a ledger (output: > 1 GB JSON)

```
npm run fetch LEDGERINDEX
```

eg.

```
npm run fetch 63559050
```

This will generate `LEDGERINDEX.json` in the `/output` folder.

Optional environment variables:
 - `SERVER` (a ws:// or wss:// URL)
 - `LIMIT` (number: the amount of markers to follow)
 - `ACCOUNTS` (a comma separated list with accounts to fetch data for)
 - `VERBOSE` (number, DEBUG output, needs `DEBUG=xrplstats*` to show debug output)

### Calculate results

```
VERBOSE=1 DEBUG=xrplstats* node calc.js 63559050
```

This will generate `LEDGERINDEX.output.json` in the `/output` folder.

