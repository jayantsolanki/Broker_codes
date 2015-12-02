
//mysql configuation
var mysql      = require('mysql');
var group='jayant';

var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'jayant123',
  database : 'IOT'
});

testquery2();

//console.log('check--------'+item);
function testquery2()
{
	
	connection.query('UPDATE devices SET devices.action=1 where devices.group in (Select * from (Select devices.group from devices where devices.group in (Select id from groups where groups.name=\"ground\"))tmp)', function(err, grp){	
	console.log("Inside function 2");  
	  if(err) {
	    throw err;
	  } else {
	    //group = grp[1]['macid'];
	    console.log(grp);
	  }
	  connection.end();
	  //console.log("now global group id is "+group+ '------'+i);
	  //console.log('outside the query group is '+group);
	  
	});
	console.log('outside the query group is '+group);
		
	//other();
	
}

