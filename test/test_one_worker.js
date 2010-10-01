//Testing to see if I can get data from 1 worker...
var path   = require('path'),
    net    = require('net'),
    assert = require('assert');
var fugue = require(path.join(__dirname, '..', 'lib', 'fugue.js'));

var expected_data = 'here is some data';
server = net.createServer(function(conn) {
  conn.end(expected_data, 'ascii');
});

var port = 4001;
fugue.start(server, port, null, 1, {verbose: false} );

var client = net.createConnection(port);

var got_some_data = false;
client.on('data', function(what) {
  got_some_data = true;
  assert.equal(what.toString('ascii'), expected_data);
});

setTimeout(function() {
  assert.ok(got_some_data, "Couldn't get data from server");
  process.exit();
}, 3000);