var netatmo = require('netatmo');
////initiating the bunyan log
var Logger = require('bunyan');
/**************thingSpeak client**************/
var ThingSpeakClient = require('thingspeakclient');
var client = new ThingSpeakClient({
  server:'http://10.129.139.139:3000',
  updateTimeout:20000
});
var loggedTime=0;
var log = new Logger({name:'NetAtmo-Sensor', 
         streams: [
    {
      level: 'info',
      stream: process.stdout            // log INFO and above to stdout
    },
    {
      level: 'error',
      stream: process.stdout            // log ERROR and above to stdout
    },
    {
      level: 'warn',
      stream: process.stdout            // log warning and above to stdout
    },
    {
      level: 'error',
      path: 'netAtmo.log'  // log ERROR and above to a file
    },
    {
      level: 'warn',
      path: 'netAtmo.log'  // log WARNING and above to a file
    },
    {
      level: 'info',
      path: 'netAtmo.log'  // log INFO and above to a file
    }
  ]

});
var auth = {
  "client_id": "56e31c7b67e482df77b5bcb4",
  "client_secret": "YUtI2kSwnNjpPRGHuPP1htfkCjxi",
  "username": "jayantjnp@gmail.com",
  "password": "Ym717yhpvq5#",
};
client.attachChannel(63, { writeKey:'TPNEH703U4WFJBTS'});
console.log('Channel 63 attached');
client.attachChannel(64, { writeKey:'K1TWOPPBL5Z2GKY2'});
console.log('Channel 64 attached');
client.attachChannel(65, { writeKey:'5SV73IZO1KJ9UGIB'});
console.log('Channel 65 attached');
var api = new netatmo(auth);
 
/*var getUser = function(err, user) {
  console.log(user);
};*/
 
var getDevicelist = function(err, devices, modules) {
  console.log(devices[1].dashboard_data.time_utc);
  //console.log(modules[2]);
  if(loggedTime!=devices[1].dashboard_data.time_utc){
    client.updateChannel(63, { "field1":modules[1].dashboard_data.Temperature,"field2":modules[1].dashboard_data.Humidity,"field3":modules[1].battery_vp}, function(err, resp) {
      if (!err && resp > 0) {
          log.info('Thingspeak feed update successfully for NetAtmo ERTS-OUT');
      }
    });
    client.updateChannel(64, { "field1":modules[2].dashboard_data.Temperature,"field2":modules[2].dashboard_data.CO2,"field3":modules[2].dashboard_data.Humidity,"field4":modules[2].battery_vp}, function(err, resp) {
      if (!err && resp > 0) {
          log.info('Thingspeak feed update successfully for NetAtmo ERTS-IN');
      }
    });
    client.updateChannel(65, { "field1":devices[1].dashboard_data.Temperature,"field2":devices[1].dashboard_data.CO2,"field3":devices[1].dashboard_data.Humidity,"field4":devices[1].dashboard_data.Noise,"field5":devices[1].dashboard_data.Pressure, "field6":devices[1].wifi_status}, function(err, resp) {
      if (!err && resp > 0) {
          log.info('Thingspeak feed update successfully for NetAtmo ERTS-Lab');
      }
    });
  }
loggedTime=devices[1].dashboard_data.time_utc;
};
 
var getMeasure = function(err, measure) {
  console.log(measure.length);
  console.log(measure[0]);
};
 /*
var getThermstate = function(err, result) {
  console.log(result);
};
 
var getCameraPicture = function(err, picture) {
  console.log(picture); // image/jpeg 
}
 
var setSyncSchedule = function(err, status) {
  console.log(status);
};
 
var setThermpoint = function(err, status) {
  console.log(status);
};*/
 
// Event Listeners 
//api.on('get-user', getUser);
api.on('get-devicelist', getDevicelist);
setInterval(function() {
  api.getDevicelist();
},100000);
