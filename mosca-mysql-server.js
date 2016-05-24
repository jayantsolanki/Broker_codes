var mosca = require('mosca');
var env = require('./settings');//importing settings file, environment variables
/**************thingSpeak client**************/
var ThingSpeakClient = require('thingspeakclient');
var TSclient = new ThingSpeakClient({
  server:'http://10.129.139.139:3000',
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

///mysql
var localdb_config={
  host     : env.localhost,
  user     : env.user,
  password : env.password1,
  socketPath: '/var/run/mysqld/mysqld.sock',
  database : env.database
}
var thingspeak_config={ //for thingspeak
  host     : env.mhost2,
  user     : env.user,
  password : env.password2,
  socketPath: '/var/run/mysqld/mysqld.sock',
  database : env.database2//thingspeak
}
var connection = mysql.createConnection(localdb_config);
var thingspeak = mysql.createConnection(thingspeak_config);
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
      var check='SELECT EXISTS(SELECT * FROM devices WHERE deviceId=\''+val+'\') as find';
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
              { //(id, deviceId, name, description,type,switches,regionId, latitude,longitude,field1,field2,field3,field4,field5,field6, created_at, updated_at, elevation)
                var devdis='INSERT INTO devices (deviceId, type) VALUES (\''+post.macid+'\',1)'
                connection.query(devdis, function(err, rows, fields) { //insert into the table 
                  if (err) 
                    log.error("MYSQL ERROR "+err);
                  else{
                    log.info('New Device found, adding '+post.macid+' into device table');
                    log.info('Requesting for more data from device '+post.macid);
                    var mqttclient  = mqtt.connect(mqttaddress,{encoding:'utf8', clientId: 'M-O-S-C-A'});
                    mqttpub(mqttclient,post.macid,0,2);//calling mqttpub for publishing value 2 to all macids
                    mqttclient.end();
                    var jsonS={
                         "deviceId":post.macid,
                         "action":'info',
                         "data"  :"new Device Found"
                    };
                    sendAll(jsonS);//sending button status to all device
                    /*TSclient.createChannel(1, { 'api_key':env.apiKey,'name':post.macid, 'field1':'PbatValue', 'field2':'SbatValue','field3':'packetID'}, function(err) {
                      if (!err) {//channel creation done
                          log.info('New channel created for new Valve: '+post.macid);
                          attachChannel(post.macid);//attaching the channel;
                      }
                      else
                      {
                        console.log(err)
                      }
                    });*/
                  }
                });
              }
            }
          
            else{
              log.info('Device '+post.macid+' reconnected ');
              //var devdis='UPDATE devices SET status=1, seen= now() where status!=2 and macid=\''+post.macid+'\'';
              var devdis='INSERT INTO deviceStatus VALUES (DEFAULT,\''+post.macid+'\',1, DEFAULT)';
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
    //var offlineq='UPDATE devices SET status=0, seen= now() where status!=2 and macid= \''+client.id.toString()+'\'';
    var offlineq='INSERT INTO deviceStatus VALUES (DEFAULT,\''+client.id.toString()+'\',0, DEFAULT)';
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
// fired when a message is received 
server.on('published', function(packet) {
  //var date = new Date();
  var topic=packet.topic; //get value of payload
  var regex1 = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/;
  topic=topic.toString();
  var jsonS={
       "action":'mqtt payload',
       "data"  :packet
  };
  sendAll(jsonS);//sending button status to all device
  if(regex1.test(packet) || packet.cmd=='publish'){
    log.info('Client id is ',packet.cmd);
    log.info('Published topic '+packet.topic);
    log.info('Published payload '+packet.payload);
  }
  //if(true){ //this could be improved
  var batmacid=topic.substring(4,21);
  //console.log('Mac id publsihed '+batmacid);
// console.log("Macid check is "+regex.test(batmacid));
  var regex = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/;
  if(regex.test(batmacid)){ //check if valid macid there

    var isbattery=topic.substring(22,topic.length);
    var batmac  = {macid: batmacid};
    if(isbattery=='battery')
    {
      //console.log("I am a battery");
      var msg=packet.payload;
      var dataout=String(msg);
      var msgarray=dataout.split(",");//getting strings
      var type=msgarray[0];//type of esp i.e., relay,, single valve, multiple valve, no of switches
      var batP=msgarray[1];//primary battery
      var batS=msgarray[2];//secondary battery
      //add sensor capabilty here in future
     // msg=Integer.parseInt(msg);
      //console.log(msg);
      log.info('Device type is of ',type);//new swiches insert goes here
      newSwitches(batmacid,type, batP, batS);//goes to the function and do the necessary
      var count=0;
            if(batP!=0){
              connection.query('SELECT field1 from feeds where device_id=\''+batmacid+'\' ORDER BY field1 DESC LIMIT 1', function(err, rows, fields) {
                if (!err){
                  if(rows.length>0){//check if the macid was present already before
                      //console.log('The solution is: ', rows[rows.length-1]['packet_id']);
                      count=parseInt(rows[0]['field1']); //storing last packet id in 
                      if(parseInt(batS)!=0)//check if secondary battery is absent
                        var batquery='INSERT INTO feeds(device_id, field1, field2, field3) VALUES (\''+batmac.macid+'\',\''+(count+1)+'\',\''+batP+'\',\''+batS+'\')';
                      else
                        var batquery='INSERT INTO feeds(device_id, field1, field2) VALUES (\''+batmac.macid+'\',\''+(count+1)+'\',\''+batP+'\')';
                    }
                  else{
                      if(parseInt(batS)!=0)//check if secondary battery is absent
                        var batquery='INSERT INTO feeds(device_id, field1, field2, field3) VALUES (\''+batmac.macid+'\',\''+(count+1)+'\',\''+batP+'\',\''+batS+'\')';
                      else
                        var batquery='INSERT INTO feeds VALUES(device_id, field1, field2) (\''+batmac.macid+'\',\''+(count+1)+'\',\''+batP+'\')';
                    }
                    connection.query(batquery, function(err, rows, fields) { //insert into the feed table
                    if (err)
                      log.error("MYSQL ERRORRRRRR "+err);
                    else{
                      log.info('Primary Battery status inserted for device '+batmacid+' with voltage '+batP);
                      if(parseInt(batS)!=0)
                        log.info('Secondary Battery status inserted for device '+batmacid+' with voltage '+batS);
                      var mqttclient  = mqtt.connect(mqttaddress,{encoding:'utf8', clientId: 'M-O-S-C-A'});
                      mqttpub(mqttclient,batmacid,0,3); //sending hibernate signal, replacing 2 by 3
                      log.info('Published 3 to '+batmacid);
                      mqttclient.end();
                      findChannel(batmacid, function(channel_Id){//updating the thingspeak feed
                          TSclient.updateChannel(channel_Id, { "field1":parseInt(batP),"field2":parseInt(batS),"field3":(count+1)}, function(err, resp) {
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
              var jsonS={
                     "deviceId":batmacid,
                     "action"  :"battery",
                     "type"    :type,
                     "batP"    :batP,
                     "batS"    :batS
               };
               sendAll(jsonS);//sending  battery value to the client website
           }
          
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
	attachChannels();//attaching the chaneels with their API write keys
  var tasks = "select * from tasks where active!=3"; //only non disabled task
  var minutes = 1, the_interval = 10000; //set time here, every ten seconds below code is repeated
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
            groupId=rows[i]['groupId'];
            macid=rows[i]['deviceId'];
            switchId=rows[i]['switchId'];
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
                var jsonS={
                     "action":'battery check',
                     "data"  :"Requested for battery status from ESP devices"
                };
                sendAll(jsonS);//sending button status to all device
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
                if(groupId!=null)
                  var devquery='Select deviceId, switchId from switches where switches.groupId='+groupId+'';//code modified here, removed the ambiguous group name with the group id
               // else
                  //var devquery='Select macid from devices where devices.macid=\"'+macid+'\"'; //check this code, it is modifiable, for manual switch on/off
               
                connection.query(devquery, function(err, devs){
                  if(err) {
                    log.error("Unable to get switches list "+err);
                  }
                  else
                  {
                   // console.log(currenttime);
                      var mqttclient  = mqtt.connect(mqttaddress,{encoding:'utf8', clientId: 'M-O-S-C-A'});
                      log.info("Scheduled task started for switching on the Valves");
                      var jsonS={
                           "action":'schedule',
                           "data"  :"Scheduled task started for switching on the Valves"
                      };
                      sendAll(jsonS);//sending button status to all device

                      for (var j=0;j<devs.length;j++)//
                      {
                          log.info("Switched on Device "+devs[j].deviceId+" SwitchId "+devs[j].switchId);
                          mqttpub(mqttclient,devs[j].deviceId,devs[j].switchId,1);//code modified here, added provision for the switches
                          var jsonS={
                               "action":'switched',
                               "data"  :"Switched on Device "+devs[j].deviceId+" SwitchId "+devs[j].switchId
                          };
                          sendAll(jsonS);//sending button status to all device
                      }
                      mqttclient.end();

                  }
                });
                
                  var upd1={action:0};//invert the status on the task, to be switched off next time
                  connection.query('UPDATE tasks SET action='+0+',active=1, updated_at=now() where id='+id+'',function(err, rows, fields) { //update into the table 
                  if (err)
                   log.error("MYSQL ERROR "+err);
                 //else
                   // log.info('Tasks Entry Updated, Set to 0'); // set action to 0 means , next time the valve will be switched off when reached the stop time
                  });


                var upd2={action:1};//update the running status on the switches table, seeting it to running
                if(groupId!=null)//if task was created on group basis n ot the manual switching on the valves
                  var query='UPDATE switches SET action='+1+', updated_at=now() where switches.groupId in (Select * from (Select switches.groupId FROM switches where switches.groupId ='+groupId+')tmp)';
                else
                  var query='UPDATE switches SET action='+1+', updated_at=now() where switches.deviceId=\''+macid+'\' and switches.switchId='+switchId+'';// action =1 means valve is currently on
                connection.query(query,function(err, rows, fields) { //update the table 
                if (err)
                  log.error("MYSQL ERROR in updating the running status of the valves "+err);
                  //console.log(' Devices Update failed, error:  '+err+' '+date);
                else{
                  //console.log('Devices Entry Updated, Set to 1');
                  log.info('Done executing the tasks');
                  var jsonS={
                       "action":'schedule',
                       "data"  :"Done executing the tasks"
                  };
                  sendAll(jsonS);//sending button status to all device
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
                if(groupId!=null)
                  var devquery='Select deviceId, switchId from switches where switches.groupId='+groupId+'';
                else
                  var devquery='Select deviceId, switchId from switches where switches.deviceId=\"'+macid+'\" and switchId='+switchId+'';
                connection.query( devquery, function(err, devs){
                  if(err) {
                    log.error("MYSQL ERROR "+err);
                  }
                  else
                  {
                   // console.log(currenttime);
                   var mqttclient  = mqtt.connect(mqttaddress,{encoding:'utf8', clientId: 'M-O-S-C-A'});
                   log.info("Scheduled task started for switching off the valves");
                   var jsonS={
                         "action":'schedule',
                         "data"  :"Scheduled task started for switching off the valves"
                    };
                    sendAll(jsonS);//sending button status to all device
                   for (var j=0;j<devs.length;j++)// publishing the message
                   {
                        log.info("Switched off "+devs[j].deviceId+" SwitchId "+devs[j].switchId)
                        var jsonS={
                             "action":'switched',
                             "data"  :"Switched off Device "+devs[j].deviceId+" SwitchId "+devs[j].switchId
                        };
                        sendAll(jsonS);//sending button status to all device
                        mqttpub(mqttclient,devs[j].deviceId,devs[j].switchId,0);//modified for inluding the relays and the raavan
                   }
                   mqttclient.end();
                  }
                });
                if(type==0)//manual task, set for indiviudal valves
                {
                  //console.log("You are in the deletion zone");
                  connection.query('Delete from tasks where id='+id+'', function(err, rows, fields) { //delete from the table 
                    if (err)
                      log.error("MYSQL ERROR "+err);
                    else
                      log.info('Manual task entry deleted');
                    var jsonS={
                         "action":'schedule',
                         "data"  :"Manual entry deleted"
                    };
                    sendAll(jsonS);//sending button status to all device
                    });
                }
                else
                {
                  var upd1={action:1};
                  connection.query('UPDATE tasks SET action='+1+', active=0, updated_at=now() where id='+id+'', function(err, rows, fields) { //update the table 
                  if (err)
                    log.error('Update failed');
                  //else
                    //console.log('Tasks Entry Updated, Set to 1');
                  });
                }
                var upd2={action:0};
                if(groupId!=null)
                  var query='UPDATE switches SET action='+0+', updated_at=now() where switches.groupId in (Select * from (Select switches.groupId FROM switches where switches.groupId ='+groupId+')tmp)';//group valves are selected
                else
                  var query='UPDATE switches SET action='+0+', updated_at=now() where switches.deviceId=\''+macid+'\' and switches.switchId='+switchId+'';// action =0 means valve is currently off, for individual valve
                //console.log(macid);
                connection.query(query, function(err, rows, fields) { //update the table 
                if (err)
                  log.error("MYSQL ERROR in updating the running status of the valves "+err);
                else{
                  //console.log('Devices Entry Updated, Set to 0');
                  log.info('Done executing the tasks');
                  var jsonS={
                       "action":'schedule',
                       "data"  :"Done executing the tasks"
                  };
                  sendAll(jsonS);//sending button status to all device
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
function mqttpub(mqttclient,macid,switchId,action)//method for publishing the message to esp module, action=0,1,2
{
  if(switchId==0){//for battery
    mqttclient.publish('esp/'+macid, action.toString(), {retain:true, qos: 0});
  }
  if(switchId>0 && switchId<6){
    var command=2*(switchId-1)+action;
    mqttclient.publish('esp/'+macid, command.toString(), {retain:true, qos: 0});//check that the payload is in string
  }
  if(switchId>=6 && switchId<=18){//concession for the RAAVAN, total support upto 13 valves
    var count=2*(switchId-6)+action;
    var com=String.fromCharCode('A'.charCodeAt() + count);
    mqttclient.publish('esp/'+macid, com.toString(), {retain:true, qos: 0});//check that the payload is in string
  }
  if(switchId>=19 && switchId<=31){ //support upto 13 more valves, overall total 31 valves
    var count=2*(switchId-19)+action;
    var com=String.fromCharCode('A'.charCodeAt() + count);
    mqttclient.publish('esp/'+macid, com.toString(), {retain:true, qos: 0});//check that the payload is in string
  }
  var jsonS={
       "deviceId":macid,
       "switchId":switchId,
       "action"  :action
  };
  sendAll(jsonS);//sending button status to all device
}

// battery status check
function battstatus()
{
  var query='Select deviceId from devices where type=1 and switches=1';//only for one valve ESP
  connection.query(query,function(err,rows,fields){
    if(err)
      log.error('Error in checking battery status, '+err);
    else{
      var mqttclient  = mqtt.connect(mqttaddress,{encoding:'utf8', clientId: 'M-O-S-C-A'});
      for (var j=0;j<rows.length;j++)//going through all the macid
      {
          log.info("Checking battery status for device "+rows[j].deviceId)
          mqttpub(mqttclient,rows[j].deviceId,0,2);//calling mqttpub for publishing value 2 to all macids
          var jsonS={
               "action":'battery check',
               "data"  :"Checking battery status for device "+rows[j].deviceId
          };
          sendAll(jsonS);//sending button status to all device
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
    if(response.event=='battery')//for battery check event
    {
      //if(response.device==0)
      battstatus();
      log.info('Client requested battery status from ESP devices');
      var jsonS={
           "action":'battery check',
           "data"  :"Client requested for battery status";
      };
      sendAll(jsonS);//sending button status to all device

      //console.log('message received ', response.data.check, 'action ', response.data.payload, 'deviceId ', response.data.device);

    }
    else if (response.action=='data' || response.status!=null){//for  getting data from serial sensor and broadcasting it
      //console.log('Message received: '+response.deviceId );
      sendAll(response);
    }
    else{
      var mqttclient  = mqtt.connect(mqttaddress,{encoding:'utf8', clientId: 'M-O-S-C-A'});
      mqttpub(mqttclient,response.deviceId,response.switchId,response.payload);//code modified, added provision for the >1 switches per ESP
      mqttclient.end();
      console.log('message received ', response.deviceId, 'action ', response.payload, 'switchID ', response.switchId);
      var jsonS={
           "action":'switch',
           "data"  :"message received "+response.deviceId+" action "+response.payload+" switchID "+response.switchId
      };
      sendAll(jsonS);//sending button status to all device
    }
    //console.log(response);
    //console.log('message received ', response.deviceId, 'action ', response.payload, 'switchID ', response.switchId);
  });

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
      var query='Select api_key, channel_id from api_keys where write_flag=1';
      thingspeak.query(query,function(err,rows,fields){
      if(err)
        log.error('Error in checking apikeys, thingspeak, '+err);
      else{
        for (var j=0;j<rows.length;j++)//going through all the macid
        {
            log.info("attaching apikey for channel id "+rows[j].channel_id)
            TSclient.attachChannel(rows[j].channel_id, { writeKey:rows[j].api_key});
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
      var query='Select channel_id from channels where name=\''+name+'\'';
      findChannel(name, function(channel_Id){//updating the thingspeak feed
              
            var query='Select api_key from api_keys where write_flag=1 and channel_id='+channel_Id;  //findapikey
            thingspeak.query(query,function(err,rows,fields){
				if(rows.length>0){
				      if(err)
				      log.error('Error in checking apikey, thingspeak, '+err);
				      else{
				          TSclient.attachChannel(channel_Id, { writeKey:rows[0].api_key});
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
  //log.info("macid "+name);
    var query='Select id from channels where name=\''+name+'\'';
    thingspeak.query(query,function(err,rows,fields){
      if(err)
        log.error('Error in finding channel id, thingspeak, '+err);
      else{
        //log.info('Channel id ',rows[0].id," for sensor ",name);
        if(rows.length>0){
		//log.info(123132);
          callback(rows[0].id);

        }
        else
          callback(0);//no id found
      }
  });
}
/******************************
*function: thingspeakDisconnect()
*input: none
*output; return new connection to mysql db
*logic: check if connection is lost, then tries to connect again, for handling thingspeak connection
*
*********************************/
function thingspeakDisconnect() {
  thingspeak = mysql.createConnection(thingspeak_config); // Recreate the connection, since
                                                  // the old one cannot be reused.

  thingspeak.connect(function(err) {              // The server is either down
    if(err) {                                     // or restarting (takes a while sometimes).
     //log.error('error when connecting to db:', err);
      setTimeout(thingspeakDisconnect, 2000); //introduce a delay before attempting to reconnect,
    }                                     // to avoid a hot loop, and to allow our node script to
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  thingspeak.on('error', function(err) {
    //log.error('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      thingspeakDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}


//check if connection has fallen then to this, error caching
thingspeak.on('error', function(err) {
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
  connection = mysql.createConnection(localdb_config); // Recreate the connection, since
                                                  // the old one cannot be reused.

  connection.connect(function(err) {              // The server is either down
    if(err) {                                     // or restarting (takes a while sometimes).
     //log.error('error when connecting to db:', err);
      setTimeout(localdbDisconnect, 2000); //introduce a delay before attempting to reconnect,
    }                                     // to avoid a hot loop, and to allow our node script to
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  connection.on('error', function(err) {
    //log.error('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      localdbDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}

connection.on('error', function(err) {
    log.error('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      localdbDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });

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
    connection.query(devid, function(err, drows, fields) { //update the table //query2
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
*function: newSwitches(macId,type)
*input: takes device_id and type is the signature of the device, 1 valve, 2 valve, and nth valve
*output; insert new switches if there
*logic: check if there is any previous entry of the deivce in swiches table
*
*/
function newSwitches(macId,type,batP, batS){
  var check='SELECT EXISTS(SELECT * FROM switches WHERE deviceId=\''+macId+'\') as find';
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
              if(regex.test(macId))//check if the client id is the macid
              { //(id, deviceId, name, description,type,switches,regionId, latitude,longitude,field1,field2,field3,field4,field5,field6, created_at, updated_at, elevation)
                if(type==1)
                  var devdis='UPDATE devices SET switches='+type+', field1=\'packetId\', field2=\'Pbattery\', field3=\'SBattery\' where deviceId=\''+macId+'\'';
                else if(type>1)
                  var devdis='UPDATE devices SET switches='+type+' where deviceId=\''+macId+'\'';//No battery needed for relay or switches>1
                connection.query(devdis, function(err, rows, fields) { //insert into the table 
                  if (err) 
                    log.error("MYSQL ERROR "+err);
                  else{
                    log.info('Device type updated for '+macId+' into device table, type '+type);
                      var jsonS={
                           "action":'device',
                           "data"  :"Device type updated for "+macId+" into device table, type "+type
                      };
                      sendAll(jsonS);//sending button status to all device
                    if(type==1){//for thingspeak feed
                      var thingspeakchannelrow={
                        'api_key' : env.apiKey,
                        'name'    : macId,
                        'field1'  :'PbatValue',
                        'field2'  :'SbatValue',
                        'field3'  :'packetID'
                      }
                      TSclient.createChannel(1, thingspeakchannelrow, function(err) {
                        if (!err) {//channel creation done
                            log.info('New channel created for new Valve: '+macId);
                            var jsonS={
                                 "action":'device',
                                 "data"  :'New channel created for new Valve: '+macId
                            };
                            sendAll(jsonS);//sending button status to all device
                            attachChannel(macId);//attaching the channel;
                        }
                        else
                        {
                          console.log(err)
                        }
                      });
                      var devdis='INSERT INTO deviceNotif(deviceId, field1, field2) VALUES (\''+macId+'\',0,0)'//insert into deviceNotif table
                      connection.query(devdis, function(err, rows, fields) { //insert into the table 
                        if (err) 
                          log.error("MYSQL ERROR Entry in deviceNotif "+err);
                        else{
                          log.info("Device Entry in deviceNotif table");
                          var jsonS={
                               "action":'device',
                               "data"  :'Device Entry in deviceNotif table'
                          };
                          sendAll(jsonS);//sending button status to all device
                        }
                      });
                    }
                    
                  }
                });
                // for creating new switches
                for(var j=1;j<=type;j++){
                  insertSwitch(macId,j);
                }
              }//closing macid check if clause
            }
          }
      });
}

/******************************
*function: insertSwitch(macId, switchId)
*input: takes device_id and switchId
*output; creates their respective switches
*
*/
function insertSwitch(macId, switchId){
    var switches='INSERT INTO switches (deviceId, switchId) VALUES(\''+macId+'\', '+switchId+')';
    connection.query(switches, function(err, drows, fields) { //Insert into switches table
      if (err)
        log.error("Error in creating new switches "+err);
      else{
        log.info('Creating entry for DeviceId '+macId+' SwitchId '+switchId);
        var jsonS={
             "action":'device',
             "data"  :'Creating entry for DeviceId '+macId+' SwitchId '+switchId
        };
        sendAll(jsonS);//sending button status to all device
        }
    });
}
