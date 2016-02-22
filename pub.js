var mqtt = require('mqtt');
var client = mqtt.connect('mqtt://10.129.28.118:1883',{encoding:'utf8', clientId: 'publisher'});
client.on('connect', function(){
    client.publish('esp/18:fe:34:9f:a4:a7', "2", {qos:0, retain:true});
    client.publish('esp/18:fe:34:9f:a1:81', "2", {qos:0, retain:true});
      client.publish('esp/18:fe:34:fe:7e:dc', "2", {qos:0, retain:true});
//        client.end();
});
