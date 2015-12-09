var mqtt    = require('mqtt');
var pub  = mqtt.connect('mqtt://0.0.0.0:61620',{encoding:'utf8', clientId: 'Publishers'});
 
//pub.on();
pub.publish('esp/12-31-13-AA-FD-43', '12-31-13-AA-FD-433005', {retain:false, qos: 1});
pub.end();

//console.log(jay);
