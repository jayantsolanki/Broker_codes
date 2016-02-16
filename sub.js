var mqtt = require('mqtt');
var client = mqtt.connect('mqtt://10.129.28.118',{clean:false,encoding:'utf8', clientId: 'subscriber '});
client.on('connect', function(){
    client.subscribe('#');
});
client.on('message', function(topic, msg){
    console.log('Received Message:', topic, msg);
});
