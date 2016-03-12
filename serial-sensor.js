var env = require('./settings');//importing settings file, environment variables
/**************thingSpeak client**************/
var ThingSpeakClient = require('thingspeakclient');
var client = new ThingSpeakClient({
  server:'http://0.0.0.0:3000',
  updateTimeout:20000
});

/***************Adding websocket feature*******/
var uuid = require('node-uuid');
var WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({port: 8181});
var wscon=null;
var clients=[];
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
var thingspeak = mysql.createConnection({ //for thingspeak
  host     : env.localhost,
  user     : env.user,
  password : env.password,
  database : env.database2//thingspeak
});
connection.connect();//general
thingspeak.connect();//thingspeak
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
  attachChannels(); //attaching the api-keys
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
                  else{
                    log.info('New Sensor Device found, adding '+post.macid+' into device table');
                    client.createChannel(1, { 'api_key':env.apiKey,'name':res[0], 'field1':'batValue','field2':'tempValue','field3':'humidValue','field4':'moistValue','field5':'packetID'}, function(err) {
                      if (!err) {//channel creation done
                          log.info('New channel created for sensor: '+res[0]);
                          attachChannel(res[0]);//attaching the channel;
                      }
                      else
                      {
                        console.log(err)
                      }
                     });
                  }
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
          sendAll(jsonS);//to websocket client
          findChannel(res[0], function(channel_Id){//updating the thingspeak feed
                client.updateChannel(channel_Id, { "field1":res[3],"field2":res[4],"field3":res[5],"field4":res[6],"field5":res[1]}, function(err, resp) {
                if (!err && resp > 0) {
                    log.info('Thingspeak feed update successfully for channel id '+channel_Id);
                }
                });
             

          });

          
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
     

  ws.on('message', function(message) {
    var stock_request = JSON.parse(message);
  });

  ws.on('close', function() {
      console.log("connection closed");
      wscon=null;
  });
});

/******************broadcast*****************/
function sendAll(jsonS){  //
  if(wscon!=null){//sending data via websocket
      if(wscon.readyState == 1) {
            for(var i=0; i<clients.length; i++) {
                var client = clients[i].ws;
                if(client.readyState != client.OPEN){ //checking for dead socket
                    //log.error('Client state is ' + client.readyState+' that is unresponsive');
                }
                else{
                    //log.info('client [%s]: %s', clients[i].id, jsonS);
                    client.send(JSON.stringify(jsonS));//sending status to webpage of the current state of the device
                }
                
            }
      }
    }
}
//////////////////////////////////


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

/******************************
*function: attachChannels()
*
*logic: it attaches the apikeys to their channel ids
*so that their feeds can be updated on the fly
*
*/
function attachChannels(){
      var query='Select api_key, channel_id from api_keys';
      thingspeak.query(query,function(err,rows,fields){
      if(err)
        log.error('Error in checking apikeys, thingspeak, '+err);
      else{
        for (var j=0;j<rows.length;j++)//going through all the macid
        {
            log.info("attaching apikey for channel id "+rows[j].channel_id)
            client.attachChannel(rows[j].channel_id, { writeKey:rows[j].api_key});
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
              
            var query='Select api_key from api_keys where channel_id='+channel_Id;  //findapikey
            thingspeak.query(query,function(err,rows,fields){
              if(err)
              log.error('Error in checking apikey, thingspeak, '+err);
              else{
                  client.attachChannel(channel_Id, { writeKey:rows[0].api_key});
                  log.info("Apikey "+rows[0].api_key+" attached to channel id "+channel_Id);
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
    thingspeak.query(query,function(err,rows,fields){
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

