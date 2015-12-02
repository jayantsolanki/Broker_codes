var mosca = require('mosca');
//mysql configuation
var mysql      = require('mysql');
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
   /* var val=client.id;
    var post  = {state_name: val};
    connection.query('SELECT EXISTS(SELECT * FROM states WHERE ?) as find',post, function(err, rows, fields) {
    
      if (err) throw err;
        var find=rows[0]['find'];
        if(find==0){ //check device is the new one
          connection.query('INSERT INTO states SET?',post, function(err, rows, fields) { //insert into the table 
          if (err) throw err
            console.log('New Device found');
        });
        }
        else{
          console.log('Old device');
        }
        
      
    });*/
    console.log('client connected', client.id);
});
 
// fired when a message is received 
server.on('published', function(packet, client) {
  console.log('Published payload', packet.payload);
});
 
server.on('ready', setup);
 
// fired when the mqtt server is ready 
function setup() {
  console.log('Mosca server is up and running');
  var id, start,stop,action,currentime, item, macid, type;
  
  //var currenttime=date.getTime()
  var tasks = "select * from tasks";
  var minutes = 1, the_interval = 1000;
  var group=null;
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
          group=null;
          //if(macid==null)
           // console.log('Null found');
         if(item!=null)
            {
              //var groups='select id from groups where name='+item+'';
              var check={name:item};
              connection.query('Select id from groups where ?',check, function(err, grp){
                if(err) {
                  throw err;
                }
                else
                {
                  group=grp[0]['id'];
                  //console.log("group id is "+group);
                }
              });
            }
          if(start!=null)
          {

            if(currenttime>=start && currenttime<stop && action==1)//to switch on the valves
            {
              

             // var devices = "select * from devices";
              if(group!=null)
                var groupid={group:group};
              else
                var groupid={macid:macid};
              connection.query( 'select * from devices where ?',groupid, function(err, devs){
                if(err) {
                  throw err;
                }
                else
                {
                 // console.log(currenttime);
                  for (var j=0;j<devs.length;j++)//
                  {
                    console.log("Switched on "+devs[j]['macid'])
                  }
                }
              });
              
                var upd1={action:0};
                connection.query('UPDATE tasks SET ? where id='+id+'',upd1, function(err, rows, fields) { //insert into the table 
                if (err)
                  console.log('Update failed');
                else
                  console.log('Tasks Entry Updated, Set to 0');
                });


              var upd2={action:1};
              if(group!=null)
                var query='UPDATE devices SET ? where devices.group='+group+'';
              else
                var query='UPDATE devices SET ? where devices.macid='+macid+'';
              connection.query(query,upd2, function(err, rows, fields) { //insert into the table 
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
              var devices = "select * from devices";
              connection.query( devices, function(err, devs){
                if(err) {
                  throw err;
                }
                else
                {
                 // console.log(currenttime);
                  for (var j=0;j<devs.length;j++)//
                  {
                    console.log("Switched off "+devs[j]['macid'])
                  }
                }
              });
              if(type==0)
              {
                console.log("you are in the deletion zone");
                connection.query('Delete from tasks where id='+id+'', function(err, rows, fields) { //insert into the table 
              if (err)
                console.log('Manual task deletion failed');
              else
                console.log('Manual task entry deleted');
              });
              }
              else
              {
                var upd1={action:1};
                connection.query('UPDATE tasks SET ? where id='+id+'',upd1, function(err, rows, fields) { //insert into the table 
                if (err)
                  console.log('Update failed');
                else
                  console.log('Tasks Entry Updated, Set to 1');
                });
              }
              var upd2={action:0};
              if(group!=null)
                var query='UPDATE devices SET ? where devices.group=\''+group+'\''; //if group is scheduled
              else
                var query='UPDATE devices SET ? where devices.macid=\''+macid+'\''; // if individual valve is scheduled
              console.log(macid);
              connection.query(query,upd2, function(err, rows, fields) { //insert into the table 
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
