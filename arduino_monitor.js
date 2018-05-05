const LOG_FOLDER = __dirname + '/log';

var fs = require('fs');
var mkdirp = require('mkdirp');
var SerialPort = require('serialport');

var port = new SerialPort('/dev/ttyUSB0', {
	parser: SerialPort.parsers.readline('\n'),
	baudRate: 115200,
	dataBits: 8,
	parity: 'none',
	stopBits: 1
});

port.open();

port.on('open', function() {

});

port.on('error', function(err) {
	console.warn(err.message);
});

port.on('data', function(data) {
	appendToLog(data);
});

function pad(n, width, z) {
	z = z || '0';
	n = n + '';
	return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function getLogFilename(date) {
	var current_day = date.getDate();
	var current_month = date.getMonth() + 1;
	var current_year = date.getFullYear();
	return LOG_FOLDER + '/' + pad(current_day, 2) + pad(current_month, 2) + current_year + ".txt";
}

function appendToLog(line) {
	var date = new Date();
	var filename = getLogFilename(date);
	console.log('current file name:', filename);
	checkForFile(filename, function() {
		fs.appendFile(filename, line, function(err) {
			if (err) {
				console.warn('Error appending to file');
				return;
			}
			console.log('[data]:', line);
		});
	});
}

function checkForFile(fileName, callback) {
	fs.exists(fileName, function(exists) {
		if (exists) {
			callback();
		} else {
			mkdirp(LOG_FOLDER, function(err) {
				if (!err) {
					fs.writeFile(fileName, null, function(err, data) {
						callback();
					});
				}
			});
		}
	});
}