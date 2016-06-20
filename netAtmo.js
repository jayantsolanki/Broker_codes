var netatmo = require('netatmo');
/**************thingSpeak client**************/
var ThingSpeakClient = require('thingspeakclient');
var client = new ThingSpeakClient({
  server:'http://10.129.139.139:3000',
  updateTimeout:20000
});
var auth = {
  "client_id": "56e31c7b67e482df77b5bcb4",
  "client_secret": "YUtI2kSwnNjpPRGHuPP1htfkCjxi",
  "username": "jayantjnp@gmail.com",
  "password": "Ym717yhpvq5#",
};
 
var api = new netatmo(auth);
 
var getUser = function(err, user) {
  console.log(user);
};
 
var getDevicelist = function(err, devices, modules) {
  //console.log(devices[1]);
  console.log(modules[2]);
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
api.on('get-measure', getMeasure);
/*
api.on('get-thermstate', getThermstate);
api.on('get-camerapicture', getCameraPicture);
api.on('set-syncschedule', setSyncSchedule);
api.on('set-thermpoint', setThermpoint);*/
 
// Get User 
// See Docs: http://dev.netatmo.com/doc/restapi/getuser 
//api.getUser();
 
// Get Devicelist 
// See docs: http://dev.netatmo.com/doc/restapi/devicelist 
api.getDevicelist();
 
// Get Measure 
// See docs: http://dev.netatmo.com/doc/restapi/getmeasure 
var options = {
  device_id: '70:ee:50:01:ea:aa',
 // module_id : "02:00:00:01:e5:68",
  scale: '30min',
  limit: 10,
  type: ['Temperature', 'CO2', 'Humidity', 'Pressure', 'Noise'],
};
 
//api.getMeasure(options);
/* 
// Get Thermstate 
// See docs: http://dev.netatmo.com/doc/restapi/getthermstate 
var options = {
  device_id: '',
  module_id: '',
};
 
api.getThermstate();
 
// Set Sync Schedule 
// See docs: http://dev.netatmo.com/doc/restapi/syncschedule 
var options = {
  device_id: '',
  module_id: '',
  zones: [
    { type: 0, id: 0, temp: 19 },
    { type: 1, id: 1, temp: 17 },
    { type: 2, id: 2, temp: 12 },
    { type: 3, id: 3, temp: 7 },
    { type: 5, id: 4, temp: 16 }
  ],
  timetable: [
    { m_offset: 0, id: 1 },
    { m_offset: 420, id: 0 },
    { m_offset: 480, id: 4 },
    { m_offset: 1140, id: 0 },
    { m_offset: 1320, id: 1 },
    { m_offset: 1860, id: 0 },
    { m_offset: 1920, id: 4 },
    { m_offset: 2580, id: 0 },
    { m_offset: 2760, id: 1 },
    { m_offset: 3300, id: 0 },
    { m_offset: 3360, id: 4 },
    { m_offset: 4020, id: 0 },
    { m_offset: 4200, id: 1 },
    { m_offset: 4740, id: 0 },
    { m_offset: 4800, id: 4 },
    { m_offset: 5460, id: 0 },
    { m_offset: 5640, id: 1 },
    { m_offset: 6180, id: 0 },
    { m_offset: 6240, id: 4 },
    { m_offset: 6900, id: 0 },
    { m_offset: 7080, id: 1 },
    { m_offset: 7620, id: 0 },
    { m_offset: 8520, id: 1 },
    { m_offset: 9060, id: 0 },
    { m_offset: 9960, id: 1 }
  ],
};
 
api.setSyncSchedule();
 
// Set Thermstate 
// See docs: http://dev.netatmo.com/doc/restapi/setthermpoint 
var options = {
  device_id: '',
  module_id: '',
  setpoint_mode: '',
};
 
api.setThermpoint();*/