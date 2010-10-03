//Testing to see if I can get data from 1 worker...

var path   = require('path'),
    net    = require('net'),
    assert = require('assert');
var fugue = require(path.join(__dirname, '..', 'lib', 'fugue.js'));

var expected_data = 'here is some data';
server = net.createServer(function(conn) {
  conn.end(expected_data);
});

var port = 4001;

exports.setup = function() {
  fugue.start(server, port, null, 1, {verbose: false} );  
}

exports.run = function(next) {

  var client = net.createConnection(port);

  var got_some_data = false;
  client.on('data', function(what) {
    got_some_data = true;
    assert.equal(what.toString(), expected_data);
    process.exit();
  });

  setTimeout(function() {
    assert.ok(got_some_data, "Couldn't get data from server");
    if(next) next();
  }, 3000);
}

exports.teardown = function() {
  fugue.stop();
}