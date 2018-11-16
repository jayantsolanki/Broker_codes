# Broker_codes version V2018, 2018
## Nodejs based MQTT broker, extended with various features for providing communication framework to IoT - Automation
***
## This repo contains three main files, namely
* mosca-mysql-rpi-server.js
* serial-sensor.js
* reactJS.js
***
### First file runs the Mosca MQTT server and various other backend modules, which are important for coordinating between the database, ESP devices and website.
* It runs a scheduling algorithm for scheduling the ESP valves
* It runs a deviec discovery algorithm for identifying new devices
* It runs a websocket server for sending ws data too and fro between the site and the MQTT server
* It records the activity status of the devices and stores into the database
* It periodically checks the battery status of the devices and stores it into the database
* Create channels on the thinspeak and sends a copy of data to it
***
### Second file runs a script for getting the data from the sensor nodes
It basically
* Runs a device discovery feature for identifying the new devices
* Runs a activity algorithm for detecting which devices are online and offline
* Stores the sensors data in the database
* Create channels on the thinspeak and sends a copy of data to it
***
### Third file runs a scripts for executing various task entered by the User such as:
* Periodically checking the battery value of the ESP valves
* Checking the critical battery levels
* Automating the irrigation schedule
* Checking the connectivity status of all the devices etc
***

### Setup (For Raspberry Pi 3 Model B)
<!--- Creating a bash script for running the serial-sensor code on the Raspberry Pi
```
#!/bin/bash
screen -dmS "Serial-Sensor"
screen -S "Serial-Sensor" -p 0 -X stuff "node ~/Projects/IoT-Framwwork/Broker_codes/serial-sensor.js |bunyan -L \\r"
```
- chmod -x serial-sensor.sh
-->

### configuring Supervisor for serial-sensor script
 sudo apt-get install supervisor
    - goto /etc/supervisor/conf.d/
    - create serial-sensor.conf and enter below code
```
[program:serial-sensor]
command=/usr/bin/node ~/Projects/IoT-Framwwork/Broker_codes/serial-sensor.js |bunyan -L
autostart=true
autorestart=true
stderr_logfile=~/Projects/IoT-Framwwork/Broker_codes/log/serial-sensor.error
stdout_logfile=~/Projects/IoT-Framwwork/Broker_codes/log/serial-sensor.out
user=pi
directory=~/Projects/IoT-Framwwork/Broker_codes

```
- create flower-power.conf and enter below code
```
[program:flower-power]
command=/usr/bin/node ~/Projects/IoT-Framwwork/node_modules/flower-power/parrotsense.js
autostart=true
autorestart=true
stderr_logfile=~/Projects/IoT-Framwwork/Broker_codes/log/parrot-sensor.error
stdout_logfile=~/Projects/IoT-Framwwork/Broker_codes/log/parrot-sensor.out
user=pi
directory=~/Projects/IoT-Framwwork/node_modules/flower-power

```
- Updating supervisor with above configs
    - type sudo supervisorctl
    - type reread
    - type update
- To monitor the process
    - type sudo supervisorctl
    - type status
- To start a process
    - Type start process conf name, for example start serial-sensor
- To stop a process
    - Type stop process conf name
- To monitor the logs
    - sudo supervisorctl tail -f serial-sensor |bunyan -L
    - sudo supervisorctl tail -f parrot-sensor |bunyan -L

### Setup (For RPI 3 Model B)
#### configuring Supervisor for serial-sensor script
- sudo apt-get install supervisor
    - goto /etc/supervisor/conf.d/
        - create mosca-mysql-rpi-server.conf and enter below code
```
[program:mosca-mysql-rpi-server]
command=/usr/local/bin/node ~/Projects/IoT-Framwwork/Broker_codes/mosca-mysql-rpi-server.js
autostart=true
autorestart=true
stderr_logfile=~/Projects/IoT-Framwwork/Broker_codes/log/mosca-mysql-rpi-server.error
stdout_logfile=~/Projects/IoT-Framwwork/Broker_codes/log/mosca-mysql-rpi-server.out
user=jayant
directory=~/Projects/IoT-Framwwork/Broker_codes
```
- create netAtmo.conf and enter below code
```
[program:netAtmo]
command=/usr/local/bin/node ~/Projects/IoT-Framwwork/Broker_codes/netAtmo.js
autostart=true
autorestart=true
stderr_logfile=/home/jayant/brokercodes/log/netAtmo.error
stdout_logfile=~/Projects/IoT-Framwwork/Broker_codes/log/netAtmo.out
user=jayant
directory=~/Projects/IoT-Framwwork/Broker_codes

```
- create reactJS.conf and enter below code
```
[program:reactJS]
command=/usr/local/bin/node ~/Projects/IoT-Framwwork/Broker_codes/reactJS.js
autostart=true
autorestart=true
stderr_logfile=~/Projects/IoT-Framwwork/Broker_codes/log/reactJS.error
stdout_logfile=~/Projects/IoT-Framwwork/Broker_codes/log/reactJS.out
user=jayant
directory=~/Projects/IoT-Framwwork/Broker_codes
```
- create thingspeak.conf and enter below code
```
[program:thingspeak]
command=/usr/local/bin/rails server
autostart=true
autorestart=true
stderr_logfile=~/Projects/IoT-Framwwork/Broker_codes/log/thingspeak.error
stdout_logfile=~/Projects/IoT-Framwwork/Broker_codes/log/thingspeak.out
user=jayant
directory=/var/www/thingspeak  
```
- Updating supervisor with above configs
    - type sudo supervisorctl
    - type reread
    - type update
- To monitor the process
    - type sudo supervisorctl
    - type status
- To start a process
    - Type start process conf name, for example start serial-sensor
- To stop a process
    - Type stop process conf name
- To monitor the logs
    - sudo supervisorctl tail -f mosca-mysql-rpi-server |bunyan -L
    - sudo supervisorctl tail -f parrot-sensor |bunyan -L
    - or
    - tail -f /home/jayant/brokercodes/log/mosca-mysql-rpi-server.out |bunyan -L
