// Testing to see if there is any pipe leaks because of constant worker connections to master requesting PINGs.
// We set fugue option worker_to_master_ping_interval to a low value to speed up the test and then wait for 1 minute
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

    var exiting = false;

    var timeout_id = setTimeout(function() {
      exiting = true;
      spawned.kill();
      next();
    }, 60000);

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
      assert.ok(exiting, 'Master exited');
    });
    
  } else {
    fugue.start(server, port, null, 4, {
      verbose: false,
      worker_to_master_ping_interval: 50
    });
  }

}