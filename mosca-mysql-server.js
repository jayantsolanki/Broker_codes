var mosca = require('mosca');
var env = require('./settings');//importing settings file, environment variables
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
      path: './log/serial.log'  // log ERROR and above to a file
    },
    {
      level: 'warn',
      path: './log/serial.log'  // log WARNING and above to a file
    },
    {
      level: 'info',
      path: './log/serial.log'  // log INFO and above to a file
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

connection.connect();
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
    var date = new Date();
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
                  else
                    log.info('New Device found, adding '+post.macid+' into device table');
                  });
              }
            }
          
            else{
              log.info('Device '+post.macid+' reconnected '+date);
              var devdis='UPDATE devices SET status=1, seen= now() where status!=2 and macid=\''+post.macid+'\'';
              connection.query(devdis, function(err, rows, fields) { //updating device status as online if it reconnects
                if (err)
                  log.error("MYSQL ERROR "+err);
                //else
                 // console.log('Device '+post.macid+' marked online '+date);
            
              });
            }
          }
      });
   // }
    //console.log('client connected', client.id);
});

server.on('unsubscribed', function(topic, client) { //checking if the device goes offline
    var val=client.id;
    var date = new Date();
    log.info('client unsubscribed', client.id);
    var offlineq='UPDATE devices SET status=0, seen= now() where status!=2 and macid= \''+client.id.toString()+'\'';
    connection.query(offlineq, function(err, rows, fields) { //updating device status as online if it reconnects
      if (err) 
        log.error("MYSQL ERROR "+err);
      //else
        //console.log('Device '+client.id.toString()+' marked offline '+date);
  
    });

});

//
server.on('clientDisconnected', function( client) { //checking if the device goes disconnect
    var val=client.id;
    var date = new Date();
    log.info('client disconnected', client.id);
    var offlineq='UPDATE devices SET status=0, seen= now() where status!=2 and macid= \''+client.id.toString()+'\'';
    connection.query(offlineq, function(err, rows, fields) { //updating device status as online if it reconnects
      if (err) 
        log.error("MYSQL ERROR "+err);
      //else
        //console.log('Device '+client.id.toString()+' marked disconnected/Offline '+date);

    });

});
//
 
// fired when a message is received 
server.on('published', function(packet) {
  var date = new Date();
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
              if(rows.length>0){
                //console.log('The solution is: ', rows[rows.length-1]['packet_id']);
                count=parseInt(rows[0]['packet_id']);
                var batquery='INSERT INTO feeds VALUES (DEFAULT,\''+batmac.macid+'\','+(count+1)+',\''+1+'\','+msg+', NULL, NULL,NULL,DEFAULT,DEFAULT,NULL,NULL,NULL,NULL,NULL,NULL)';
                }
                else
                var batquery='INSERT INTO feeds VALUES (DEFAULT,\''+batmac.macid+'\','+(count+1)+',\''+1+'\','+msg+', NULL, NULL,NULL,DEFAULT,DEFAULT,NULL,NULL,NULL,NULL,NULL,NULL)';
          connection.query(batquery, function(err, rows, fields) { //insert into the feed table
              if (err)
                log.error("MYSQL ERROR "+err);
              else
                log.info('Battery status inserted for device '+batmacid+' with voltage '+msg);
                var mqttclient  = mqtt.connect(mqttaddress,{encoding:'utf8', clientId: 'M-O-S-C-A'});
                mqttpub(mqttclient,batmacid,3); //sending hibernate signal, replacing 2 by 3
                log.info('Published 3 to '+batmacid);
                mqttclient.end();
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
          for (var i=0;i<rows.length;i++)//implementing scheduled tasks
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
            if(currenttime==1600 || currenttime==1600)//check battery status at every 4 AM
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
                else
                  var devquery='Select macid from devices where devices.macid=\"'+macid+'\"'; //check this code, it is modifiable
               
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
                   // log.info('Tasks Entry Updated, Set to 0');
                  });


                var upd2={action:1};
                if(item!=null)
                  var query='UPDATE devices SET ? where devices.group in (Select * from (Select devices.group from devices where devices.group in (Select id from groups where groups.name=\"'+item+'\"))tmp)';
                else
                  var query='UPDATE devices SET ? where devices.macid='+macid+'';
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
   mqttclient.publish('esp/'+macid, action.toString(), {retain:true, qos: 1});
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
//serial listen

/////

