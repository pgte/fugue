var path   = require('path'),
    net    = require('net'),
    assert = require('assert');
var fugue = require(path.join(__dirname, '..', 'lib', 'fugue.js'));

server = net.createServer(function(conn) {
  conn.end('here is some data');
  //assert.ok(false, "Server should not be getting messages with no workers");
});

var port = 4001;

exports.setup = function() {
  fugue.start(server, port, null, 0, {verbose: false} );
}

exports.run = function(next) {

  var client = net.createConnection(port);

  client.on('data', function() {
    assert.ok(false, "I shouldn't be able to connect to zero workers")
  });

  client.on('error', function(error) {
    assert.ok(false, "I got this error: "+error);
  });

  setTimeout(function() {
    process.nextTick(function() {
      if(next) next();
    });

  }, 3000);
  
}
exports.teardown = function() {
  fugue.stop();
}