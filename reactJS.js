//var mosca = require('mosca');
var env = require('./settings');//importing settings file, environment variables
////initiating the bunyan log
var Logger = require('bunyan');
/********twitter api**********/
var Twitter = require('twitter');
var Tclient = new Twitter({
  consumer_key: 'A9osl28dnL5Sf8fHjLNVcVKNU',
  consumer_secret: 'bngJZxKfvis9olg1ykQm2AHMdSxtkK6ofzOjoK34dxpALRPthy',
  access_token_key: '709042851791810560-F1xGVbRq1WYnb1Lpy9P27rm5SGQfwzJ',
  access_token_secret: 'INMW42NC4W7iU59DpubZZ6VEWsrGGznRSF8vQONkwI8p7'
});
/****************************/
/***************Adding websocket feature*******/
//var uuid = require('node-uuid');
//var WebSocketServer = require('ws').Server,
//    wss = new WebSocketServer({port: 8181});
var WebSocket = require('ws');
var ws=null;
wsConnect();
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
//mqtt config
//var mqtt    = require('mqtt');
//var mqttaddress=env.mqtt;

//mysql configuration
var mysql      = require('mysql');
/////////////////////////////////
///mysql
var localdb_config={
  host     : env.localhost,
  user     : env.user,
  password : env.password1,
  socketPath: '/var/run/mysqld/mysqld.sock',
  database : env.database
}
var connection = mysql.createConnection(localdb_config);
connection.connect();//general
/////////////////////
var groupId, fieldId, condition, conditionValue, actionId, active, server=0, flag=1;//flag is for battery, for once in a day
var reactS="SELECT * FROM reactJS WHERE activated!=0";
var the_interval = 5000;
setInterval(function() {
  if(ws==null){
    var time=new Date();
    if(server==0){//send message to Twitter
      log.error("Mosca Server Outage");
      Tclient.post('statuses/update', {status: "CRITICAL: Mosca server went Offline, please contact Admin, time "+time}, function(error, tweet, response) {
        if (!error) {
          console.log('Mosca Connection breakage Tweet posted');
          
        }
        else{
          log.error('Tweet error in Server Outage Posting: ',error);
        }
      });

    }
    wsConnect();
    server=1;//prevent from reoccuring
  }
  connection.query(reactS, function(err, react, fields) { //insert into the table 
      if (err) 
        log.error("Error in checking react entry in reactJS table"+err);
      else{
      	if(react.length>0){
      		for(var i=0; i<react.length; i++){
      			var groupId=react[i]['groupId'];
      			var fieldId=react[i]['fieldId'];
      			var condition=react[i]['condition'];
      			var conditionValue=react[i]['conditionValue'];
      			var actionId=react[i]['actionId'];
      			var active=react[i]['active'];

      			if(fieldId=='battery'){//if field is set to battery
      				if(actionId==5){
      					checkBattery(groupId, conditionValue);//call battery check, here the value is the time of the day when to check the battery
      				}
      				if(actionId==6){//low primary battery
      					lowBattery(groupId, actionId, conditionValue);//check low battery for a group, based upon defined criteria
      				}
              if(actionId==9){//low secondary battery
                lowBattery(groupId, actionId, conditionValue);//check low battery for a group, based upon defined criteria
              }
      			}
            if(fieldId=='Online/Offline'){//if field is set to Online/Offline check
              if(actionId==8){
                //check for connection outage
                connectionCheck(groupId);
              }
            }
      			if(fieldId=='moisture'){//if field is set to moisture
      				if(actionId==1){
      					setSchedule(groupId, conditionValue);//
      				}
      				if(actionId==2){
      					setScheduleAndNotify(groupId, conditionValue);//experimental
      				}
      				if(actionId==3){
      					stopSchedule(groupId, conditionValue);//
      				}
      				if(actionId==4){
      					stopScheduleAndNotify(groupId, conditionValue);//experimental
              }
      			}


      		}//main loop ends

      	}//react length check
      }
    });
//console.log('Done checking the task table');
}, the_interval);

/******************************
*function: checkBattery(time)
*input: takes time as a input
*output; sends signal to mosca-mysql-server via websocket to acivate battstatus() method
*
*/
function checkBattery(groupId, time){//actionId 5, thinking about battery check for specific group, but wont matter
	var date=new Date();
	var currentTime=date.getHours()*100+date.getMinutes(); //HHmm format
	if(currentTime==0000)
		flag=1;
	if(currentTime==time){//check battery status at every given time
		if(flag==1){
			//use websocket for checking battery
      var jsonS={
       "check":'battery',
       "groupId":groupId,//0 for all device
       "payload":2
       };
      sendAll(jsonS);//sending button status to all device
      
			log.info("Requested for battery status for groupId: "+groupId);
      flag=0;
		}
	}
}

/******************************
*function: setSchedule(groupId, threshold)
*input: takes groupId as a input
*output; sets schedule for the particular group if moisture level is low
*
*/
function setSchedule(groupId, threshold){ //actionId 1
	var query='SELECT deviceId, field1 FROM devices where groupId='+groupId+'';//for sensor, assumed here only one sensor in one group
	connection.query(query, function(err, device, fields) { //insert into the table 
        if (err) 
          log.error("Error in checking device entry for moisture sensors in devices table"+err);
        else{
        	if(device.length>0){
            //console.log('Device found is '+device[0]['deviceId']);
        		//for(var i=0; i<device.length; i++){//hopefully one device only
        			var deviceId=device[0]['deviceId'];
        			var field1=device[0]['field1'];//for checking if it is bthm, bm, or something else
        			//convert conditionValue into respective ADC value
        			if(field1=='bm'){
        				var sensorMoist='SELECT CAST(AVG(field4) as UNSIGNED) as value FROM (SELECT field4 FROM feeds WHERE device_id =\''+deviceId+'\' and field4<\'4095\' ORDER BY id desc limit 5) as temp';
        				connection.query(sensorMoist, function(err, sensorMoistV, fields) {
        					if (err) 
					          log.error("Error in checking feeds entry for Moisture in devices table"+err);
					        else{
					        	var value=sensorMoistV[0]['value'];
					        	if(value>=threshold){//if lower than threshold, more adc value less moisture
					        		checkSchedule(groupId, 1);//check schedule, if necessary to setup
                      var updateNotif='UPDATE deviceNotif SET field3=1, field3changeDate=now() where deviceId =\''+deviceId+'\' ';//updating the deviceNotif table, low moisture
                      connection.query(updateNotif, function(err, row, fields) {
                        if (err) 
                          log.error("Error in updating the deviceNotif table"+err);
                        else{
                          if(row.changedRows==1){
                            log.info("Moisture status updated for sensor "+deviceId+" in deviceNotif table, set to low");
                            Tclient.post('statuses/update', {status: "Moisture status updated for sensor "+deviceId+" in deviceNotif table, set to low"}, function(error, tweet, response) {
                              if (!error) {
                                console.log('Low Moisture level Tweet posted');
                              }
                              else{
                                log.error('Tweet error: '+error);
                              }
                            });
                          }
                        }
                      });
					        		/*var updatereactJS='UPDATE reactJS SET active=1 where deviceId =\''+deviceId+'\' ';//updating the reactJS table
					        		connection.query(updatereactJS, function(err, row, fields) {
			        					if (err) 
								        	log.error("Error in updating the reactJS table"+err);
								        else{
								        	log.info("ReactJS column for moisture marked active");
								        	var updateNotif='UPDATE deviceNotif SET field2=1 where deviceId =\''+deviceId+'\' ';//updating the deviceNotif table, low moisture
							        		connection.query(updateNotif, function(err, row, fields) {
					        					if (err) 
										          log.error("Error in updating the deviceNotif table"+err);
										        else{
										        	log.info("Moisture status updated in deviceNotif table, set to low");
										        }
					        				});
								        }
			        				});*/
					        		
					        	}
					        	/*if(value>threshold){//if greater than threshold
					        		var updatereactJS='UPDATE reactJS SET active=0 where deviceId =\''+deviceId+'\' ';;//updating the reactJS table
					        		connection.query(updatereactJS, function(err, row, fields) {
			        					if (err) 
								        	log.error("Error in updating the reactJS table"+err);
								        else{
								        	log.info("ReactJS column for moisture marked inactive");
								        }
			        				});
					        	}*/
					        }//end of else
        				});
        			}



        		//}//main loop ends

        	}//react length check
        }
      });
}

/******************************
*function: setScheduleAndNotify(groupId, threshold)
*input: takes groupId as a input
*output; sets schedule for the particular group if moisture level is low and notify User
*
*/
function setScheduleAndNotify(groupId, threshold){ //actionId 2
	//to be added later, via websocket
}

/******************************
*function: connectionCheck(groupId)
*input: takes groupId as a input
*output; checks if the device is offline from a long time
*
*/
function connectionCheck(groupId){ //actionId 2
  var query='SELECT deviceId FROM devices where groupId='+groupId+'';//for sensor
  connection.query(query, function(err, device, fields) { //insert into the table 
    if (err) 
      log.error("Error in checking device entry for moisture sensors in devices table"+err);
    else{
      if(device.length>0){
        for (var j=0;j<device.length;j++)//going through all the macid
          {
            //console.log('checking status for the device: '+device[j].deviceId);
            deviceStatus(device[j].deviceId, function(status, times, row){
              //console.log('Status is '+status);
              
              var a = times.split(':'); // split it at the colons
              // minutes are worth 60 seconds. Hours are worth 60 minutes.
              var seconds = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]); 
              //console.log('Time diff is '+seconds);
              if(status==0){
                if(seconds>3600){
                  var query='UPDATE deviceNotif SET field6=1, field6changeDate=now() where deviceId =\''+row+'\' ';//for sensor
                  connection.query(query, function(err, device, fields) { //insert into the table 
                    if (err) 
                      log.error("Error is updating offline status of the deviceNotif table "+err);
                    else{
                      //console.log('Offline status updated for device '+row);
                      if(device.changedRows==1){//post only if row is changed,, 0 to 1
                        log.info('Device '+row+' is unable to connect to the Network');// 
                        Tclient.post('statuses/update', {status: 'Device '+row+' is unable to connect to the Network'}, function(error, tweet, response) {
                          if (!error) {
                            console.log('Connection breakage Tweet posted');
                          }
                          else{
                            log.error('Tweet error: '+error);
                          }
                        });
                      }
                      
                    }
                  });
                }
                else if(seconds<3600 && seconds>0){//for reversing th device Notif table value back to normal
                  var query='UPDATE deviceNotif SET field6=0, field6changeDate=now() where deviceId =\''+row+'\' ';//for sensor
                  connection.query(query, function(err, device, fields) { //insert into the table 
                    if (err) 
                      log.error("Error is updating offline status of the deviceNotif table "+err);
                    else{
                      if(device.changedRows==1){//post only if row is changed,, 0 to 1
                        log.info('Device '+row+' is back in the Network');// 
                        Tclient.post('statuses/update', {status: 'Device '+row+' is back in the Network'}, function(error, tweet, response) {
                          if (!error) {
                            console.log('Connection established Tweet posted');
                          }
                          else{
                            log.error('Tweet error: '+error);
                          }
                        });
                      }
                    }
                  });
                }

              }
              else if(status==1){//for reversing th device Notif table value back to normal
                var query='UPDATE deviceNotif SET field6=0, field6changeDate=now() where deviceId =\''+row+'\' ';//for sensor
                connection.query(query, function(err, device, fields) { //insert into the table 
                  if (err) 
                    log.error("Error is updating offline status of the deviceNotif table "+err);
                  else{
                    if(device.changedRows==1){//post only if row is changed,, 0 to 1
                      log.info('Device '+row+' is back in the Network');// 
                      Tclient.post('statuses/update', {status: 'Device '+row+' is back in the Network'}, function(error, tweet, response) {
                        if (!error) {
                          console.log('Connection established Tweet posted');
                        }
                        else{
                          log.error('Tweet error: '+error);
                        }
                      });
                    }
                  }
                });
              }

            });
          }
      }
    }
  });
}

/******************************
*function: stopSchedule(groupId, threshold)
*input: takes groupId as a input
*output; stops schedule for the particular group if moisture level is low by changing the type to 0,
* so that it can be deleted later by the schedule algorithm running in the mosca-mysql-server
*/
function stopSchedule(groupId, threshold){//actionId 3
	var query='SELECT deviceId, field1 FROM devices where groupId='+groupId+'';//for sensor
	connection.query(query, function(err, device, fields) { //insert into the table 
        if (err) 
          log.error("Error in checking device entry for moisture sensors in devices table"+err);
        else{
        	if(device.length>0){
        		//for(var i=0; i<device.length; i++){//hopefully one device only
        			var deviceId=device[0]['deviceId'];
        			var field1=device[0]['field1'];//for checking if it is bthm, bm, or something else
        			//convert conditionValue into respective ADC value
        			if(field1=='bm'){
        				var sensorMoist='SELECT CAST(AVG(field4) as UNSIGNED) as value FROM (SELECT field4 FROM feeds WHERE device_id =\''+deviceId+'\' and field4<\'4096\' ORDER BY id desc limit 5) as temp';
        				connection.query(sensorMoist, function(err, sensorMoistV, fields) {
        					if (err) 
					          log.error("Error in checking feeds entry for Moisture in devices table"+err);
					        else{
					        	var value=sensorMoistV[0]['value'];
					        	if(value<=threshold){//if greater than threshold, less adc value more moisture
					        		checkSchedule(groupId, 0);//check schedule, if necessary to stop a schedule
                      var updateNotif='UPDATE deviceNotif SET field3=0, field3changeDate=now() where deviceId =\''+deviceId+'\' ';//updating the deviceNotif table
                      connection.query(updateNotif, function(err, row, fields) {
                        if (err) 
                          log.error("Error in updating the deviceNotif table"+err);
                        else{
                          if(row.changedRows==1){
                            log.info("Moisture status updated for Sensor "+deviceId+" in deviceNotif table, set to normal");
                            Tclient.post('statuses/update', {status: "Moisture status updated for Sensor "+deviceId+" in deviceNotif table, set to normal"}, function(error, tweet, response) {
                              if (!error) {
                                console.log('Normal Moisture level Tweet posted');
                              }
                              else{
                                log.error('Tweet error: '+error);
                              }
                            });
                          }
                        }
                      });
					        		/*var updatereactJS='UPDATE reactJS SET active=1 where deviceId =\''+deviceId+'\' ';//updating the reactJS table
					        		connection.query(updatereactJS, function(err, row, fields) {
			        					if (err) 
								        	log.error("Error in updating the reactJS table"+err);
								        else{
								        	log.info("ReactJS column for moisture marked active");
								        	var updateNotif='UPDATE deviceNotif SET field2=0 where deviceId =\''+deviceId+'\' ';//updating the deviceNotif table
							        		connection.query(updateNotif, function(err, row, fields) {
					        					if (err) 
										          log.error("Error in updating the deviceNotif table"+err);
										        else{
										        	log.info("Moisture status updated in deviceNotif table, set to normal");
										        }
					        				});
								        }
			        				});*/
					        		
					        	}
					        	/*if(value<threshold){//if greater than threshold
					        		var updatereactJS='UPDATE reactJS SET active=0 where deviceId =\''+deviceId+'\' ';;//updating the reactJS table
					        		connection.query(updatereactJS, function(err, row, fields) {
			        					if (err) 
								        	log.error("Error in updating the reactJS table"+err);
								        else{
								        	log.info("ReactJS column for moisture marked inactive");
								        }
			        				});
					        	}*/
					        }
        				});
        			}



        		//}//main loop ends

        	}//react length check
        }
      });
}

/******************************
*function: stopScheduleAndNotify(groupId, threshold)
*input: takes groupId as a input
*output; stops schedule for the particular group if moisture level is high above a threshold by changing the type to 0,
* so that it can be deleted later by the schedule algorithm running in the mosca-mysql-server and 
* notify user via twitter
*/
function stopScheduleAndNotify(groupId, threshold){//actionId 4
	//to be added later, via websocket
}

/******************************
*function: lowBattery(groupId, conditionValue)
*input: takes groupId as a input
*output; checks for low battery and set the respective status in the deviceNotif table
*
*/
function lowBattery(groupId, actionId, conditionValue){ //actionId 6
	var query='SELECT deviceId, type, switches FROM devices where groupId='+groupId+'';
	connection.query(query, function(err, device, fields) { //insert into the table 
        if (err) 
          log.error("Error in checking device entry in devices table"+err);
        else{
        	if(device.length>0){
        		for(var i=0; i<device.length; i++){
        			var deviceId=device[i]['deviceId'];
        			var type=device[i]['type'];
        			var switches=device[i]['switches'];
        			//convert conditionValue into respective ADC value
              if(actionId==6){
          			if(type==2){//primary battery for sensors
                  deviceFeed(deviceId, 'field3', conditionValue, function(status, row){
                    if(status==1){//device battery is critical
                      var sensorBat='UPDATE deviceNotif SET field1=\'1\', field1changeDate=now() where deviceId=\''+row+'\'';
                      connection.query(sensorBat, function(err, rows, fields) {
                        if (err) 
                          log.error("Error in checking feeds entry in devices table"+err);
                         else{
                          if(rows.changedRows==1){//post only if row is changed,, 0 to 1
                            log.info("Battery status updated for sensor "+row+" in deviceNotif table, set to adverse ", rows.changedRows);// need to change the whole code
                            Tclient.post('statuses/update', {status: 'Battery level for sensor '+row+' is ADVERSE '}, function(error, tweet, response) {
                              if (!error) {
                                console.log('Adverse level Tweet posted');
                              }
                              else{
                                log.error('Tweet error: '+error);
                              }
                            });
                          }
                         }
                      });
                    }
                    else if(status==0){//device battery is normal
                      var sensorBat='UPDATE deviceNotif SET field1=\'0\', field1changeDate=now() where deviceId=\''+row+'\'';
                      connection.query(sensorBat, function(err, rows, fields) {
                        if (err) 
                          log.error("Error in checking feeds entry in devices table"+err);
                        else{
                          if(rows.changedRows==1){//post only if row is changed,, 1 to 0
                            log.info("Battery status updated for sensor "+row+" in deviceNotif table, set to healthy ", rows.changedRows);// need to change the whole code
                            Tclient.post('statuses/update', {status: 'Battery level for sensor '+row+' is healthy '}, function(error, tweet, response) {
                              if (!error) {
                                console.log('Healthy level Tweet posted');
                              }
                              else{
                                log.error('Tweet error: '+error);
                              }
                            });
                          }
                        }
                      });
                    }
                  });//deviceFeed check ends here
          			}
                if(type==1){//primary battery for valves
                  deviceFeed(deviceId, 'field2', conditionValue, function(status, row){
                    if(status==1){//device battery is critical
                      var sensorBat='UPDATE deviceNotif SET field1=\'1\', field1changeDate=now() where deviceId=\''+row+'\'';
                      connection.query(sensorBat, function(err, rows, fields) {
                        if (err) 
                          log.error("Error in checking feeds entry in devices table"+err);
                         else{
                          if(rows.changedRows==1){//post only if row is changed,, 0 to 1
                            log.info("Battery status updated for ESP "+row+" in deviceNotif table, set to adverse ", rows.changedRows);// need to change the whole code
                            Tclient.post('statuses/update', {status: 'Battery level for ESP '+row+' is ADVERSE '}, function(error, tweet, response) {
                              if (!error) {
                                console.log('Adverse level Tweet posted');
                              }
                              else{
                                log.error('Tweet error: '+error);
                              }
                            });      
                          }
                         }
                      });
                    }
                    else if(status==0){//device battery is normal
                      var sensorBat='UPDATE deviceNotif SET field1=\'0\',, field1changeDate=now() where deviceId=\''+row+'\'';
                      connection.query(sensorBat, function(err, rows, fields) {
                        if (err) 
                          log.error("Error in checking feeds entry in devices table"+err);
                        else{
                          if(rows.changedRows==1){//post only if row is changed,, 1 to 0
                            log.info("Battery status updated for ESP "+row+" in deviceNotif table, set to healthy ", rows.changedRows);// need to change the whole code
                            Tclient.post('statuses/update', {status: 'Battery level for ESP '+row+' is healthy '}, function(error, tweet, response) {
                              if (!error) {
                                console.log('healthy level Tweet posted');
                              }
                              else{
                                log.error('Tweet error: '+error);
                              }
                            });
                          }
                        }
                      });
                    }
                  });//deviceFeed check ends here
                }//ends for valves, primary battery check
              }
              else{//checking low secondary battery
                deviceFeed(deviceId, 'field3', conditionValue, function(status, row){
                  if(status==1){//device battery is critical
                    var sensorBat='UPDATE deviceNotif SET field2=\'1\', field2changeDate=now() where deviceId=\''+row+'\'';
                    connection.query(sensorBat, function(err, rows, fields) {
                      if (err) 
                        log.error("Error in checking feeds entry in devices table"+err);
                       else{
                        if(rows.changedRows==1){//post only if row is changed,, 0 to 1
                          log.info("Battery status updated for ESP "+row+" in deviceNotif table, set to adverse ", rows.changedRows);// need to change the whole code
                          Tclient.post('statuses/update', {status: 'Battery level for ESP '+row+' is ADVERSE '}, function(error, tweet, response) {
                            if (!error) {
                              console.log(' ADverse level Tweet posted');
                            }
                            else{
                              log.error('Tweet error: '+error);
                            }
                          });     
                        }
                       }
                    });
                  }
                  else if(status==0){//device battery is normal
                    var sensorBat='UPDATE deviceNotif SET field2=\'0\', field2changeDate=now() where deviceId=\''+row+'\'';
                    connection.query(sensorBat, function(err, rows, fields) {
                      if (err) 
                        log.error("Error in checking feeds entry in devices table"+err);
                      else{
                        if(rows.changedRows==1){//post only if row is changed,, 1 to 0
                          log.info("Battery status updated for ESP "+row+" in deviceNotif table, set to healthy ", rows.changedRows);// need to change the whole code
                          Tclient.post('statuses/update', {status: 'Battery level for ESP '+row+' is healthy '}, function(error, tweet, response) {
                            if (!error) {
                              console.log('Healthy level Tweet posted');
                            }
                            else{
                              log.error('Tweet error: '+error);
                            }
                          });
                        }
                      }
                    });
                  }
                });//deviceFeed check ends here
              }



        		}//main loop ends

        	}//react length check
        }
      });

}

/******************************
*function: highTemperature(groupId)
*input: takes groupId as a input
*output; checks for high temperature and set the respective status in the deviceNotif table
*
*/
function highTemperature(groupId){ //actionId 7
	//to be added later, via websocket
}

/******************************
*function: checkSchedule(groupId, check)
*input: takes groupId as a input and check as 0/1 
*output; for starting/stopping, if 1, start a schedule, 0 for stop
*/
function checkSchedule(groupId, check){//actionId 4
	if(check==1){//setup a schedule
    //console.log('Group id is '+groupId);
		var checkS='SELECT EXISTS(SELECT * FROM tasks WHERE type=2 and groupId='+groupId+') as find';//check if an automated schedule exists beforehand
      	connection.query(checkS, function(err, rows, fields) {      
	        if (err) 
	        log.error("MYSQL ERROR in checking the schedules"+err);
	        else{
	            var find=rows[0]['find'];
	            if(find==0){ //previous schedule doesnot exists, setup a schedule
	              	var date=new Date;
	              	var startTime=date.getHours()*100+date.getMinutes(); //HHmm format

	              	if(date.getHours()*100>=2300)
	              		stopTime=0+date.getMinutes();
	              	else
	              		stopTime=date.getHours()*100+100+date.getMinutes();//for 60 minutes

	                var setSchedule='INSERT INTO tasks (groupId,start, stop, action, type, active) VALUES (\''+groupId+'\',\''+startTime+'\',\''+stopTime+'\',1,2,2)';
	                connection.query(setSchedule, function(err, rows, fields) { //insert into the table 
	                  if (err) 
	                    log.error("MYSQL ERROR in setting up the schedule"+err);
	                  else{
	                  	log.info("Low moisture, automated Schedule started for group id "+groupId);
                      Tclient.post('statuses/update', {status: "Low moisture, Automated Schedule started for group id "+groupId}, function(error, tweet, response) {
                        if (!error) {
                          console.log('Automated Schedule started Tweet posted');
                        }
                        else{
                          log.error('Tweet error: '+error);
                        }
                      });
	                  }
	                });
	            }
	          
	            else{
	              //log.info('Do nothing, schedule already exists');//actually here existing automated schedule should be updated with the new time
	            }
	        }
      });

	}
	if(check==0){//request for stopping a schedule, just update the stop time, it will go off
		var date=new Date;
	    var stopTime=date.getHours()*100+date.getMinutes(); //HHmm format
		var updateSchedule='UPDATE tasks SET type=0, stop=\''+stopTime+'\' WHERE type=2 and groupId='+groupId+' ';//update the stop time of the automated task for the group, if its exists
      	connection.query(updateSchedule, function(err, rows, fields) {//actually here type may be changed to 0, to delete the task after it is stopped
      		if (err) 
            	log.error("MYSQL ERROR in updating the Schedule"+err);
          	else{
              if(rows.changedRows==1){
          		  log.info("Normal moisture, automated Schedule stopped for group id "+groupId+" and will be deleted shortly");
                Tclient.post('statuses/update', {status: "Normal moisture, automated Schedule stopped for group id "+groupId+" and will be deleted shortly"}, function(error, tweet, response) {
                  if (!error) {
                    console.log('Automated Schedule stoppage Tweet posted');
                  }
                  else{
                    log.error('Tweet error: '+error);
                  }
                });
              }
          	}
      	});

	}
}

/**************************************Websocket con*********************************/
function wsConnect() {//creating a websocket connection to the mosca-mysql-server.js for transfering the sensor value to the latter script
    ws = new WebSocket("ws://10.129.139.139:8180");
    ws.onopen = function() {
      log.info('connected to websocket server');
      if(server==1){
        var time2=new Date();
        Tclient.post('statuses/update', {status: 'Mosca server back online, time '+time2}, function(error, tweet, response) {
          if (!error) {
            console.log('Mosca Connection reestablished Tweet posted');
            server=0;
          }
          else{
            log.error('Tweet error: '+error);
          }
        });
      }
    };
   /* ws.onmessage = function(msg) {
      console.log(msg);
    };
*/
    ws.onclose = function(evt) {
      if (evt.code == 3110) {
        log.error('ws closed');
        ws = null;
      } 
      else {
        ws = null;
        console.log('ws connection error');
        /*var jsonS={
             "action":'Error',
             "data"  :"unable to send the sensor data, reconnecting to mosca-mysql-server"
        };*/
        //sendAll(jsonS);//sending button status to all device
      }
    };

    ws.onerror = function(evt) {
      //if (ws.readyState == 1) {
       console.log('ws normal error: ' + evt.type);
       ws=null;
      //}
    };
}
/******************send to websocket server*****************/
function sendAll(jsonS){  //
  if(ws!=null){//sending data via websocket
    try{
      ws.send(JSON.stringify(jsonS));
    }
    catch(e){
      //wsConnect();
      log.error('error in sending the websocket data');
      wsConnect();
    }
  }
  else
    wsConnect();
}
//////////////////////////////////

/******************************
*function: deviceStatus(name, callback)
*input: takes device_id from feeds
*output; callback, returns the concerned status of the device in the deviceStatus
*logic: check if theire is any previous entry of the deivce in deviceStatus table
*also if the previous entry for the status was1
*
*/
function deviceStatus(row, callback){
    var devid='Select status, TIMEDIFF(now(),deviceStatus.created_At) as times from deviceStatus where deviceId=\''+row+'\' order by id desc limit 1';
    connection.query(devid, function(err, drows, fields) { //update the table //query2
      if (err)
        log.error("MYSQL ERROR "+err);
      else{
        if(drows.length>0){
          callback(drows[0].status, drows[0].times, row);
        }
        else{//if no last row exists
          callback(2,row);//2 is arbitrary, but should not be 0
        }
      }
    });
}

/******************************
*function: deviceFeed(name, callback)
*input: finds battery feed from the feeds table
*output; callback, returns the concerned status of the device in the deviceFeed
*logic: returns the device id if the battery feed lower in threshold
*
*/
function deviceFeed(deviceId, field, threshold, callback){
    var devid='SELECT device_id FROM (SELECT device_id, '+field+' FROM feeds WHERE device_id=\''+deviceId+'\' ORDER BY id DESC LIMIT 1) as temp WHERE '+field+'<'+threshold;
    connection.query(devid, function(err, drows, fields) { //update the table //query2
      if (err)
        log.error("MYSQL ERROR "+err);
      else{
        if(drows.length>0){
          callback(1, deviceId);
        }
        else{//if no device found
          callback(0, deviceId);////0 means deviceID has battrey level normal
        }
      }
    });
}