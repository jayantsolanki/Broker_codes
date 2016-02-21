#!/bin/bash
node serial-sensor.js >> log.text & echo 'serial-sensor.js started, starting mosca server'& node  mosca-mysql-server.js >> log.text 

