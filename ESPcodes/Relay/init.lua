--tmr.delay(500000)  --remove this later
--adding new pins
pin4 = 8
gpio.mode(pin4,gpio.OUTPUT)
gpio.write(pin4,gpio.LOW)
--
wifi.setmode(wifi.STATION)
wifi.sta.config('ERTS LAB 204','balstre402')



wifi.sta.disconnect()
bat3=tostring(adc.readvdd33())
wifi.sta.connect()

--configure gpio pins according to revised pin map
pin14 = 5
pin12 = 6
pin13 = 7

gpio.mode(pin14,gpio.OUTPUT)
gpio.mode(pin12,gpio.OUTPUT)
gpio.mode(pin13,gpio.OUTPUT)
gpio.write(pin13,gpio.LOW)
c=false                                   --initialising the flag 
wifiAvailable=0
sleepTime=1000000*60*10    --10 min sleep
dofile('connect.lua')
