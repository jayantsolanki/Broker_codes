var mosca = require('mosca');
var env = require('./settings');//importing settings file, environment variables
/**************thingSpeak client**************/
var ThingSpeakClient = require('thingspeakclient');
var TSclient = new ThingSpeakClient({
  server:'http://10.129.28.181:3000',
  updateTimeout:20000
});

/***************Adding websocket feature*******/
var uuid = require('node-uuid');
var WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({port: 8180});
var wscon=null;
var clients=[];
  ///////////////////////
////initiating the bunyan log
var Logger = require('bunyan');
var log = new Logger({name:'ESP-Valve', 
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
/////serial config
/*var SerialPort = require("serialport").SerialPort
var serialPort = new SerialPort(env.portNo, {
  baudrate: 9600
})*/
/////////////////
var id, start,stop,action,currentime, item, macid, type, flag=1;
//mqtt config
var mqtt    = require('mqtt');
var mqttaddress=env.mqtt;

//mysql configuration
var mysql      = require('mysql');
/////////////////////////////////
///mongo config
var ascoltatore = {
  //using ascoltatore
  type: 'mongo',        
  url: 'mongodb://localhost:27017/mqtt',
  pubsubCollection: 'ascoltatori',
  mongo: {}
};

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
 
var settings = {
  port: env.mport,
  host: env.mhost,
  backend: ascoltatore,
  persistence: {
    factory: mosca.persistence.Mongo,
    url: 'mongodb://localhost:27017/mqtt'
  }
};

///////////////
// Accepts the connection if the username and password are valid
var authenticate = function(client, username, password, callback) {
  var authorized = (username === 'admin' && password.toString() === 'password');
  if (authorized) client.user = username;
  callback(null, authorized);
}

// In this case the client authorized as admin can publish to topic taking
// the username from the topic and verifing it is the same of the authorized user
var authorizePublish = function(client, topic, payload, callback) {
  callback(null, client.user == topic.split('/')[1]);
}

// In this case the client authorized as admin can subscribe to /users/alice taking
// the username from the topic and verifing it is the same of the authorized user
var authorizeSubscribe = function(client, topic, callback) {
  callback(null, client.user == topic.split('/')[1]);
}
////////////// 
var server = new mosca.Server(settings);
//device discovery
server.on('clientConnected', function(client) {
    var val=client.id;
    //var date = new Date();
   // if(val!='M-O-S-C-A'){ //do not enter client id of server
      var post  = {macid: val};
      var check='SELECT EXISTS(SELECT * FROM devices WHERE macid=\''+val+'\') as find';
      connection.query(check, function(err, rows, fields) {
      //console.log('Inside client connected '+val);
      
        if (err) 
        log.error("MYSQL ERROR "+err);
        else{
            var find=rows[0]['find'];
           // console.log('Inside client connected '+find);
            var regex = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/;
            //console.log('Mac id is valid? '+regex.test(post.macid));
            if(find==0){ //check device is the new one, find=0 means new device found, no previous entry in the table
              if(regex.test(post.macid))//check if the client id is the macid
              {
                var devdis='INSERT INTO devices VALUES (DEFAULT,NULL,\''+post.macid+'\',NULL,2,1, DEFAULT,NULL,NULL)'
                connection.query(devdis, function(err, rows, fields) { //insert into the table 
                  if (err) 
                    log.error("MYSQL ERROR "+err);
                  else{
                    log.info('New Device found, adding '+post.macid+' into device table');
                    TSclient.createChannel(1, { 'api_key':env.apiKey,'name':post.macid, 'field1':'batValue', 'field2':'packetID'}, function(err) {
                      if (!err) {//channel creation done
                          log.info('New channel created for new Valve: '+post.macid);
                          attachChannel(post.macid);//attaching the channel;
                      }
                      else
                      {
                        console.log(err)
                      }
                    });
                  }
                });

              }
            }
          
            else{
              log.info('Device '+post.macid+' reconnected ');
              var devdis='UPDATE devices SET status=1, seen= now() where status!=2 and macid=\''+post.macid+'\'';
              connection.query(devdis, function(err, rows, fields) { //updating device status as online if it reconnects
                if (err)
                  log.error("MYSQL ERROR "+err);
                //else
                 // console.log('Device '+post.macid+' marked online '+date);
            
              });
              var jsonS={
                     "deviceId":val,
                     "status":1
               };
               sendAll(jsonS);//sending  online status to website
            }
          }
      });
   // }
    //console.log('client connected', client.id);
});

server.on('unsubscribed', function(topic, client) { //checking if the device goes offline
    var val=client.id;
    //var date = new Date();
    log.info('client unsubscribed', client.id);
    var offlineq='UPDATE devices SET status=0, seen= now() where status!=2 and macid= \''+client.id.toString()+'\'';
    connection.query(offlineq, function(err, rows, fields) { //updating device status as online if it reconnects
      if (err) 
        log.error("MYSQL ERROR "+err);
      //else
        //console.log('Device '+client.id.toString()+' marked offline '+date);
  
    });
    var jsonS={
         "deviceId":val,
         "status":0
   };
   sendAll(jsonS);//sending  offline status to website

});

//
server.on('clientDisconnected', function( client) { //checking if the device goes disconnect
    var val=client.id;
    //var date = new Date();
    log.info('client disconnected', client.id);
    var offlineq='UPDATE devices SET status=0, seen= now() where status!=2 and macid= \''+client.id.toString()+'\'';
    connection.query(offlineq, function(err, rows, fields) { //updating device status as online if it reconnects
      if (err) 
        log.error("MYSQL ERROR "+err);
      //else
        //console.log('Device '+client.id.toString()+' marked disconnected/Offline '+date);

    });
    var jsonS={
         "deviceId":val,
         "status":0
    };
    sendAll(jsonS);//sending  offline status to website

});
//
 
// fired when a message is received 
server.on('published', function(packet) {
  //var date = new Date();
  var topic=packet.topic; //get value of payload
  var regex1 = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/;
  topic=topic.toString();
  if(regex1.test(packet)){
    log.info('Client id is ',packet);
    log.info('Published topic '+packet.topic);
    log.info('Published payload '+packet.payload);
  }
  //if(true){ //this could be improved
  var batmacid=topic.substring(4,21);
  //console.log('Mac id publsihed '+batmacid);
  var regex = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/;
  if(regex.test(batmacid)){ //check if valid macid there

    var isbattery=topic.substring(22,topic.length);
    var batmac  = {macid: batmacid};
    if(isbattery=='battery')
    {
      //console.log("I am a battery");
      var msg=packet.payload;
     // msg=Integer.parseInt(msg);
      //console.log(msg);
      var count=0;
          connection.query('SELECT packet_id from feeds where device_id=\''+batmacid+'\' ORDER BY packet_id DESC LIMIT 1', function(err, rows, fields) {
            if (!err){
              if(rows.length>0){//check if the macid was present already before
                //console.log('The solution is: ', rows[rows.length-1]['packet_id']);
                count=parseInt(rows[0]['packet_id']); //storing last packet id in 
                var batquery='INSERT INTO feeds VALUES (DEFAULT,\''+batmac.macid+'\','+(count+1)+',\''+1+'\','+msg+', NULL, NULL,NULL,DEFAULT,DEFAULT,NULL,NULL,NULL,NULL,NULL,NULL)';
                }
              else
              var batquery='INSERT INTO feeds VALUES (DEFAULT,\''+batmac.macid+'\','+(count+1)+',\''+1+'\','+msg+', NULL, NULL,NULL,DEFAULT,DEFAULT,NULL,NULL,NULL,NULL,NULL,NULL)';
                connection.query(batquery, function(err, rows, fields) { //insert into the feed table
                if (err)
                  log.error("MYSQL ERROR "+err);
                else{
                  log.info('Battery status inserted for device '+batmacid+' with voltage '+msg);
                  var mqttclient  = mqtt.connect(mqttaddress,{encoding:'utf8', clientId: 'M-O-S-C-A'});
                  mqttpub(mqttclient,batmacid,3); //sending hibernate signal, replacing 2 by 3
                  log.info('Published 3 to '+batmacid);
                  mqttclient.end();
                  findChannel(batmacid, function(channel_Id){//updating the thingspeak feed
                      TSclient.updateChannel(channel_Id, { "field1":msg,"field2":(count+1)}, function(err, resp) {
                      if (!err && resp > 0) {
                          log.info('Thingspeak feed update successfully for channel id '+channel_Id);
                      }
                      });
                  });
                }
                });
          }
            else
              log.error('Error while performing Query');
          });
          
        }

  }
     
  
});
 
server.on('ready', setup);
 
// fired when the mqtt server is ready 
function setup() {
 // server.authenticate = authenticate;
 // server.authorizePublish = authorizePublish;
 // server.authorizeSubscribe = authorizeSubscribe;
 
  //var currenttime=date.getTime()
  var tasks = "select * from tasks";
  var minutes = 1, the_interval = 2000; //set time here, every two seconds below code is repeated
  var date = new Date();
  log.info('Mosca server is up and running on '+env.mhost+':'+env.mport);
  setInterval(function() {
    date = new Date();
    connection.query( tasks, function(err, rows){
      if(err) {
        throw err;
      }
      else
      {
        if(rows.length>0)
        {
          for (var i=0;i<rows.length;i++)//implementing scheduled tasks, it should be improved
          {
            id=rows[i]['id'];
            start=rows[i]['start'];
            stop=rows[i]['stop'];
            action=rows[i]['action'];
            item=rows[i]['item'];
            macid=rows[i]['macid'];
            type=rows[i]['type'];
            var date=new Date();
            currenttime=date.getHours()*100+date.getMinutes();
            if(currenttime==0000)
              flag=1; 
            if(currenttime==1830 || currenttime==1830)//check battery status at every 6:30pm
            {
              
              if(flag==1){
                battstatus();
                log.info('Requested for battery status from ESP devices');
              }
              flag=0;
            }
           //group=null;
            //if(macid==null)
            //console.log('global group  is '+group+ '----'+i);
            
            
            //console.log(item);
            /*if(item!=null)
              {
                //var groups='select id from groups where name='+item+'';
                //var check={name:item};
                console.log('check--------'+item);
                connection.query('Select id from groups where name=\''+item+'\'', function(err, grp){
                  
                  if(err) {
                    throw err;
                  }
                  else
                  {
                    group = grp[0]['id'];
                    console.log("group id is "+group);
                  }
                  //console.log("now global group id is "+group+ '------'+i);
                });
              }*/
              
            //  console.log("now global group id is "+group+ '------'+i);
            if(start!=null)
            {

              if(currenttime>=start && currenttime<stop && action==1)//to switch on the valves
              {
                

               // var devices = "select * from devices";
                if(item!=null)
                  var devquery='Select macid from devices left join groups on devices.group=groups.id where groups.name=\"'+item+'\" and devices.type=1';
               // else
                  //var devquery='Select macid from devices where devices.macid=\"'+macid+'\"'; //check this code, it is modifiable, for manual switch on/off
               
                connection.query(devquery, function(err, devs){
                  if(err) {
                    log.error("MYSQL ERROR "+err);
                  }
                  else
                  {
                   // console.log(currenttime);
                      var mqttclient  = mqtt.connect(mqttaddress,{encoding:'utf8', clientId: 'M-O-S-C-A'});
                      log.info("Scheduled task started for switching on the Valves");
                      for (var j=0;j<devs.length;j++)//
                      {
                          log.info("Switched on "+devs[j].macid);
                          mqttpub(mqttclient,devs[j].macid,1);
                      }
                      mqttclient.end();

                  }
                });
                
                  var upd1={action:0};
                  connection.query('UPDATE tasks SET ? where id='+id+'',upd1, function(err, rows, fields) { //update into the table 
                  if (err)
                   log.error("MYSQL ERROR "+err);
                 //else
                   // log.info('Tasks Entry Updated, Set to 0'); // set action to 0 means , next time the valve will be switched off when reached the stop time
                  });


                var upd2={action:1};
                if(item!=null)
                  var query='UPDATE devices SET ? where devices.group in (Select * from (Select devices.group from devices where devices.group in (Select id from groups where groups.name=\"'+item+'\"))tmp)';
                else
                  var query='UPDATE devices SET ? where devices.macid='+macid+'';// action =1 means valve is currently on
                connection.query(query,upd2, function(err, rows, fields) { //update the table 
                if (err)
                  log.error("MYSQL ERROR "+err);
                  //console.log(' Devices Update failed, error:  '+err+' '+date);
                else{
                  //console.log('Devices Entry Updated, Set to 1');
                  log.info('Done executing the tasks');
                }
                });

                //console.log('Done executing the tasks');
                
              }        
            }

            if(stop!=null) //stopping the schduled tasks
            {
              if(currenttime==0000)
                currenttime=2400; //2400 is same as 1200am or 0000

              if(currenttime>=stop && action==0)//to switch on the valves
              {
                if(item!=null)
                  var devquery='Select macid from devices left join groups on devices.group=groups.id where groups.name=\"'+item+'\ and devices.type=1"';
                else
                  var devquery='Select macid from devices where devices.macid=\"'+macid+'\"';
                connection.query( devquery, function(err, devs){
                  if(err) {
                    log.error("MYSQL ERROR "+err);
                  }
                  else
                  {
                   // console.log(currenttime);
                   var mqttclient  = mqtt.connect(mqttaddress,{encoding:'utf8', clientId: 'M-O-S-C-A'});
                   log.info("Scheduled task started for switching off the valves");
                   for (var j=0;j<devs.length;j++)// publishing the message
                   {
                        log.info("Switched off "+devs[j].macid)
                        mqttpub(mqttclient,devs[j].macid,0);
                   }
                   mqttclient.end();
                  }
                });
                if(type==0)
                {
                  //console.log("You are in the deletion zone");
                  connection.query('Delete from tasks where id='+id+'', function(err, rows, fields) { //delete from the table 
                    if (err)
                      log.error("MYSQL ERROR "+err);
                    else
                      log.info('Manual task entry deleted');
                    });
                }
                else
                {
                  var upd1={action:1};
                  connection.query('UPDATE tasks SET ? where id='+id+'',upd1, function(err, rows, fields) { //update the table 
                  if (err)
                    log.error('Update failed');
                  //else
                    //console.log('Tasks Entry Updated, Set to 1');
                  });
                }
                var upd2={action:0};
                if(item!=null)
                  var query='UPDATE devices SET ? where devices.group in (Select * from (Select devices.group from devices where devices.group in (Select id from groups where groups.name=\"'+item+'\"))tmp)';//group valves are selected
                else
                  var query='UPDATE devices SET ? where devices.macid=\''+macid+'\''; // if individual valve is scheduled
                //console.log(macid);
                connection.query(query,upd2, function(err, rows, fields) { //update the table 
                if (err)
                  log.error("MYSQL ERROR "+err);
                else{
                  //console.log('Devices Entry Updated, Set to 0');
                  log.info('Done executing the tasks');
                }
                });

                
                
              }        
            }
          }//end of main loop
          
        }
        //else
          //console.log('Scheduled tasks list empty');

      }
    });
  // do your stuff here
  
}, the_interval);
}
//////////////
function mqttpub(mqttclient,macid,action)//method for publishing the message to esp module
{
   mqttclient.publish('esp/'+macid, action.toString(), {retain:true, qos: 0});
   var jsonS={
         "deviceId":macid,
         "action":action
   };
   sendAll(jsonS);//sending button status to all device
}

// battery status check
function battstatus()
{
  var query='Select macid from devices where type=\'1\'';
  connection.query(query,function(err,rows,fields){
    if(err)
      log.error('Error in checking battery status, '+err);
    else{
      var mqttclient  = mqtt.connect(mqttaddress,{encoding:'utf8', clientId: 'M-O-S-C-A'});
      for (var j=0;j<rows.length;j++)//going through all the macid
      {
          log.info("Checking battery status for device "+rows[j].macid)
          mqttpub(mqttclient,rows[j].macid,2);//calling mqttpub for publishing value 2 to all macids
      }
      mqttclient.end();
    }
});
}
/****************implementing websocket***********/
wss.on('connection', function(ws) {
  wscon=ws;
  var client_uuid=uuid.v4();
  clients.push({"id": client_uuid, "ws": wscon});//adds client detail
  log.info('client [%s] connected',client_uuid);
  
  wscon.on('message', function(message) {
    var response = JSON.parse(message);
    var mqttclient  = mqtt.connect(mqttaddress,{encoding:'utf8', clientId: 'M-O-S-C-A'});
    mqttpub(mqttclient,response.deviceId,response.payload);
    mqttclient.end();
    //console.log('message received ', response.deviceId);
  });

  wscon.on('close', function() {
      log.info("web socket connection closed ",client_uuid);
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
      var query='Select channel_id from channels where name=\''+name+'\'';
      findChannel(name, function(channel_Id){//updating the thingspeak feed
              
            var query='Select api_key from api_keys where channel_id='+channel_Id;  //findapikey
            thingspeak.query(query,function(err,rows,fields){
              if(err)
              log.error('Error in checking apikey, thingspeak, '+err);
              else{
                  TSclient.attachChannel(channel_Id, { writeKey:rows[0].api_key});
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
  log.info("macid "+name);
    var query='Select id from channels where name=\''+name+'\'';
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