var mqtt    = require('mqtt');
//var pub  = mqtt.connect('tcp://0.0.0.0:61620',{encoding:'utf8', clientId: 'Publishers'});
var pub  = mqtt.connect('mqtt://10.129.28.181:1880',{encoding:'utf8', clientId: 'Publishers'});
 
//pub.on();
//pub.publish('esp/12-31-13-AA-FD-43', '12-31-13-AA-FD-433005', {retain:false, qos: 0});
pub.publish('esp/18:fe:34:9b:63:7c', '12-31-13-AA-FD-433005', {retain:true, qos: 0});
pub.end();

//console.log(jay);
