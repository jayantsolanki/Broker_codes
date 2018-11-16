
macid = wifi.sta.getmac()
--wait for WiFi connection 
tmr.alarm(1, 1000, 1, function() 
    if wifi.sta.getip()== nil then
       --print ('Connecting...')
       wifiAvailable=wifiAvailable+1
       if(wifiAvailable>60) then
           node.dsleep(sleepTime)    
       end
    else
        tmr.stop(1)
        print('IP is '..wifi.sta.getip())
        tries = 0                                                              
        tmr.alarm(1, 1000, 1, function()                   --checking for mqtt connection 
                    if not c and tries < 60 then 
                        tries = tries + 1                      -- incrementing the number of tries 
                        dofile('mqttsetup_valve.lua')                      --calling mqtt script 

                        m:connect('192.237.176.49',1883, 0,function(conn) 
                                tmr.stop(1)
                                c = true    
                                --print('mqtt connected')
                                --m:publish('esp/'..macid..'/identifier,0,0,  function(conn)         -- publish the device macid to the broker to identify itself 
                                    
                                    topic = 'esp/'..macid                 -- topic to subscribe to 
                                    m:subscribe(topic,0,function(conn) end)--print('subscribing success') end)     -- subscribing to topic 
                                    --m:publish('esp/'..macid..'/battery',tostring(adc.read(0)),0,0, function(conn) end)--print('battery status sent') end)
                                    --esp/macid/valve value=valve
                                    print("Time for execution "..tmr.time().." seconds")
                                --end)    
                        end)
                    elseif tries >= 60 then                -- If the number of tries are greater than a certain threshold go to sleep 
                        node.dsleep(sleepTime)   
                    end 
    end)
   end
end)  
    tmr.alarm(0,6000,1,function()
    node.dsleep(sleepTime)
end)
