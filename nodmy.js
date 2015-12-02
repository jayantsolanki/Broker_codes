/*var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'jayant123',
  database : 'nodejs'
});
 
connection.connect();
var post  = {state_name: 'UP West'};
connection.query('INSERT INTO states SET?',post, function(err, rows, fields) {
  if (err) throw err;
 
  console.log('New record inserted');
});
 
connection.end();
*/

var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'jayant123',
  database : 'nodejs'
});

connection.connect();
//insertion
var val='Jayant';
var post  = {state_name: val};
connection.query('INSERT INTO states SET?',post, function(err, rows, fields) {
  if (err) throw err;
 
  console.log('New record inserted');
});
//retrieval
connection.query('SELECT * from states', function(err, rows, fields) {
  if (!err)
    console.log('The solution is: ', rows[rows.length-1]['state_name']);
  else
    console.log('Error while performing Query.');
});

connection.end();