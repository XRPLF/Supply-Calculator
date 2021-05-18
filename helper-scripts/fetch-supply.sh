#!/bin/bash

cd /root/supply-calculator

ledger=$(rippled --quiet server_info |jq .result.info.complete_ledgers|cut -d '"' -f 2 | rev | cut -d "-" -f 1|cut -d "," -f 1|rev)
ledger=$(echo $ledger|sed s/[0-9][0-9][0-9][0-9]$/0000/g)

echo $ledger

if [ -e /root/supply-calculator/output/$ledger.sqlite ]; then
  echo "exists"
  exit 1
else
  echo "fetch"
  date
  SERVER=ws://127.0.0.1:8080 LIMIT=1000000 DEBUG=xrplstats* npm run fetch $ledger && DEBUG=xrplstats* npm run calc $ledger; echo; date

  mv supply-calculator/output/$ledger.sqlite /var/www/html
  mv supply-calculator/output/$ledger.json /var/www/html

  rm /var/www/html/latest.sqlite
  rm /var/www/html/latest.json

  cd /var/www/html/; ln -s ./$ledger.sqlite latest.sqlite; ln -s ./$ledger.json ./latest.json

fi
