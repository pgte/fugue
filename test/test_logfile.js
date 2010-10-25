var path   = require('path'),
    net    = require('net'),
    fs     = require('fs'),
    assert = require('assert');
var fugue = require(path.join(__dirname, '..', 'lib', 'fugue.js'));

var expected_data = 'here is some data';
var server = net.createServer(function(conn) {
  conn.on('data', function(log_this) {
    console.log(log_this);
  });
});

var port = 4001;
var log_file_path = '/tmp/_fugue_test_log_file.txt';
var to_log = ['line1', 'line2', 'line3'];

exports.setup = function() {
  if(fugue.isMaster()) {
    try {
      fs.unlinkSync(log_file_path);
    } catch(excp) {
      // do nothing
    }
  }
}

exports.run = function(next) {

  fugue.start(server, port, null, 1, {
    verbose: false,
    log_file: log_file_path,
    started : function() {
      var conn = net.createConnection(port);
      setTimeout(function() {
        
        to_log.forEach(function(log_this) {
          conn.write(log_this + "\n");
        });
        
        setTimeout(function() {
          var log_contents = fs.readFileSync(log_file_path);
          assert.equal(log_contents, to_log.join+"\n", "Contents of log file are this: "+log_contents);
          next();
        }, 3000);

      }, 1000)
    }
  });
  
}

exports.teardown = function() {
  fugue.stop();
  try {
    //fs.unlinkSync(log_file_path);
  } catch(excp) {
    // do nothing
  }
}