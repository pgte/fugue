// Testing to see if I have downtime and I change workers when reloading app


var path          = require('path'),
    net           = require('net'),
    child_process = require('child_process'),
    fs            = require('fs'),
    assert        = require('assert');
var fugue = require(path.join(__dirname, '..', 'lib', 'fugue.js'));

var port = 4001;
var master_debug_port = 4002;

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
      
      // get the worker pids
      var client = net.createConnection(master_debug_port);
      client.on('data', function(worker_pids) {
        worker_pids = worker_pids.toString().split(',');
        assert.equal(2, worker_pids.length, "expected 2 worker pids and I get " + worker_pids.length);
        client.end();
        
        // kill master without it knowing
        spawned.kill('SIGKILL');
        
        // wait some time to let the workers die
        setTimeout(function() {
          //console.log('woke up');
          //console.log(require('sys').inspect(worker_pids));
          worker_pids.forEach(function(worker_pid) {
            var command = 'ps '+worker_pid + ' | grep '+worker_pid;
            //console.log('issuing command '+command);
            child_process.exec(command, function(error, stdout, stderr) {
              //console.log(command + ' done');
              assert.equal('', stderr, 'error executing command ' + command);
              assert.equal('', stdout, 'looks like worker processes are still working. command output was: '+stdout);
              next();
            });
          });
        }, 3000);
      });
      
    }, 2000);
    
  } else {
    // spawned
    server = net.createServer(function(conn) {
      conn.end('Hello');
    });
    
    if (fugue.isMaster()) {
      net.createServer(function(conn) {
        conn.end(fugue.workerPids().join(','));
      }).listen(master_debug_port);
    }
    
    fugue.start(server, port, null, 2, {verbose: false  , master_pid_path : master_pid_path, worker_to_master_ping_interval: 1000 } );
    
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
