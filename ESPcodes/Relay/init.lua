--tmr.delay(500000)  --remove this later
--adding new pins


--
wifi.setmode(wifi.STATION)
station_cfg={}
station_cfg.ssid="heath 50"
station_cfg.pwd="jabberwocky"
station_cfg.save=true
wifi.sta.config(station_cfg)



wifi.sta.disconnect()
-- bat3=tostring(adc.readvdd33())
wifi.sta.connect()

--configure gpio pins according to revised pin map
pin14 = 5
pin12 = 6
pin13 = 7
pin4 = 2
pin2 = 4
gpio.mode(pin14,gpio.OUTPUT)
gpio.mode(pin12,gpio.OUTPUT)
gpio.mode(pin13,gpio.OUTPUT)
gpio.mode(pin4,gpio.OUTPUT)
gpio.mode(pin2,gpio.OUTPUT)-- for led light on esp
--default pin output
gpio.write(pin14,gpio.HIGH)
gpio.write(pin12,gpio.HIGH)
gpio.write(pin13,gpio.HIGH)
gpio.write(pin4,gpio.HIGH)
gpio.write(pin2,gpio.HIGH)
c=false                                   --initialising the flag 
wifiAvailable=0
sleepTime=1000000*60*10    --10 min sleep
dofile('connect.lua')
