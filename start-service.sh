#!/bin/bash
node serial-sensor.js | bunyan -L  & echo 'serial-sensor.js started, starting mosca server'& node  mosca-mysql-server.js  | bunyan -L

