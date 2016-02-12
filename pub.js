var mqtt = require('mqtt');
var client = mqtt.connect('mqtt://10.129.28.181:1880',{encoding:'utf8', clientId: 'publisher'});
client.on('connect', function(){
    client.publish('esp/18:fe:34:9b:74:55', "2", {qos:0, retain:false});
    client.end();
});
