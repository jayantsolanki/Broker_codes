var SerialPort = require("serialport").SerialPort
var serialPort = new SerialPort("/dev/pts/4", {
  baudrate: 9600,
  stopBits: 1,
  dataBits: 6,
  parity: 'odd'
});
serialPort.on("open", function () {
  console.log('open');
  serialPort.flush();

  serialPort.on('data', function(data) {
    console.log('data received: ' + data);
  });

  serialPort.on('error', function(err) {
    console.log("Some error in reading the data "+err);
  });
  serialPort.on('disconnect', function(disc) {
    console.log("Port closed: "+disc);
  });
  
});