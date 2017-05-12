print("Ready to start soft ap")
local str=wifi.ap.getmac();
local ssidTemp=string.format("%s%s%s",string.sub(str,10,11),string.sub(str,13,14),string.sub(str,16,17));
cfg={}
cfg.ssid="ESP8266_"..ssidTemp;
cfg.pwd="12345678"
wifi.ap.config(cfg)
cfg={}
cfg.ip="192.168.1.1";
cfg.netmask="255.255.255.0";
cfg.gateway="192.168.1.1";
wifi.ap.setip(cfg);
wifi.setmode(wifi.SOFTAP)
str=nil;
ssidTemp=nil;
collectgarbage();
print("Soft AP started")
print("Heep:(bytes)"..node.heap());
print("MAC:"..wifi.ap.getmac().."\r\nIP:"..wifi.ap.getip());