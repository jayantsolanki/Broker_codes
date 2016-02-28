var env = require('./settings');//importing settings file, environment variables
/***************Adding websocket feature*******/
var uuid = require('node-uuid');
var WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({port: 8181});
var wscon=null;
  ///////////////////////
////initiating the bunyan log
var Logger = require('bunyan');
var log = new Logger({name:'Serial-Sensor', 
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
      path: './log/iot.log'  // log ERROR and above to a file
    },
    {
      level: 'warn',
      path: './log/iot.log'  // log WARNING and above to a file
    },
    {
      level: 'info',
      path: './log/iot.log'  // log INFO and above to a file
    }
  ]

});
/////////
///mysql
var mysql      = require('mysql');
///
var connection = mysql.createConnection({
  host     : env.localhost,
  user     : env.user,
  password : env.password,
  database : env.database
});

connection.connect();
//configuration ended
/////serial config
var SerialPort = require("serialport").SerialPort
var serialPort = new SerialPort(env.portNo, {
  baudrate: 9600
})
/////////////////
//serial listen
serialPort.on("open", function () {
  log.info(env.portNo+' port opened');
  //console.log('open');
  var count=0
  var res, dataout;
  serialPort.on('data', function(data) {
    log.info('data received: '+data);
    
    
    //console.log("Time: "+date);

    dataout=String(data);
    res = dataout.split(",");//getting strings
   // console.log(res[0]);//stores device id
    //console.log(res[1]);//stored packet number or id
   // console.log(res[2]);//gets device type
    
    
    //find if the device is new
    var post  = {macid: res[0]};
    //if(res[2].substring()){ //check if the data is corrupt or not by checking the third parameter, string

      connection.query('SELECT EXISTS(SELECT * FROM devices WHERE ?) as find',post, function(err, rows, fields) {
      //console.log('Inside client connected '+val);
      
        if (err) 
          log.error(err);
        else{
            var find=rows[0]['find'];
           // console.log('Inside client connected '+find);
           if(find==0){ //check device is the new one, find=0 means new device found, no previous entry in the table
               var devdis='INSERT INTO devices VALUES (DEFAULT,NULL,\''+post.macid+'\',NULL,2,1, DEFAULT,NULL,\''+res[2]+'\')';
                connection.query(devdis, function(err, rows, fields) { //insert into the table 
                  if (err) 
                  log.error(err);
                  else
                    log.info('New Sensor Device found, adding '+post.macid+' into device table');
                  });
           }

           else{
               log.info('Device '+post.macid+' sent new data');
               var devdis='UPDATE devices SET status=1, seen= now() where status in (0,2) and macid=\''+post.macid+'\'';
               connection.query(devdis, function(err, rows, fields) { //updating device status as online if it reconnects
                  if (err) 
                    log.error(err);
                 // else
                   // log.info('Device '+post.macid+' is online');
              
                });
               var jsonS={
                     "deviceId":post.macid,
                     "status":1
               };
               sendAll(jsonS);//sending  online status to website
            }

         }
       });
    ///
    if(res[2]==='bthm')
    {
      //console.log(res[3]);//gets battery
      //console.log(res[4]);//gets temp
      //console.log(res[5]);//gets humidity
     // console.log(res[6]);//gets moisture
      if(!isNaN(res[3])&&!isNaN(res[4])&&!isNaN(res[5])&&!isNaN(res[6]))
      {
        var sensorVal='INSERT INTO feeds VALUES (DEFAULT,\''+res[0]+'\','+res[1]+',\''+res[2]+'\','+res[3]+','+res[4]+','+res[5]+','+res[6]+',DEFAULT,DEFAULT,NULL,NULL,NULL,NULL,NULL,NULL)';
        connection.query(sensorVal, function(err, rows, fields) { //insert into the feed table 
          if (err)
            log.error('Error in inserting serial data, error: '+err+', time: '+date);
         // else
            // log.info('Feed added for '+res[0]+' on '+date);
          });
        var jsonS={
            "deviceId":res[0],
             "packetNo":res[1],
             "deviceType":res[2],
             "batValue":res[3],
             "tempValue":res[4],
             "humidityValue":res[5],
             "moistValue":res[6]
        };
        sendAll(jsonS); //sending live stata points for the chart to all clients
      }
      else
         log.warn('Packet is corrupted, client id: '+res[0]+' '+date);
    }
    else if(res[2]==='bm')
    {
      var sensorVal='INSERT INTO feeds VALUES (DEFAULT,\''+res[0]+'\','+res[1]+',\''+res[2]+'\',NULL, NULL, NULL,'+res[3]+',DEFAULT,DEFAULT,NULL,NULL,NULL,NULL,NULL,NULL)';
      connection.query(sensorVal, function(err, rows, fields) { //insert into the feed table 
        if (err)
         log.error('Error in inserting serial data, error: '+err+', time: '+date);
        else
           log.info('Feed added for '+res[0]+' on '+date);
        });
    }
    //count++;
    //console.log('data count : ' + count);
  //}
  //else
       //  log.warn('Packet is corrupted, client id: '+res[0]+' '+date);
  });
  serialPort.on('error', function(errors) {
     log.error('error in reading: ' + errors);
  });

});
/****************implementing websocket***********/
wss.on('connection', function(ws) {
  wscon=ws;
  var client_uuid=uuid.v4();
  clients.push({"id": client_uuid, "ws": wscon});//adds client detail
  log.info('client [%s] connected',client_uuid);     

 /* wscon.on('message', function(message) {
    var stock_request = JSON.parse(message);
  });*/

  wscon.on('close', function() {
       log.info("web socket connection closed ",client_uuid);
      wscon=null;
  });
});


//////////////////////////////////
/******************broadcast*****************/
function sendAll(jsonS){  //
  if(wscon!=null){//sending data via websocket
      if(wscon.readyState == 1) {
            for(var i=0; i<clients.length; i++) {
                var client = clients[i].ws;
                if(client.readyState != client.OPEN){ //checking for dead socket
                    log.error('Client state is ' + client.readyState);
                }
                else{
                    //log.info('client [%s]: %s', clients[i].id, jsonS);
                    client.send(JSON.stringify(jsonS));//sending status to webpage of the current state of the device
                }
                
            }
      }
    }
}
////////////////////////////

setInterval(function() { 
  //checking for sensor device is offline or not
  var checkstatus='Update devices SET status=0, seen=now() where macid in (select feeds.device_id from  (Select device_id, MAX(id) as cid  from feeds where device_type!=1 group by device_id) as temp left join feeds on temp.cid= feeds.id where now()-feeds.created_at>275) and status not in (0,2)';
  connection.query(checkstatus, function(err, rows, fields) { //update the table 
      if (err)
        log.error("MYSQL ERROR "+err);
    //  else{
        //console.log('Devices Entry Updated, Set to 0');
       // log.info('Done checking Sensor device status');
     // }
  });

 }, 2000);