var mqtt = require('mqtt');
var client = mqtt.connect('mqtt://10.129.28.118',{encoding:'utf8', clientId: 'publisher'});
client.on('connect', function(){
    //client.publish('esp/18:fe:34:9b:74:55', "2", {qos:0, retain:false});
    //client.publish('esp/18:fe:34:9f:a1:81', "1", {qos:0, retain:true});
      //client.publish('esp/18:fe:34:9b:63:7c/battery', "3344", {qos:0, retain:false});
      client.publish('esp/18:fe:34:9f:a4:a7', "2", {qos:0, retain:true});
client.publish('esp/18:fe:34:e4:c4:8f', "2", {qos:0, retain:true});
client.publish('esp/18:fe:34:9f:a1:e3', "2", {qos:0, retain:true});
client.publish('esp/18:fe:34:fe:b1:e4', "2", {qos:0, retain:true});

        client.end();
});
