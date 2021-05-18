# XRPL supply calculator

This tool will fetch an entire ledger from the XRPL (a websocket node), and store it in
SQLite3. It'll then allow you to crunch the fetched data to balance stats per account.
The balance stats per account result in the final number of spendable (free flowing) XRP.

Please note: the SQLite file will end up well over 3GB when this tool is done with the data.

Fetches an entire ledger (all objects) to a SQLite3 database, then to crunch some numbers.

Use the `DEBUG=xrplstats*` prefix (env. var.) to get output on your terminal while running.

Best performance when writing to a ramdisk, use the `output` folder, eg. when checked out
to `/data/supply-calculator`:
```
mount -t tmpfs -o rw,size=4G tmpfs /data/supply-calculator/output
```

### Fetch a ledger

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

You can always stop the calculation mid process, it will pick up where it left off.

After calculating and writing the per account stats to the SQLite3 file, a `LEDGERINDEX.json`
file will be placed in the `output` directory containing the `ledger index`, `ledger close time`(human), **amount of XRP spendable** (by all accounts combined) and the **amount of accounts with spendable balance**.

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

