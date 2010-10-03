//Testing to see if I can get data from 1 worker...

var path   = require('path'),
    net    = require('net'),
    assert = require('assert'),
    fs     = require('fs');
var fugue = require(path.join(__dirname, '..', 'lib', 'fugue.js'));

var expected_data = 'here is some data';
var server = net.createServer(function(conn) {
  conn.end(process.cwd());
});

var port = 4001;

var expected_working_path = path.join(__dirname, '..', 'examples');

exports.setup = function() {
  fugue.start(server, port, null, 1, {verbose: false, working_path: expected_working_path} );  
}

exports.run = function(next) {
  setTimeout(function() {
    var master_socket_path = fugue.masterSocketPath();
    assert.ok(master_socket_path, "No master socket path defined");
    fs.stat(master_socket_path, function(err, stat) {
      if(err) throw err;
      assert.equal(stat.uid, process.getuid());
      assert.equal(stat.mode, 49600);
      next();
    })
  }, 1000);
}

exports.teardown = function() {
  fugue.stop();
}