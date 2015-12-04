var mqtt    = require('mqtt');
var client  = mqtt.connect('mqtt://127.0.0.1',{encoding:'utf8', clientId: 'Listener2'});
 
client.on('connect', function () {
  client.subscribe('esp/12-31-13-AA-FD-43');
 
client.on('message', function (topic, message) {
  console.log(message.toString());
//client.end();
  });
});
