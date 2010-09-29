exports.start = function(server, port, host, worker_count, options) {

  function isPort (x) { return parseInt(x) >= 0; }
  
  var unix_socket_path = null;
  if (!isPort(port)) {
    // shift arguments
    in_options = worker_count;
    worker_count = host;
    unix_socket_path = port;
  }
  // merge options
  var default_options = {
    working_path : process.cwd(),
    tmp_path : 'tmp',
    //log_file : process.stdout,
    //master_log_file : process.stdout,
    uid : process.getuid(),
    gid : process.getgid(),
    daemonize: false
  }
  if (options) {
    (function(obj1, obj2) {
      for (attrname in obj2) { obj1[attrname] = obj2[attrname]; }
    })(default_options, options);
  }
  options = default_options;

  // setup log function
  var log = function(what) {
    if (options.verbose) console.log(what);
  }

  // Master or worker?
  var worker_id = process.env._FUGUE_WORKER;
  var is_master = !worker_id;

  // daemonize?
  if (is_master && options.daemonize) {
    log('daemonizing '+process.pid);
    daemon = require(__dirname+'/../build/default/daemon');
    daemon.setSid();
    log('daemonized');
  }
  
  // require needed modules
  var net   = require('net'),
      http  = require('http'),
      spawn = require('child_process').spawn,
      sys   = require('sys'),
      fs    = require('fs'),
      netBinding = process.binding('net');
      
  var socket_server_socket_path = options.tmp_path + '/fugue_master.sock'

  // Redirect stdout and stderr
  if (options.log_file) {
    process.stdout.fd = fs.openSync(options.log_file, 'a');
  }

  if (is_master) { // Master
    
    log('Starting new master...');
    
    if (options.master_log_file) {
      process.stdout.fd = fs.openSync(options.master_log_file, 'w');
    }

    var server_socket = null;
    if (process.env._FUGUE_PORT && process.env._FUGUE_ORIG_MASTER_PID) { // we were respawned by another master
      try {
        log('Trying to get socket back from original server...');
        // request socket to original server
        // this startup part has to work synchronously, so we dig deep into the bindings...
        var client_socket = netBinding.socket('unix');
        log('connecting to '+socket_server_socket_path);
        netBinding.connect(client_socket, socket_server_socket_path);
        var request_buffer = new Buffer('GIMME_SOCKET', 'ascii');
        netBinding.write(client_socket, request_buffer, 0, request_buffer.length);
        var responseBuffer = new Buffer(256);
        var length = null;
        do {
          length = netBinding.recvMsg(client_socket, responseBuffer, 0, responseBuffer.length)
        } while(!netBinding.recvMsg.fd);
        
        log('Got response from server:'+responseBuffer.toString('ascii', 0, length));
        if (netBinding.recvMsg.fd) {
          server_socket = netBinding.recvMsg.fd;
        } else {
          log('Response got no file descriptor... (bad)');
        }
      } catch(error) {
        log('Error trying to get server file descriptor: '+error.message);
      }
      if (!server_socket) {
        log('Failed to get socket from original server.');
        log('Now I\'m going to try to create one...')
      }
      
    }
    if (!server_socket) {
      // Now we have to create a socket

      if (unix_socket_path) {
        // UNIX socket        
        
        // remove socket file if it exists
        try {
          fs.unlinkSync(unix_socket_path);
        } catch(err) {
          // do nothing, file does not exist
        }
        
        server_socket = netBinding.socket('unix');
        netBinding.bind(server_socket, unix_socket_path);
        process.env._FUGUE_SOCKET = unix_socket_path;
      } else {
        // TCP socket
        server_socket = netBinding.socket('tcp'+(netBinding.isIP(host) == 6 ? 6 : 4));
        netBinding.bind(server_socket, port, host);
        process.env._FUGUE_PORT = port;
        process.env._FUGUE_HOST = host;
      }
      netBinding.listen(server_socket, 128);
    }
    
    log('Have server socket: ' + server_socket);

    var fd_server = net.createServer(function(conn) {
      conn.on('data', function(data) {
        log('got data for fd_server');
        if (data.toString() == 'GIMME_SOCKET') {
          log('serving server socket file descriptor ' + server_socket);
          conn.write('HERE_YOU_GO', 'ascii', server_socket);
        }      
      });
    }).listen(socket_server_socket_path);

    var workers = [];
    
    var spawn_worker = function(worker_idx) {
      // prepare environment for worker
      var env = {};
      for(var i in process.env){
        env[i] = process.env[i];
      }
      env._FUGUE_WORKER = "" + worker_idx;
      var args = process.argv;

      // spawn worker process
      var new_worker = workers[worker_idx] = spawn(args[0], args.slice(1), env);
      if(!options.log_file) {
        // if worker does not log into file, pipe the worker output here
        var worker_log = function(what) {
          log("WORKER "+worker_idx, ": " + what);
        }
        new_worker.stdout.on('data', worker_log);        
        new_worker.stderr.on('data', worker_log);
      }
      
      // listen for when the worker dies and bring him back to life
      new_worker.on('exit', function() {
        log('Child '+worker_idx+' died. Respawning it.');
        spawn_worker(worker_idx);
      });
      
    }
    
    // fork workers
    log('Spawning workers...');
    for (var worker_idx = 0; worker_idx < worker_count; worker_idx ++) {
      spawn_worker(worker_idx);
    }
    log('spawned.')
    
    var world_killer = function() {
      log('exiting.');
      for(var i in workers) {
        var worker =  workers[i];
        worker.removeAllListeners(); // Prevent from master respawn
        try {
          worker.kill();
        } catch(excep) {
          // do nothing, as the error is probably that the process does no longer exist
        }
      }
      workers = [];
      netBinding.close(server_socket);
      process.removeAllListeners();
      process.nextTick(function() {
        process.exit();
      });
    }

    // Listen for pricess exits
    //process.on('exit', world_killer);
    process.on('SIGINT', world_killer);
    process.on('SIGHUP', world_killer);
    process.on('SIGTERM', world_killer);
    
    // Listen to SIGUSR2 for master restarts
    process.on('SIGUSR2', function() {
      log('Got SIGUSR2, respawning self');
      // respawn self
      var env = {};
      for(var i in process.env){
        env[i] = process.env[i];
      }
      env._FUGUE_ORIG_MASTER_PID = process.pid.toString();
      var args = process.argv;
      
      // spawn worker process
      spawned = spawn(args[0], args.slice(1), env);
      spawned.stdout.on('data', function(data) {
        log("New master goes: "+data);
      });
      
    });

  } else { // Worker
    
    var kill_master_pid = parseInt(process.env._FUGUE_ORIG_MASTER_PID);
    if (!!kill_master_pid && workerId() == 0) { // only the first worker tries to kill original master
      process.kill(kill_master_pid);
    }
    
    process.on('exit', function() {
      process.stdout.writeSync("Worker "+worker_id+" exiting.")
      process.stdout.flush();
      process.stdout.end();
    });

    var connection = net.createConnection(socket_server_socket_path).on('connect', function() {
      connection.write('GIMME_SOCKET');
      connection.on('fd', function(fd) {
        server.listenFD(fd);      
        if (process.cwd() != options.working_path) {
          process.chdir(options.working_path);
        }
        // set gid
        if(process.getgid() != options.gid) {
          process.setgid(options.gid);
        }
        // set uid
        if(process.getuid() != options.uid) {
          process.setuid(options.uid);
        }
      });
    });
    

  }
}

exports.isMaster = function() {
  return !process.env._FUGUE_WORKER;
}
var workerId = exports.workerId = function() {
  return process.env._FUGUE_WORKER !== null ? parseInt(process.env._FUGUE_WORKER) : null;
}