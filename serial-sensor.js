var env = require('./settings');//importing settings file, environment variables
/**************thingSpeak client**************/
var ThingSpeakClient = require('thingspeakclient');
var client = new ThingSpeakClient({
  server:'http://10.129.139.139:3000',
  updateTimeout:20000
});

/***************Adding websocket feature*******/
//var uuid = require('node-uuid');
//var WebSocketServer = require('ws').Server,
//    wss = new WebSocketServer({port: 8181});
var WebSocket = require('ws');
var ws=null;
wsConnect();
//var wscon=null;
//var clients=[];
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
///mysql
var localdb_config={
  host     : env.localhost,
  user     : env.user,
  password : env.password1,
  database : env.database
}
var remote_config={ //for remote
  host     : env.mhost2,
  user     : env.user,
  password : env.password2,
  database : env.database//remote
}
var thingspeak_config={ //for thingspeak
  host     : env.mhost2,
  user     : env.user,
  password : env.password2,
  database : env.database2//thingspeak
}
var connectionlocal = mysql.createConnection(localdb_config);
var connectionRemote = mysql.createConnection(remote_config);
var connectionThingspeak = mysql.createConnection(thingspeak_config);
connectionlocal.connect();//general
connectionRemote.connect();//remote
connectionThingspeak.connect();//thingspeak
//configuration ended
/////serial config
var SerialPort = require("serialport").SerialPort
var serialPort = new SerialPort(env.portNo, {
  baudrate: 9600,
  stopBits: 1,//new editions
  dataBits: 6,
  parity: 'odd'
})
/////////////////
//serial listen
serialPort.on("open", function () {
  log.info(env.portNo+' port opened');
  serialPort.flush();//flushing previous data
  attachChannels(); //attaching the api-keys
  //console.log('open');
  var count=0
  var res, dataout;
  serialPort.on('error', function(err) {
    log.error("Some error in reading the data "+err);
    var jsonS={
         "action":'Serial Error',
         "data"  :"Some error in reading the data "+err
    };
    sendAll(jsonS);//sending button status to all device
  });
  serialPort.on('disconnect', function(disc) {
    log.error("Port closed: "+disc);
    var jsonS={
         "action":'Serial Error',
         "data"  :"Port closed: "+disc
    };
    sendAll(jsonS);//sending button status to all device
  });
  serialPort.on('data', function(data) {
    log.info('data received: '+data);
    var jsonS={
         "action":'Serial data',
         "data"  :"data received: "+data
    };
    sendAll(jsonS);//sending button status to all device
    
    
    //console.log("Time: "+date);

    dataout=String(data);
    res = dataout.split(",");//getting strings
   // console.log(res[0]);//stores device id
    //console.log(res[1]);//stored packet number or id
   // console.log(res[2]);//gets device type
    
    
    //find if the device is new
    var post  = {macid: res[0]};
    //if(res[2].substring()){ //check if the data is corrupt or not by checking the third parameter, string

      connectionRemote.query('SELECT EXISTS(SELECT * FROM devices WHERE deviceId=\''+post.macid+'\') as find', function(err, rows, fields) {
      //console.log('Inside client connected '+val);
      
        if (err) 
          log.error(err);
        else{
            var find=rows[0]['find'];
           // console.log('Inside client connected '+find);
           if(find==0){ //check device is the new one, find=0 means new device found, no previous entry in the table
               //var devdis='INSERT INTO devices VALUES (DEFAULT,NULL,\''+post.macid+'\',NULL,2,1, DEFAULT,NULL,\''+res[2]+'\')';
               var thingspeak=null;
               if(res[2]==='bthm'){//for bthm
                  var devdis='INSERT INTO devices(deviceId, description, type, switches, field1, field2, field3, field4, field5, field6) VALUES (\''+post.macid+'\', \'It records battery, temperature, humidity and moisture value\', 2,0, \'bthm\', \'packetId\', \'battery\', \'temperature\', \'humidity\', \'moisture\')';//table restructured
                  thingspeakchannelrow={
                      'api_key' : env.apiKey,
                      'name'    : res[0],
                      'description' : 'It records battery, temperature, humidity and moisture value',
                      'field1'  :'batValue',
                      'field2'  :'tempValue',
                      'field3'  :'humidValue',
                      'field4'  :'moistValue',
                      'field5'  :'packetId'
                  }
               }
               else if(res[2]==='b'){//for hub
                  var devdis='INSERT INTO devices(deviceId, description, type, switches, field1, field2, field3) VALUES (\''+post.macid+'\', \'It is a Hub conneccting various sensor nodes\', 2,0, \'b\', \'packetId\', \'battery\')';//for the normal Hub connection
                  thingspeakchannelrow={
                      'api_key' : env.apiKey,
                      'name'    : res[0],
                      'description' : 'It is a Hub conneccting various sensor nodes',
                      'field1'  :'batValue',
                      'field2'  :'packetId'
                  }
               }
               else if(res[2]==='bm'){//for moisture only sensor
                  var devdis='INSERT INTO devices(deviceId, description, type, switches, field1, field2, field3, field4) VALUES (\''+post.macid+'\', \'It records battery and moisture value\', 2,0, \'bm\', \'packetId\', \'battery\', \'moisture\')';//for the moisture sensor only
                  thingspeakchannelrow={
                      'api_key' : env.apiKey,
                      'name'    : res[0],
                      'description' : 'It records battery and moisture value',
                      'field1'  :'batValue',
                      'field2'  :'moistValue',
                      'field3'  :'packetId'
                  }
               }
                connectionlocal.query(devdis, function(err, rows, fields) { //insert into the table 
                  if (err) 
                  log.error(err);
                  else{
                    log.info('New Sensor Device found, adding '+post.macid+' into device table');
                    var jsonS={
                         "action":'Device',
                         "data"  :"New Sensor Device found, adding "+post.macid+" into device table"
                    };
                    sendAll(jsonS);//sending button status to all device
                    client.createChannel(1, thingspeakchannelrow, function(err) {
                      if (!err) {//channel creation done
                          log.info('New channel created for sensor: '+res[0]+' type '+res[2]);
                          var jsonS={
                               "action":'thingspeak',
                               "data"  :"New channel created for sensor: "+res[0]+" type "+res[2]
                          };
                          sendAll(jsonS);//sending button status to all device
                          attachChannel(res[0]);//attaching the channel;
                      }
                      else
                      {
                        console.log(err)
                      }
                     });
                    connectionRemote.query(devdis, function(err, rows, fields) { //insert into the remote table 
                      if (err) 
                      log.error(err);
                      else{
                        log.info('New Sensor Device found, adding '+post.macid+' into Remote device table');
                      }
                    });
                  }
                });
                  
           }

           else{
             log.info('Device '+post.macid+' sent new data');
            //var devdis='UPDATE devices SET status=1, seen= now() where status in (0,2) and macid=\''+post.macid+'\'';
             deviceStatus(post.macid, function(status,row){
                if(status==0){//insert only if the last row for that device was vice versa
                  var devdis='INSERT INTO deviceStatus VALUES (DEFAULT,\''+row+'\',1, DEFAULT)';
                  connectionlocal.query(devdis, function(err, rows, fields) { //update the table //query3
                    if (err)
                      log.error("MYSQL ERROR "+err);
                    else{
                      //log.info('Devices Entry for '+rows[0].device_id+'Updated, Set to 0/offline');
                      log.info('Device '+row+' went online');
                          connectionRemote.query(devdis, function(err, rows, fields) { //update the remote table //query3
                        if (err)
                          log.error("MYSQL ERROR "+err);
                        else{
                          //log.info('Devices Entry for '+rows[0].device_id+'Updated, Set to 0/offline');
                          log.info('Updated remote table for the online status');
                        }
                      });
                    }
                  });
                }
                else if (status==2){//if no last row exists
                  var devdis='INSERT INTO deviceStatus VALUES (DEFAULT,\''+row+'\',1, DEFAULT)';
                  connectionlocal.query(devdis, function(err, rows, fields) { //update the table //query3
                    if (err)
                      log.error("MYSQL ERROR "+err);
                    else{
                      //log.info('Devices Entry for '+rows[0].device_id+'Updated, Set to 0/offline');
                      log.info('Device '+row+' went online');
                      connectionRemote.query(devdis, function(err, rows, fields) { //update the remote table //query3
                        if (err)
                          log.error("MYSQL ERROR "+err);
                        else{
                          //log.info('Devices Entry for '+rows[0].device_id+'Updated, Set to 0/offline');
                          log.info('Updated remote table for the online status');
                        }
                      });
                    }
                  });
                }
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
        var sensorVal='INSERT INTO feeds(device_Id, field1, field2, field3, field4, field5, field6) VALUES (\''+res[0]+'\',\''+res[2]+'\',\''+res[1]+'\',\''+res[3]+'\',\''+res[4]+'\',\''+res[5]+'\',\''+res[6]+'\')';
        connectionlocal.query(sensorVal, function(err, rows, fields) { //insert into the feed table 
          if (err)
            log.error('Error in inserting serial data, error: '+err);
          else{
            // log.info('Feed added for '+res[0]+' on '+date);
            connectionRemote.query(sensorVal, function(err, rows, fields) { //insert into the remote feed table 
              if (err){
                log.error('Error in inserting serial data, error: '+err);
                var jsonS={
                     "action":'Error',
                     "data"  :"Error in inserting serial data, error: "+err
                };
                sendAll(jsonS);//sending button status to all device
              }
              else
                 log.info('Remote feed updated with new data');
            });
          }
          });
          var jsonS={
            "deviceId":res[0],
            "action": 'data',
             "packetNo":res[1],
             "deviceType":res[2],
             "batValue":res[3],
             "tempValue":res[4],
             "humidityValue":res[5],
             "moistValue":res[6]
          };
          sendAll(jsonS);//to websocket client
          findChannel(res[0], function(channel_Id){//updating the thingspeak feed
                client.updateChannel(channel_Id, { "field1":res[3],"field2":res[4],"field3":res[5],"field4":res[6],"field5":res[1]}, function(err, resp) {
                if (!err && resp > 0) {
                    log.info('Thingspeak feed update successfully for channel id '+channel_Id);
                    var jsonS={
                         "action":'thingspeak',
                         "data"  :"Thingspeak feed update successfully for channel id "+channel_Id
                    };
                    sendAll(jsonS);//sending button status to all device
                }
                });
             

          });

          
      }
      else
         log.warn('Packet is corrupted, client id: '+res[0]);
    }
    else if(res[2]==='bm')
    {
      var sensorVal='INSERT INTO feeds(device_Id, field1, field2, field3, field4) VALUES (\''+res[0]+'\',\''+res[2]+'\',\''+res[1]+'\',\''+res[3]+'\',\''+res[4]+'\')';//only battery and moisture
      connectionlocal.query(sensorVal, function(err, rows, fields) { //insert into the feed table 
        if (err){
         log.error('Error in inserting serial data, error: '+err);
         var jsonS={
               "action":'Error',
               "data"  :"Error in inserting serial data, error: "+err
          };
          sendAll(jsonS);//sending button status to all device
        }
        else{
           //log.info('Feed added for '+res[0]+' on '+date);
           connectionRemote.query(sensorVal, function(err, rows, fields) { //insert into the feed table 
              if (err){
                 log.error('Error in inserting serial data, error: '+err);
                 var jsonS={
                       "action":'Error',
                       "data"  :"Error in inserting serial data, error: "+err
                  };
                  sendAll(jsonS);//sending button status to all device
               }
              else
                 log.info('Remote feed updated with new data');
            });
         }
      });
      var jsonS={
        "deviceId":res[0],
        "action": 'data',
         "packetNo":res[1],
         "deviceType":res[2],
         "batValue":res[3],
         "moistValue":res[4]
      };
      sendAll(jsonS);//to websocket client
      findChannel(res[0], function(channel_Id){//updating the thingspeak feed
            client.updateChannel(channel_Id, { "field1":res[3],"field2":res[4],"field3":res[1]}, function(err, resp) {
            if (!err && resp > 0) {
                log.info('Thingspeak feed update successfully for channel id '+channel_Id);
                var jsonS={
                     "action":'thingspeak',
                     "data"  :"Thingspeak feed update successfully for channel id "+channel_Id
                };
                sendAll(jsonS);//sending button status to all device
            }
            });
         

      });

    }
    else if(res[2]==='b')
    {
      var sensorVal='INSERT INTO feeds(device_Id, field1, field2, field3) VALUES (\''+res[0]+'\',\''+res[2]+'\',\''+res[1]+'\',\''+res[3]+'\')';//only battery
      connectionlocal.query(sensorVal, function(err, rows, fields) { //insert into the feed table 
        if (err)
         log.error('Error in inserting serial data, error: '+err);
        else{
           //log.info('Feed added for '+res[0]+' on '+date);
           connectionRemote.query(sensorVal, function(err, rows, fields) { //insert into the feed table 
              if (err){
               log.error('Error in inserting serial data, error: '+err);
               var jsonS={
                     "action":'Error',
                     "data"  :"Error in inserting serial data, error: "+err
                };
                sendAll(jsonS);//sending button status to all device
              }
              else
                 log.info('Remote feed updated with new data');
            });
         }
      });
      var jsonS={
        "deviceId":res[0],
        "action": 'data',
         "packetNo":res[1],
         "deviceType":res[2],
         "batValue":res[3]
      };
      sendAll(jsonS);//to websocket client
      findChannel(res[0], function(channel_Id){//updating the thingspeak feed
            client.updateChannel(channel_Id, { "field1":res[3],"field2":res[1]}, function(err, resp) {
            if (!err && resp > 0) {
                log.info('Thingspeak feed update successfully for channel id '+channel_Id);
                var jsonS={
                     "action":'thingspeak',
                     "data"  :"Thingspeak feed update successfully for channel id "+channel_Id
                };
                sendAll(jsonS);//sending button status to all device
            }
            });
         

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
/*wss.on('connection', function(ws) {
  wscon=ws;
  var client_uuid=uuid.v4();
  clients.push({"id": client_uuid, "ws": wscon});//adds client detail
  log.info('client [%s] connected',client_uuid);
     

  ws.on('message', function(message) {
    var stock_request = JSON.parse(message);
  });

  ws.on('close', function() {
      console.log("connection closed");
      wscon=null;
  });
});*/
/**************************************Websocket con*********************************/
function wsConnect() {//creating a websocket connection to the mosca-mysql-server.js for transfering the sensor value to the latter script
    ws = new WebSocket("ws://10.129.139.139:8180");
    ws.onopen = function() {
      console.log('connected');
    };
   /* ws.onmessage = function(msg) {
      console.log(msg);
    };
*/
    ws.onclose = function(evt) {
      if (evt.code == 3110) {
        console.log('ws closed');
        ws = null;
      } 
      else {
        ws = null;
        console.log('ws connection error');
        var jsonS={
             "action":'Error',
             "data"  :"unable to send the sensor data, reconnecting to mosca-mysql-server"
        };
        sendAll(jsonS);//sending button status to all device
      }
    };

    ws.onerror = function(evt) {
      //if (ws.readyState == 1) {
        console.log('ws normal error: ' + evt.type);
      //}
    };
}
/******************broadcast*****************/
function sendAll(jsonS){  //
  if(ws!=null){//sending data via websocket
    try{
      ws.send(JSON.stringify(jsonS));
    }
    catch(e){
      //wsConnect();
      console.log('unable to send the sensor data, reconnecting to mosca-mysql-server');
      var jsonS={
           "action":'Error',
           "data"  :"unable to send the sensor data, reconnecting to mosca-mysql-server"
      };
      sendAll(jsonS);//sending button status to all device
      wsConnect();
    }
  }
  else
    wsConnect();
}
//////////////////////////////////


setInterval(function() { 
  //checking for sensor device is offline or not
  //var query='Select feeds.device_id from  (Select device_id, MAX(id) as cid  from feeds where device_type!=1 group by device_id) as temp left join feeds on temp.cid= feeds.id where now()-feeds.created_at>275';
  var query="Select *, TIMEDIFF(now(),feeds.created_at) from (Select device_id, MAX(id) as cid from feeds where field1!=1 group by device_id) as temp left join feeds on temp.cid= feeds.id where TIMEDIFF(now(),feeds.created_at)>STR_TO_DATE('00:04:35','%H:%i:%s')";
  //var checkstatus='Update devices SET status=0, seen=now() where macid in (select feeds.device_id from  (Select device_id, MAX(id) as cid  from feeds where device_type!=1 group by device_id) as temp left join feeds on temp.cid= feeds.id where now()-feeds.created_at>275) and status not in (0,2)';
  connectionRemote.query(query,function(err,rows,fields){//query 1
    try{
      if(rows.length>0){
            if(err)
            log.error('Error in getting devid of the sensor, '+err);
            else{
              for (var j=0;j<rows.length;j++)//going through all the macid
              {
                  deviceStatus(rows[j].device_id, function(status,row){
                      if(status==1){//insert only if the last row for that device was vice versa
                        var devdis='INSERT INTO deviceStatus VALUES (DEFAULT,\''+row+'\',0, DEFAULT)';
                        connectionlocal.query(devdis, function(err, rows, fields) { //update the table //query3
                          if (err)
                            log.error("MYSQL ERROR "+err);
                          else{
                            //log.info('Devices Entry for '+rows[0].device_id+'Updated, Set to 0/offline');
                            log.info('Device '+row+' went offline');
                            connectionRemote.query(devdis, function(err, rows, fields) { //update the remote table //query3
                              if (err)
                                log.error("MYSQL ERROR "+err);
                              else{
                                //log.info('Devices Entry for '+rows[0].device_id+'Updated, Set to 0/offline');
                                log.info('Remote entry for device offline');
                                var jsonS={
                                       "deviceId":row,
                                       "status":1
                                 };
                                 sendAll(jsonS);//sending  online status to website
                              }
                            });
                          }
                        });
                      }
                      else if (status==2){//if no last row exists
                        var devdis='INSERT INTO deviceStatus VALUES (DEFAULT,\''+row+'\',0, DEFAULT)';
                        connectionlocal.query(devdis, function(err, rows, fields) { //update the table //query3
                          if (err)
                            log.error("MYSQL ERROR "+err);
                          else{
                            //log.info('Devices Entry for '+rows[0].device_id+'Updated, Set to 0/offline');
                            log.info('Device '+row+' went offline');
                            connectionRemote.query(devdis, function(err, rows, fields) { //update the remote table //query3
                              if (err)
                                log.error("MYSQL ERROR "+err);
                              else{
                                //log.info('Devices Entry for '+rows[0].device_id+'Updated, Set to 0/offline');
                                log.info('Remote entry for device offline');
                                var jsonS={
                                         "deviceId":row,
                                         "status":1
                                   };
                                   sendAll(jsonS);//sending  online status to website
                                }
                            });
                          }
                        });
                      }
                   });                
              }//end of for loop
                
            }
      }
    }
    catch(e){
      log.error('Error struck '+e);
    }
  });
 }, 10000);

/******************************
*function: attachChannels()
*
*logic: it attaches the apikeys to their channel ids
*so that their feeds can be updated on the fly
*
*/
function attachChannels(){
      var query='Select api_key, channel_id from api_keys where write_flag=1';
      connectionThingspeak.query(query,function(err,rows,fields){
      if(err)
        log.error('Error in checking apikeys, thingspeak, '+err);
      else{
        for (var j=0;j<rows.length;j++)//going through all the macid
        {
            log.info("attaching apikey for channel id "+rows[j].channel_id)
            client.attachChannel(rows[j].channel_id, { writeKey:rows[j].api_key});
            var jsonS={
                 "action":'thingspeak',
                 "data"  :"attaching apikey for channel id "+rows[j].channel_id
            };
            sendAll(jsonS);//sending button status to all device
        }
      
      }
  });
}

/******************************
*function: attachChannel(name)
*input: takes channel name
*logic: attaches apikey to the newly added channel id
*
*/
function attachChannel(name){
      var query='Select channel_id from channels where name='+name;
      findChannel(name, function(channel_Id){//updating the thingspeak feed

            var query='Select api_key from api_keys where write_flag=1 and channel_id='+channel_Id;  //findapikey
            connectionThingspeak.query(query,function(err,rows,fields){
      				if(rows.length>0){
      		          if(err)
      		          log.error('Error in checking apikey, thingspeak, '+err);
      		          else{
      		              client.attachChannel(channel_Id, { writeKey:rows[0].api_key});
      		              log.info("Apikey "+rows[0].api_key+" attached to channel id "+channel_Id);
                        var jsonS={
                             "action":'thingspeak',
                             "data"  :"Apikey "+rows[0].api_key+" attached to channel id "+channel_Id
                        };
                        sendAll(jsonS);//sending button status to all device
      		          }
      				}
            });

      });
}

/******************************
*function: findChannel(name, callback)
*input: takes channel name
*output; callback, returns the concerend channel id
*logic: finds channel id by the channel name, it will be used for 
*updating the concerend channel id feed
*
*/
function findChannel(name, callback){
    var query='Select id from channels where name='+name;
    connectionThingspeak.query(query,function(err,rows,fields){
      if(err)
        log.error('Error in finding channel id, thingspeak, '+err);
      else{
        //log.info('Channel id  ',rows[0].id," for sensor ",name);
        if(rows.length>0)
          callback(rows[0].id);
        else
          callback(0);//no id found
      }
  });
}

/******************************
*function: deviceStatus(name, callback)
*input: takes device_id from feeds
*output; callback, returns the concerned status of the device in the deviceStatus
*logic: check if theire is any previous entry of the deivce in deviceStatus table
*also if the previous entry for the status was1
*
*/
function deviceStatus(row, callback){
    var devid='Select status from deviceStatus where deviceId=\''+row+'\' order by id desc limit 1';
    connectionRemote.query(devid, function(err, drows, fields) { //update the table //query2
      if (err)
        log.error("MYSQL ERROR "+err);
      else{
        if(drows.length>0){
          callback(drows[0].status,row);
        }
        else{//if no last row exists
          callback(2,row);//2 is arbitrary, but should not be 0
        }
      }
    });
}

/******************************
*function: remoteDisconnect()
*input: none
*output; return new connection to mysql db
*logic: check if connection is lost, then tries to connect again, for handling thingspeak connection
*
*********************************/
function remoteDisconnect() {
  connectionRemote = mysql.createConnection(remote_config); // Recreate the connection, since
                                                  // the old one cannot be reused.

  connectionRemote.connect(function(err) {              // The server is either down
    if(err) {                                     // or restarting (takes a while sometimes).
     //log.error('error when connecting to db:', err);
      setTimeout(remoteDisconnect, 2000); //introduce a delay before attempting to reconnect,
    }                                     // to avoid a hot loop, and to allow our node script to
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  connectionRemote.on('error', function(err) {
    //log.error('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      remoteDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}


//check if connection has fallen then to this, error caching
connectionRemote.on('error', function(err) {
    log.error('thingspeak db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      remoteDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
}
});

/******************************
*function: thingspeakDisconnect()
*input: none
*output; return new connection to mysql db
*logic: check if connection is lost, then tries to connect again, for handling thingspeak connection
*
*********************************/
function thingspeakDisconnect() {
  connectionThingspeak = mysql.createConnection(remote_config); // Recreate the connection, since
                                                  // the old one cannot be reused.

  connectionThingspeak.connect(function(err) {              // The server is either down
    if(err) {                                     // or restarting (takes a while sometimes).
     //log.error('error when connecting to db:', err);
      setTimeout(thingspeakDisconnect, 2000); //introduce a delay before attempting to reconnect,
    }                                     // to avoid a hot loop, and to allow our node script to
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  connectionThingspeak.on('error', function(err) {
    //log.error('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      thingspeakDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}


//check if connection has fallen then to this, error caching
connectionThingspeak.on('error', function(err) {
    log.error('thingspeak db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      thingspeakDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
}
});

/******************************
*function: localdbDisconnect()
*input: none
*output; return new connection to mysql db
*logic: check if connection is lost, then tries to connect again, for handling localdb connection
*
*********************************/
function localdbDisconnect() {
  connectionlocal = mysql.createConnection(localdb_config); // Recreate the connection, since
                                                  // the old one cannot be reused.

  connectionlocal.connect(function(err) {              // The server is either down
    if(err) {                                     // or restarting (takes a while sometimes).
     //log.error('error when connecting to db:', err);
      setTimeout(localdbDisconnect, 2000); //introduce a delay before attempting to reconnect,
    }                                     // to avoid a hot loop, and to allow our node script to
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  connectionlocal.on('error', function(err) {
    //log.error('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      localdbDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}

connectionlocal.on('error', function(err) {
    log.error('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      localdbDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });

