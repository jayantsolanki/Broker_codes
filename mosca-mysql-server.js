var mosca = require('mosca');

var id, start,stop,action,currentime, item, macid, type;
//mqtt config
var mqtt    = require('mqtt');
var mqttaddress='mqtt://127.0.0.1';

//mysql configuration
var mysql      = require('mysql');
/////////////////////////////////
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'jayant123',
  database : 'IOT'
});

connection.connect();
//configuration ended
 
var settings = {
  port: 1883,
  host: "127.0.0.1"
};
 
var server = new mosca.Server(settings);

server.on('clientConnected', function(client) {
    var val=client.id;
    var post  = {macid: val};
    connection.query('SELECT EXISTS(SELECT * FROM devices WHERE ?) as find',post, function(err, rows, fields) {
    
      if (err) throw err;
      else{
          var find=rows[0]['find'];
          if(find==0){ //check device is the new one, find=0 means new device found, no previous entry in the table
            var devdis='INSERT INTO devices VALUES (DEFAULT,NULL,\''+post.macid+'\',NULL,2,1, DEFAULT,NULL,NULL)'
            connection.query(devdis, function(err, rows, fields) { //insert into the table 
              if (err) throw err;
              else
                console.log('New Device found, adding '+post.macid+' into device table');
              });
          }
        
          else{
            console.log('Old device');
            var devdis='UPDATE devices SET status=1 where macid=\''+post.macid+'\'';
            connection.query(devdis, function(err, rows, fields) { //updating device status as online  
              if (err) throw err;
              else
                console.log('Device '+post.macid+' is online');
          
            });
          }
        }
    });
    console.log('client connected', client.id);
});
 
// fired when a message is received 
server.on('published', function(packet, client) {
  console.log('Published topic', packet.topic);
  console.log('Published payload', packet);
});
 
server.on('ready', setup);
 
// fired when the mqtt server is ready 
function setup() {
  console.log('Mosca server is up and running');
 
  
  //var currenttime=date.getTime()
  var tasks = "select * from tasks";
  var minutes = 1, the_interval = 2000; //set time here
  //var group=null;
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
                var devquery='Select macid from devices where devices.macid=\"'+macid+'\"';
             
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
      else
        console.log('Scheduled tasks list empty');

    }
  });
  // do your stuff here
}, the_interval);
}
function mqttpub(mqttclient,macid,action)//method for publishing the message to esp module
{
   mqttclient.publish('esp/'+macid, action.toString(), {retain:false, qos: 1});
}
