//var mosca = require('mosca');
var env = require('./settings');//importing settings file, environment variables
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
  password : env.password,
  database : env.database
}
var connection = mysql.createConnection(localdb_config);
connection.connect();//general
/////////////////////
var groupId, fieldId, condition, conditionValue, actionId, active, flag=1;//flag is for battery, for once in a day
var reactS="SELECT * FROM reactJS WHERE activated!=0";
var the_interval = 100;
setInterval(function() {
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
        					checkBattery(conditionValue);//call battery check, here the value is the time of the day when to check the battery
        				}
        				if(actionId==6){
        					lowBattery(groupId, conditionValue);//check low battery for a group, based upon defined criteria
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


        		}//main loop ends

        	}//react length check
        }
      });
}, the_interval);

/******************************
*function: checkBattery(time)
*input: takes time as a input
*output; sends signal to mosca-mysql-server via websocket to acivate battstatus() method
*
*/
function checkBattery(time){//actionId 5, thinking about battery check for specific group, but wont matter
	var date=new Date();
	var currentTime=date.getHours()*100+date.getMinutes(); //HHmm format
	if(currentTime==0000)
		flag=1;
	if(currenttime==time){//check battery status at every given time
		if(flag==1){
			//use websocket for checking battery
			log.info("Requested for battery status from every device");
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
					        	if(value<=threshold){//if lower than threshold
					        		checkSchedule(groupId, 1);//check schedule, if necessary to setup
					        		var updatereactJS='UPDATE reactJS SET active=1 where deviceId =\''+deviceId+'\' ';//updating the reactJS table
					        		connection.query(updatereactJS, function(err, row, fields) {
			        					if (err) 
								        	log.error("Error in updating the reactJS table"+err);
								        else{
								        	log.info("ReactJS column for moisture marked active");
								        	var updateNotif='UPDATE deviceNotif SET field2=1 where deviceId =\''+deviceId+'\' ';//updating the deviceNotif table
							        		connection.query(updateNotif, function(err, row, fields) {
					        					if (err) 
										          log.error("Error in updating the deviceNotif table"+err);
										        else{
										        	log.info("Moisture status updated in deviceNotif table, set to low");
										        }
					        				});
								        }
			        				});
					        		
					        	}
					        	if(value>threshold){//if greater than threshold
					        		var updatereactJS='UPDATE reactJS SET active=0 where deviceId =\''+deviceId+'\' ';;//updating the reactJS table
					        		connection.query(updatereactJS, function(err, row, fields) {
			        					if (err) 
								        	log.error("Error in updating the reactJS table"+err);
								        else{
								        	log.info("ReactJS column for moisture marked inactive");
								        }
			        				});
					        	}
					        }
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
					        	if(value>=threshold){//if lower than threshold
					        		checkSchedule(groupId, 0);//check schedule, if necessary to stop a schedule
					        		var updatereactJS='UPDATE reactJS SET active=1 where deviceId =\''+deviceId+'\' ';//updating the reactJS table
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
										        	log.info("Mositure status updated in deviceNotif table, set to normal");
										        }
					        				});
								        }
			        				});
					        		
					        	}
					        	if(value<threshold){//if greater than threshold
					        		var updatereactJS='UPDATE reactJS SET active=0 where deviceId =\''+deviceId+'\' ';;//updating the reactJS table
					        		connection.query(updatereactJS, function(err, row, fields) {
			        					if (err) 
								        	log.error("Error in updating the reactJS table"+err);
								        else{
								        	log.info("ReactJS column for moisture marked inactive");
								        }
			        				});
					        	}
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
function lowBattery(groupId, conditionValue){ //actionId 6
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
        			if(type==2){
        				var sensorBat='UPDATE deviceNotif SET field1=1 where deviceId in (SELECT device_id FROM feeds WHERE field3<'+conditionValue+' and device_id=\''+deviceId+'\' ORDER BY id DESC LIMIT 1)';
        				connection.query(query, function(err, sensorBat, fields) {
        					if (err) 
					          log.error("Error in checking feeds entry in devices table"+err);
					        else{
					        	log.info("Battery status updated in deviceNotif table, set to adverse");// need to change the whole code
					        }
        				});
        				var sensorBat='UPDATE deviceNotif SET field1=0 where deviceId in (SELECT device_id FROM feeds WHERE field3>'+conditionValue+' and device_id=\''+deviceId+'\' ORDER BY id DESC LIMIT 1)';
        				connection.query(query, function(err, sensorBat, fields) {
        					if (err) 
					          log.error("Error in checking feeds entry in devices table"+err);
					        else{
					        	log.info("Battery status updated in deviceNotif table, set to healthy");// need to change the whole code
					        }
        				});
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
		var checkS='SELECT EXISTS(SELECT * FROM tasks WHERE type=2 and groupId='+groupId+' as find';//check if an automated schedule exists before hand
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
	              		stopTime=date.getHours()*100+100+date.getMinutes();

	                var setSchedule='INSERT INTO tasks (groupId,start, stop, action, type, active) VALUES ('+groupId+',\''+startTime+'\',\''+stopTime+'\',1,2,2)';
	                connection.query(setSchedule, function(err, rows, fields) { //insert into the table 
	                  if (err) 
	                    log.error("MYSQL ERROR in setting up the schedule"+err);
	                  else{
	                  	log.info("Low moisture, automated Schedule started for group id "+groupId);
	                  }
	                });
	            }
	          
	            else{
	              log.info('Do nothing, schedule already exists');
	            }
	        }
      });

	}
	if(check==0){//request for stopping a schedule, just update the stop time, it will go off
		var date=new Date;
	    var stopTime=date.getHours()*100+date.getMinutes(); //HHmm format
		var updateSchedule='UPDATE tasks SET stop=\''+stopTime+'\' WHERE type=2 and groupId='+groupId+' ';//update the stop time of the automated task for the group, if its exists
      	connection.query(updateSchedule, function(err, rows, fields) {
      		if (err) 
            	log.error("MYSQL ERROR in updating the Schedule"+err);
          	else{
          		log.info("Normal moisture, automated Schedule stopped for group id "+groupId);
          	}
      	});

	}
}