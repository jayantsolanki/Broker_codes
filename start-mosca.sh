#!/bin/bash
screen -t 'mosca'
node mosca-mysql-server.js |bunyan   & echo 'mosca-mysql-server.js started, starting mosca server'
screen -d
#& node  mosca-mysql-server.js 

