#!/bin/bash
node mosca-mysql-rpi-server.js | bunyan -L  & echo 'MOSCA Server started, starting mosca server'& node  mosca-mysql-server.js  | bunyan -L

