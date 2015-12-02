var mqtt    = require('mqtt');
var client  = mqtt.connect('mqtt://10.129.28.152',{encoding:'utf8', clientId: '1348-FE-34-AA-A1-E31'});
 
client.on('connect', function () {
  client.publish('esp/battery', '18-FE-34-AA-A1-E31', {retain:false, qos: 1});
client.end();
});
