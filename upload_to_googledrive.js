var fs = require('fs');
var request = require('request');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

var SCOPES = ['https://www.googleapis.com/auth/drive'];
var TOKEN_DIR = __dirname + "/credentials/";
var TOKEN_PATH = TOKEN_DIR + 'drive-nodejs-quickstart.json';

const PARENT_FOLDER_ID = '0BwYYDQN9oiY4aUliblMxZGNNTWc'; // Save to this folder (uploaded)
const LOG_FOLDER = __dirname + '/log';

var file_to_upload = "";

const CONFIG_FILE = 'config.json';

function pad(n, width, z) {
	z = z || '0';
	n = n + '';
	return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function getLogFilename(date) {
	var current_day = date.getDate();
	var current_month = date.getMonth() + 1;
	var current_year = date.getFullYear();
	return pad(current_day, 2) + pad(current_month, 2) + current_year + ".txt";
}

function getCurrentLogFile() {
	var date = new Date();
	return getLogFilename(date);
}


function save_last_uploaded(name) {
	fs.readFile(CONFIG_FILE, function processClientSecrets(err, content) {
		if (err) {
			console.log('Error loading config file: ' + err);
		}
		var json = JSON.parse(content);
		json.lastuploaded = name;

		fs.writeFile(CONFIG_FILE, JSON.stringify(json), function(err) {
			if (err) {
				return -1;
			}
			console.log("Last uploaded file was updated");
		});
	});
}

function sync_now() {
	var date = new Date();
	date.setDate(date.getDate() - 1); // Yesterday
	file_to_upload = getLogFilename(date);
	console.log('Should upload this file:', file_to_upload);

	var last_uploaded_file = '';
	fs.readFile(CONFIG_FILE, 'utf8', function(err, content) {
		if (err) {
			console.log('Error loading config file: ' + err);
		} else {
			var json = JSON.parse(content);
			last_uploaded_file = json.lastuploaded;
			if (last_uploaded_file != file_to_upload) {
				// Should upload now
				upload_to_google_drive();
			} else {
				console.log("No need for any updates");
			}
		}
	});
}


function upload_to_google_drive() {
	fs.readFile('client_secret.json', function processClientSecrets(err, content) {
		if (err) {
			console.log('Error loading client secret file: ' + err);
			return;
		}
		authorize(JSON.parse(content), run);
	});
}


function authorize(credentials, callback) {
	var clientSecret = credentials.web.client_secret;
	var clientId = credentials.web.client_id;
	var redirectUrl = credentials.web.redirect_uris[0];
	var auth = new googleAuth();
	oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

	// Check if we have previously stored a token.
	fs.readFile(TOKEN_PATH, function(err, token) {
		if (err) {
			getNewToken(oauth2Client, callback);
		} else {
			oauth2Client.setCredentials(JSON.parse(token));
			callback(oauth2Client);
		}
	});
}

// Request a new token
function getNewToken(oauth2Client, callback) {
	var authUrl = oauth2Client.generateAuthUrl({
		access_type: 'offline',
		approval_prompt: 'force',
		scope: SCOPES
	});
	console.log('Authorize this app by visiting this url: ', authUrl);
	var rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
	rl.question('Enter the code from that page here: ', function(code) {
		rl.close();
		oauth2Client.getToken(code, function(err, token) {
			if (err) {
				console.log('Error while trying to retrieve access token', err);
				return;
			}
			oauth2Client.credentials = token;
			storeToken(token);
			callback(oauth2Client);
		});
	});
}

// Store the token to be used in future uploads
function storeToken(token) {
	try {
		fs.mkdirSync(TOKEN_DIR);
	} catch (err) {
		if (err.code != 'EEXIST') {
			throw err;
		}
	}
	fs.writeFile(TOKEN_PATH, JSON.stringify(token));
	console.log('Token stored to ' + TOKEN_PATH);
}


function upload_log(filename, accessToken, callback) {
	var file_path = LOG_FOLDER + '/' + filename;
	fs.exists(file_path, function(exists) {
		if (!exists) {
			console.warn('(!) log file does not exist:', file_path);
			return;
		}
		var fstatus = fs.statSync(file_path);
		fs.open(file_path, 'r', function(status, fileDescripter) {
			if (status) {
				callback(status.message);
				return;
			}
			var buffer = new Buffer(fstatus.size);

			fs.read(fileDescripter, buffer, 0, fstatus.size, 0, function(err, num) {
				if (err) {
					console.warn('(!) Error reading log file:', file_path);
					return;
				}
				request.post({
					'url': 'https://www.googleapis.com/upload/drive/v2/files',
					'qs': {
						//request module adds "boundary" and "Content-Length" automatically.
						'uploadType': 'multipart'
					},
					'headers': {
						'Authorization': 'Bearer ' + accessToken
					},
					'multipart': [{
						'Content-Type': 'application/json; charset=UTF-8',
						'body': JSON.stringify({
							'title': filename,
							'parents': [{
								'id': PARENT_FOLDER_ID
							}]
						})
					}, {
						'Content-Type': 'text/log',
						'body': buffer
					}]
				}, callback);

			});
		});
	});



}

function run(auth) {
	upload_log(file_to_upload, auth.credentials.access_token, done);
}

function done(response, data) {
	var data = JSON.parse(data.body);
	if (data.hasOwnProperty('error')) {
		console.log('could not upload the file');
		oauth2Client.refreshAccessToken(function(err, token) {
			if (err) {
				console.warn('(!)', err);
			} else {
				console.log('refreshed tokens:');
				console.log(token);
				storeToken(token, function() {
					console.log('[Notice] New access token stored');
				});
			}
		});
	} else {
		console.log('file uploaded succesfully');
		save_last_uploaded(file_to_upload);
	}
}

sync_now();