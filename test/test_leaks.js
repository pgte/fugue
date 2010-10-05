// Test to see if fugue.start followed fugue.stop lets node.js finish script

//Testing to see if I can get data from 1 worker...

var path             = require('path'),
    net              = require('net'),
    child_process    = require('child_process'),
    assert           = require('assert');
var fugue = require(path.join(__dirname, '..', 'lib', 'fugue.js'));

var server = net.createServer(function(conn) {
});

var port = 4001;
var spawned;

exports.run = function(next) {

  if (!process.env._FUGUE_TEST_LEAKS_SPAWNED) {

    var timeout_id = setTimeout(function() {
      assert.ok(false, "Timeout, subprocess did not exit");
    }, 3000);

    var env = {};
    for(var i in process.env){
      env[i] = process.env[i];      
    }
    env._FUGUE_TEST_LEAKS_SPAWNED = true;
    var args = process.argv;
    spawned = child_process.spawn(args[0], args.slice(1), env);
    spawned.stdout.on('data', function(data) {
      console.log('master: '+data.toString());
    });
    spawned.stderr.on('data', function(data) {
      console.log('master: '+data.toString());
    });
    spawned.on('exit', function() {
      clearTimeout(timeout_id);
      spawned = null;
      next();
    });
    
  } else {
    fugue.start(server, port, null, 1, {
      verbose: false,
      started: function() {
        fugue.stop();
        server.removeAllListeners();
      }
    });
  }

}

exports.teardown = function() {
  if (spawned) spawned.kill();
}