var Stomp = require('stomp-client');

// Use raw TCP sockets
var client = new Stomp('mqtt://0.0.0.0', 61620, 'admin', 'password');

client.connect(function(sessionId) {
  console.log('connected to Stomp');

  client.subscribe('/queue/myqueue', function(message) {
    console.log("received message " + message.body);

    // once we get a message, the client disconnects
    client.disconnect();
  });
  
  console.log ('sending a message');
  client.send('/queue/myqueue', {}, 'Hello, node.js!');
});