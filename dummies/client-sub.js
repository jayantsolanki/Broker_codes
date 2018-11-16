var mqtt = require('mqtt');
var client = mqtt.connect('mqtt://0.0.0.0:1880',{encoding:'utf8', clientId: 'subscriber'});
client.on('connect', function(){
    client.subscribe('#',{qos:0});
   
});
client.on('message', function(topic, msg, client){
    console.log('Received Message:', topic, msg);
});
