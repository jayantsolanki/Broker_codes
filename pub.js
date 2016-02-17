var mqtt = require('mqtt');
var client = mqtt.connect('mqtt://10.129.28.118:1883',{encoding:'utf8', clientId: 'publisher'});
client.on('connect', function(){
    //client.publish('esp/18:fe:34:9b:74:55', "2", {qos:0, retain:false});
    //client.publish('esp/18:fe:34:9f:a1:81', "1", {qos:0, retain:true});
    client.publish('esp/18:fe:34:9b:63:7c', "1", {qos:0, retain:true});

    //client.publish('esp/18:fe:34:9b:74:55', "1", {qos:1, retain:true});

    client.end();
});
