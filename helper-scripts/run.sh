#!/bin/bash

mount -t tmpfs -o rw,size=4G tmpfs /root/supply-calculator/output

screen -ls|grep supply|cut -d "." -f 1|sed "s/[^0-9]//g"|xargs -I___ kill -9 ___
screen -wipe

screen -dmS fetchsupply -L -Logfile /root/supply.log -c /root/supply-screen.config /bin/bash -c "/root/fetch-supply.sh"
screen -S fetchsupply -X colon "logfile flush 0^M"
screen -ls
