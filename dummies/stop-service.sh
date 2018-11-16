#!/bin/bash
kill $(ps aux | grep '[s]erial-sensor.js' | awk '{print $2}')
echo "Killed the serial-sensor.js process"
