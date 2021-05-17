# XRPL supply calculator

##### Work in progress. Todo:

- [x] Create database & tables
- [x] Fetch from XRPL
- [x] Ability to continue fetching if disconnected during process
- [ ] Calculation
- [ ] Export crunched numbers to JSON
- [ ] Express + PM2 service to serve crunched numbers

Fetches an entire ledger (all objects) to a SQLite3 database, then to crunch some numbers.

Use the `DEBUG=xrplstats*` prefix (env. var.) to get output on your terminal while running.

### Fetch a ledger (output: > 1 GB)

This will fetch all ledgers into `output/LEDGERINDEX.sqlite`, table `objects`.

If this process gets stuck (eg. disconnected XRPL node) you can safely quit it and restart
the process: it will continue fetching data where it left off (thanks to the `marker` in
the `meta` table)

```
npm run fetch LEDGERINDEX
```

eg.

```
npm run fetch 63638161
```

Optional environment variables:
 - `SERVER` (a ws:// or wss:// URL)
 - `LIMIT` (number: the amount of markers to follow)
 - `ACCOUNTS` (a comma separated list with accounts to fetch data for)

#### Sample (raw) command:

```
SERVER=ws://10.40.4.3:8080 LIMIT=100000 DEBUG=xrplstats* node src/index.js 63638161
```

### Calculate results

```
npm run calc LEDGERINDEX
```

eg.
```
npm run calc 63638161
```

#### Sample (raw) command:

```
DEBUG=xrplstats* src/calc.js 63638161
```

