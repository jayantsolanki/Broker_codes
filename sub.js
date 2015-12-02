var mqtt = require('mqtt');
var client = mqtt.connect('mqtt://localhost',{clean:false,encoding:'utf8', clientId: 'subscriber '});
client.on('connect', function(){
    client.subscribe('esp/valve');
});
client.on('message', function(topic, msg){
    console.log('Received Message:', topic, msg);
});
