macid = wifi.sta.getmac()
--wait for WiFi connection 
tmr.alarm(1, 1000, 1, function() 
    if wifi.sta.getip()== nil then
       --print ('Connecting...')
       wifiAvailable=wifiAvailable+1
       if(wifiAvailable>60) then -- sleep after 60 failed attempts
           node.dsleep(sleepTime)    
       end
    else
        tmr.stop(1)
        print('IP is '..wifi.sta.getip())
        wifiAvailable = 0 -- resetting count
        tries = 0                                                              
        tmr.alarm(1, 1000, 1, function()                   --checking for mqtt connection 
                    if not c and tries < 60 then 
                        tries = tries + 1                      -- incrementing the number of tries 
                        dofile('mqttserversetupRelay.lua')                      --calling mqtt script 

                        m:connect('192.168.1.73',1883, 0, 1, function(conn) 
                                tmr.stop(1)
                                c = true    
                                gpio.write(pin2,gpio.LOW)
                                tries = 0 -- resetting count on successful try
                                --print('mqtt connected')
                                --m:publish('esp/'..macid..'/identifier,0,0,  function(conn)         -- publish the device macid to the broker to identify itself 

                                    --topic = 'esp/a0:20:a6:08:e0:12'
                                    topic = 'esp/'..macid                 -- topic to subscribe to 
                                    m:subscribe(topic,0,function(conn) end)--print('subscribing success') end)     -- subscribing to topic 
                                    --m:publish('esp/'..macid..'/battery',tostring(adc.read(0)),0,0, function(conn) end)--print('battery status sent') end)
                                    --esp/macid/valve value=valve
                                    print("Time for execution "..tmr.time().." seconds")
                                    tmr.stop(1)
                                    gpio.write(pin2,gpio.HIGH)
                                --end)    
                        end)
                    elseif tries >= 60 then                -- If the number of tries are greater than a certain threshold go to sleep 
                        node.dsleep(sleepTime)   
                    end 
    end)
   end
end)  
    tmr.alarm(0,10000,1,function()--changed to 10 seconds
    --node.dsleep(sleepTime)
end)
