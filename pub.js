var mqtt = require('mqtt');
var client = mqtt.connect('mqtt://localhost',{encoding:'utf8', clientId: 'publish'});
client.on('connect', function(){
    client.publish('esp/valve', "18-FE-34-9F-A1-E31", {qos:0, retain:false});
    client.end();
});
