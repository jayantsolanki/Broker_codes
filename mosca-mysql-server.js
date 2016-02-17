var mosca = require('mosca');
var env = require('./settings');//importing settings file, environment variables
/////serial config
var SerialPort = require("serialport").SerialPort
var serialPort = new SerialPort("/dev/pts/10", {
  baudrate: 9600
})
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
    if(val!='M-O-S-C-A'){ //do not enter client id of server
      var post  = {macid: val};
      connection.query('SELECT EXISTS(SELECT * FROM devices WHERE ?) as find',post, function(err, rows, fields) {
      //console.log('Inside client connected '+val);
      
        if (err) throw err;
        else{
            var find=rows[0]['find'];
           // console.log('Inside client connected '+find);
            var regex = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/;
            console.log('Mac id is valid? '+regex.test(post.macid));
            if(find==0){ //check device is the new one, find=0 means new device found, no previous entry in the table
              if(regex.test(post.macid))//check if the client id is the macid
              {
                var devdis='INSERT INTO devices VALUES (DEFAULT,NULL,\''+post.macid+'\',NULL,2,1, DEFAULT,NULL,NULL)'
                connection.query(devdis, function(err, rows, fields) { //insert into the table 
                  if (err) throw err;
                  else
                    console.log('New Device found, adding '+post.macid+' into device table');
                  });
              }
            }
          
            else{
              console.log('Device '+post.macid+' reconnected');
              var devdis='UPDATE devices SET status=1 where macid=\''+post.macid+'\'';
              connection.query(devdis, function(err, rows, fields) { //updating device status as online if it reconnects
                if (err) throw err;
                else
                  console.log('Device '+post.macid+' is online');
            
              });
            }
          }
      });
    }
    //console.log('client connected', client.id);
});

server.on('unsubscribed', function(topic, client) { //checking if the device goes offline
    var val=client.id;
    
    console.log('client unsubscribed', client.id);
    var offlineq='UPDATE devices SET status=0 where macid= \''+client.id.toString()+'\'';
    connection.query(offlineq, function(err, rows, fields) { //updating device status as online if it reconnects
      if (err) throw err;
      else
        console.log('Device '+client.id.toString()+' went offline');
  
    });

});

//
server.on('clientDisconnected', function( client) { //checking if the device goes disconnect
    var val=client.id;

    console.log('client disconnected', client.id);
    var offlineq='UPDATE devices SET status=0 where macid= \''+client.id.toString()+'\'';
    connection.query(offlineq, function(err, rows, fields) { //updating device status as online if it reconnects
      if (err) throw err;
      else
        console.log('Device '+client.id.toString()+' disconnected');

    });

});
//
 
// fired when a message is received 
server.on('published', function(packet) {
  var msg=packet.payload; //get value of payload
  msg=msg.toString();
  console.log('Client id is ',packet);
  console.log('Published topic'+packet.topic);
  console.log('Published payload '+msg);
  console.log('Macid is '+msg.length);
  if(msg.length>17 && msg.length<24){ //this could be improved
    var batmacid=msg.substring(0,17);
    var regex = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/;
    if(regex.test(batmacid)){ //check if valid macid there

      var batvoltage=msg.substring(17,msg.length);
      var batmac  = {macid: batmacid};
      connection.query('SELECT EXISTS(SELECT * FROM battstatus WHERE ?) as find',batmac, function(err, rows, fields) {
        if (err) throw err;
        else{
            var findmac=rows[0]['find'];
            if(findmac==0){ //check device is the new one, findmac=0 means new entry found, no previous entry in the battery status table
              var batquery='INSERT INTO battstatus VALUES (DEFAULT,\''+0+'\','+0+', DEFAULT)'
              connection.query(batquery, function(err, rows, fields) { //insert into the table 
                if (err) throw err;
                else
                  console.log('Battery status inserted for device '+batmacid+' with voltage '+batvoltage);
              });
            }
          
            else{
              console.log('Updating battery status for device '+batmacid);
              var batquery='UPDATE battstatus SET voltage='+batvoltage+' where macid=\''+0+'\'';
              connection.query(batquery, function(err, rows, fields) { //updating device status as online  
                if (err) throw err;
                else
                  console.log('Device '+batmacid+' has voltage of '+batvoltage);
            
              });
            }
          }

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
  console.log('Mosca server is up and running');
  //var currenttime=date.getTime()
  var tasks = "select * from tasks";
  var minutes = 1, the_interval = 2000; //set time here, every two seconds below code is repeated
  setInterval(function() {
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
            if(currenttime==0400 || currenttime==400)//check battery status at every 4 AM
            {
              
              if(flag==1){
                battstatus();
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
                  var devquery='Select macid from devices left join groups on devices.group=groups.id where groups.name=\"'+item+'\"';
                else
                  var devquery='Select macid from devices where devices.macid=\"'+macid+'\"'; //check this code, it is modifiable
               
                connection.query(devquery, function(err, devs){
                  if(err) {
                    throw err;
                  }
                  else
                  {
                   // console.log(currenttime);
                    var mqttclient  = mqtt.connect(mqttaddress,{encoding:'utf8', clientId: 'M-O-S-C-A'});
                    for (var j=0;j<devs.length;j++)//
                    {
                        
                        console.log("Switched on "+devs[j].macid)
                        mqttpub(mqttclient,devs[j].macid,1);
                    }
                    mqttclient.end();

                  }
                });
                
                  var upd1={action:0};
                  connection.query('UPDATE tasks SET ? where id='+id+'',upd1, function(err, rows, fields) { //update into the table 
                  if (err)
                    console.log('Update failed');
                  else
                    console.log('Tasks Entry Updated, Set to 0');
                  });


                var upd2={action:1};
                if(item!=null)
                  var query='UPDATE devices SET ? where devices.group in (Select * from (Select devices.group from devices where devices.group in (Select id from groups where groups.name=\"'+item+'\"))tmp)';
                else
                  var query='UPDATE devices SET ? where devices.macid='+macid+'';
                connection.query(query,upd2, function(err, rows, fields) { //update the table 
                if (err)
                  console.log(' Devices Update failed, error:  '+err);
                else{
                  console.log('Devices Entry Updated, Set to 1');
                  console.log('Done executing the tasks');
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
                  var devquery='Select macid from devices left join groups on devices.group=groups.id where groups.name=\"'+item+'\"';
                else
                  var devquery='Select macid from devices where devices.macid=\"'+macid+'\"';
                connection.query( devquery, function(err, devs){
                  if(err) {
                    throw err;
                  }
                  else
                  {
                   // console.log(currenttime);
                   var mqttclient  = mqtt.connect(mqttaddress,{encoding:'utf8', clientId: 'M-O-S-C-A'});
                   for (var j=0;j<devs.length;j++)// publishing the message
                   {
                        console.log("Switched off "+devs[j].macid)
                        mqttpub(mqttclient,devs[j].macid,0);
                   }
                   mqttclient.end();
                  }
                });
                if(type==0)
                {
                  console.log("You are in the deletion zone");
                  connection.query('Delete from tasks where id='+id+'', function(err, rows, fields) { //delete from the table 
                    if (err)
                      console.log('Manual task deletion failed');
                    else
                      console.log('Manual task entry deleted');
                    });
                }
                else
                {
                  var upd1={action:1};
                  connection.query('UPDATE tasks SET ? where id='+id+'',upd1, function(err, rows, fields) { //update the table 
                  if (err)
                    console.log('Update failed');
                  else
                    console.log('Tasks Entry Updated, Set to 1');
                  });
                }
                var upd2={action:0};
                if(item!=null)
                  var query='UPDATE devices SET ? where devices.group in (Select * from (Select devices.group from devices where devices.group in (Select id from groups where groups.name=\"'+item+'\"))tmp)';//group valves are selected
                else
                  var query='UPDATE devices SET ? where devices.macid=\''+macid+'\''; // if individual valve is scheduled
                console.log(macid);
                connection.query(query,upd2, function(err, rows, fields) { //update the table 
                if (err)
                  console.log('Update failed, error: '+err);
                else{
                  console.log('Devices Entry Updated, Set to 0');
                  console.log('Done executing the tasks');
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
  var query='Select macid from devices';
  connection.query(query,function(err,rows,fields){
    if(err)
      console.log('Error in checking battery status, '+err);
    else{
      var mqttclient  = mqtt.connect(mqttaddress,{encoding:'utf8', clientId: 'M-O-S-C-A'});
      for (var j=0;j<rows.length;j++)//going through all the macid
      {
          console.log("Checking battery status for device "+rows[j].macid)
          mqttpub(mqttclient,rows[j].macid,2);//calling mqttpub for publishing value 2 to all macids
      }
      mqttclient.end();
    }
});
}
//serial listen
serialPort.on("open", function () {
  console.log('open');
  var count=0
  var res, dataout;
  serialPort.on('data', function(data) {
    var date = new Date();
    console.log("Time: "+date);

    dataout=String(data);
    res = dataout.split(",");//getting strings
    console.log(res[0]);//stores device id
    console.log(res[1]);//stored packet number or id
    console.log(res[2]);//gets device type
    //find if the device is new
    var post  = {macid: res[0]};
      connection.query('SELECT EXISTS(SELECT * FROM devices WHERE ?) as find',post, function(err, rows, fields) {
      //console.log('Inside client connected '+val);
      
        if (err) throw err;
        else{
            var find=rows[0]['find'];
           // console.log('Inside client connected '+find);
           if(find==0){ //check device is the new one, find=0 means new device found, no previous entry in the table
               var devdis='INSERT INTO devices VALUES (DEFAULT,NULL,\''+post.macid+'\',NULL,2,1, DEFAULT,NULL,\''+res[2]+'\')';
                connection.query(devdis, function(err, rows, fields) { //insert into the table 
                  if (err) throw err;
                  else
                    console.log('New Sensor Device found, adding '+post.macid+' into device table');
                  });
           }

           else{
              console.log('Device '+post.macid+' reconnected');
            //  var devdis='UPDATE devices SET status=1, type=\''+res[2]+'\' where macid=\''+post.macid+'\'';
             // connection.query(devdis, function(err, rows, fields) { //updating device status as online if it reconnects
                /*if (err) throw err;
                else
                  console.log('Device '+post.macid+' is online');*/
            
              //});
            }

         }
       });
    ///
    if(res[2]==='bthm')
    {
      var sensorVal='INSERT INTO feeds VALUES (DEFAULT,\''+res[0]+'\','+res[1]+',\''+res[2]+'\','+res[3]+','+res[4]+','+res[5]+','+res[6]+',DEFAULT,DEFAULT,NULL,NULL,NULL,NULL,NULL,NULL)';
      connection.query(sensorVal, function(err, rows, fields) { //insert into the feed table 
        if (err) throw err;
        else
          console.log('Feed added for '+res[0]+' on '+date);
        });
    }
    else if(res[2]==='bm')
    {
      var sensorVal='INSERT INTO feeds VALUES (DEFAULT,\''+res[0]+'\','+res[1]+',\''+res[2]+'\',NULL, NULL, NULL,'+res[3]+',DEFAULT,DEFAULT,NULL,NULL,NULL,NULL,NULL,NULL)';
      connection.query(sensorVal, function(err, rows, fields) { //insert into the feed table 
        if (err) throw err;
        else
          console.log('Feed added for '+res[0]+' on '+date);
        });
    }
    console.log(res[3]);
    count++;
    console.log('data count : ' + count);
  });
  serialPort.on('error', function(errors) {
    console.log('error in reading: ' + errors);
  });

});
/////

