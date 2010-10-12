// Testing to see if I have downtime and I change workers when reloading app


var path          = require('path'),
    net           = require('net'),
    child_process = require('child_process'),
    fs            = require('fs'),
    assert        = require('assert');
var fugue = require(path.join(__dirname, '..', 'lib', 'fugue.js'));

var port = 4001;

var master_pid_path = '/tmp/fugue_master_test.pid';

exports.run = function(next) {
  
  if (!process.env._FUGUE_TEST_APP_RELOAD) {
    // spawner
    // spawn new test
    var env = {};
    for(var i in process.env){
      env[i] = process.env[i];      
    }
    env._FUGUE_TEST_APP_RELOAD = true;
    var args = process.argv;
    var spawned = child_process.spawn(args[0], args.slice(1), env);
    spawned.stdout.on('data', function(data) {
      console.log('master: '+data.toString());
    });
    spawned.stderr.on('data', function(data) {
      console.log('master: '+data.toString());
    });
    
    var pids  = {};
    var pid_count = 0;

    var make_call = function() {
      var client = net.createConnection(port);
      client.on('data', function(pid) {
        pid = pid.toString();
        if (!pids[pid]) {
          pids[pid] = true;
          pid_count ++;
        }
        client.end();
      });
      client.on('error', function(error) {
        throw error;
      });
    }
    
    // wait sometime before starting to make calls
    setTimeout(function() {
      // start making calls
      var intervalId = setInterval(make_call, 100);
      setTimeout(function() {
        assert.equal(2, pid_count, "We expected to have contacted 2 workers so far (before the respawn). we contacted "+pid_count);
        // Now, restart app
        spawned.kill('SIGUSR2');
        
        // wait some time before ending
        setTimeout(function() {
          clearInterval(intervalId);
          assert.equal(4, pid_count, "We expected to have contacted 4 workers. we contacted "+pid_count);
          if (next) next();
        }, 5000);
        
      }, 5000);
    }, 2000);
    
  } else {
    // spawned
    server = net.createServer(function(conn) {
      conn.write(process.pid.toString());
      conn.end();
      server.watcher.stop();
    });
    
    fugue.start(server, port, null, 2, {verbose: false  , master_pid_path : master_pid_path } );
    
  }

}

exports.teardown = function() {
  if (!process.env._FUGUE_TEST_APP_RELOAD) {
    pid = parseInt(fs.readFileSync(master_pid_path));
    //console.log('killing '+pid);
    if (pid) {
      child_process.exec('kill '+pid, function(error, stdout, stderr) {
        assert.ok(!error, error);
      });
    }
  }
  
}