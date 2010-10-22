//Testing to see if I can get data from 1 worker...

var path   = require('path'),
    net    = require('net'),
    assert = require('assert');
var fugue = require(path.join(__dirname, '..', 'lib', 'fugue.js'));

var expected_data = 'here is some data';
var server = net.createServer(function(conn) {
  conn.end(process.getuid().toString());
});

var port = 4001;
var uid = 501;

var expected_working_path = path.join(__dirname, '..', 'examples');

exports.setup = function() {
  fugue.start(server, port, null, 1, {verbose: false, uid: uid} );  
}

exports.run = function(next) {

  var client = net.createConnection(port);

  var got_some_data = false;
  client.on('data', function(uid) {
    assert.equal(uid.toString(), uid);
    next();
  });

  setTimeout(function() {
    assert.ok(got_some_data, "Couldn't get data from server");
    if(next) next();
  }, 3000);
}

exports.teardown = function() {
  fugue.stop();
}