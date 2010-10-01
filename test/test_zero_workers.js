var path   = require('path'),
    net    = require('net'),
    assert = require('assert');
var fugue = require(path.join(__dirname, '..', 'lib', 'fugue.js'));

server = net.createServer(function(conn) {
  conn.end('here is some data');
  //assert.ok(false, "Server should not be getting messages with no workers");
});

var port = 4001;
fugue.start(server, port, null, 0, {verbose: false} );

var client = net.createConnection(port);

client.on('data', function() {
  assert.ok(false, "I shouldn't be able to connect to zero workers")
});

client.on('error', function(error) {
  assert.ok(false, "I got this error: "+error);
});

setTimeout(function() {
  process.nextTick(function() {
    process.exit();
  });
  
}, 3000);