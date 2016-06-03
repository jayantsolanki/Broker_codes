# Broker_codes
###Nodejs based server creation for MQTT brokering

This repo contains two main files, namely
- mosca-mysql-server.js
- serial-sensor.js
- reactJS.js

####First file runs the Mosca MQTT server and various other backend modules, which are important for coordinating between the database, ESP devices and website.
- It runs a scheduling algorithm for scheduling the ESP valves
- It runs a deviec discovery algorithm for identifying new devices
- It runs a websocket server for sending ws data too and fro between the site and the MQTT server
- It records the activity status of the devices and stores into the database
- It periodically checks the battery status of the devices and stores it into the database
- Create channels on the thinspeak and sends a copy of data to it

####Second file runs a script for getting the data from the sensor nodes
It basically
- Runs a device discovery feature for identifying the new devices
- Runs a activity algorithm for detecting which devices are online and offline
- Stores the sensors data in the database
- Create channels on the thinspeak and sends a copy of data to it

####Third file runs a scripts for executing various task entered by the User such as:
- Periodically checking the battery value of the ESP valves
- Checking the critical battery levels
- Automating the irrigation schedule
- Checking the connectivity status of all the devices
- etc
