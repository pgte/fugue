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
    tmp_path : '/tmp',
    uid : process.getuid(),
    gid : process.getgid(),
    daemonize: false,
    verbose: true
  }
  if (options) {
    (function(obj1, obj2) {
      for (attrname in obj2) { obj1[attrname] = obj2[attrname]; }
    })(default_options, options);
  }
  options = default_options;
  
  var path = require('path');
  // check if paths exist
  if (!path.existsSync(options.tmp_path)) {
    throw "Temp path "+options.tmp_path + " does not exist. Please create it";
  }
  if (!path.existsSync(options.working_path)) {
    throw "Working path "+options.working_path + " does not exist. Please create it";
  }


  // setup log function
  var log = options.verbose ?
    function(what) { console.log(what); } :
    function() {};

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
      path  = require('path'),
      netBinding = process.binding('net');

  // Redirect stdout and stderr
  if (options.log_file) {
    process.stdout.fd = fs.openSync(options.log_file, 'a');
  }
  
  // calculate master_socket_path.
  // It can come from env if we have been spawned or we have to create a new one
  var master_socket_path = null;
  if (process.env._FUGUE_MASTER_SOCKET_PATH) {
    if (path.existsSync(process.env._FUGUE_MASTER_SOCKET_PATH)) {
      master_socket_path = process.env._FUGUE_MASTER_SOCKET_PATH;
    }
  }
  if (!master_socket_path) {
    // make new
    master_socket_path = process.env._FUGUE_MASTER_SOCKET_PATH = path.join(options.tmp_path, 'fugue_'+process.pid+'_master.sock');
  }
  
  log('Using master socket path: '+master_socket_path);

  if (is_master) { // Master
    
    // If we are respawned from another master we have to setsid anyway
    if (process.env._FUGUE_ORIG_MASTER_PID) {
      daemon = require(__dirname+'/../build/default/daemon');
      daemon.setSid();
    }
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
        log('connecting to '+master_socket_path);
        netBinding.connect(client_socket, master_socket_path);
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
    }).listen(master_socket_path);

    var workers = [];
    
    var spawn_worker = function(worker_idx) {
      // prepare environment for worker
      var env = {};
      for(var i in process.env){
        env[i] = process.env[i];
      }
      env._FUGUE_WORKER = "" + (worker_idx + 1);
      var args = process.argv;

      // spawn worker process
      var new_worker = workers[worker_idx] = spawn(args[0], args.slice(1), env);
      if(!options.log_file) {
        // if worker does not log into file, pipe the worker output here
        var worker_log = function(what) {
          log("WORKER "+worker_idx+ ": " + what.toString());
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
    process.env._FUGUE_WORKER_COUNT = worker_count;
    for (var worker_idx = 0; worker_idx < worker_count; worker_idx ++) {
      spawn_worker(worker_idx);
    }
    log('spawned.')
    
    var killer = function() {
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

    // Listen for process exits
    // process.on('exit', world_killer);
    process.on('SIGINT', killer);
    process.on('SIGHUP', killer);
    process.on('SIGTERM', killer);
    
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
    
    // Save master PID
    if (options.master_pid_path) {
      fs.writeFile(options.master_pid_path, process.pid.toString(), function(error) {
        if (error) throw "Error saving master PID file in "+options.master_pid_path+': '+error;
      });
    }
    
    

  } else { // Worker
    
    log('Worker here');
    
    // track connections here
    var connection_count = 0;
    
    var die_soon = false; // tells if worker should die after serving exisiting connections
    // Setup killer
    var worker_killer = function() {
      if(connection_count == 0) {
        process.nextTick(function() {
          process.exit();
        });        
      } else {
        // Stop listening for new connections - remove watcher from the event loop
        server.watcher.stop();
        // Set process to die after serving existing connections
        die_soon = true;
      }
    }
    process.on('SIGINT', worker_killer);
    process.on('SIGHUP', worker_killer);
    process.on('SIGTERM', worker_killer);
    
    process.on('exit', function() {
      log("Worker "+worker_id+" exiting.");
    });

    var connection = net.createConnection(master_socket_path).on('connect', function() {
      connection.write('GIMME_SOCKET');
      connection.on('fd', function(fd) {

        var kill_master_pid = parseInt(process.env._FUGUE_ORIG_MASTER_PID);
        // only the last worker tries to kill original master
        if (!!kill_master_pid && workerId() == process.env._FUGUE_WORKER_COUNT) {
          log('killing original master');
          process.kill(kill_master_pid);
        }
        
        // change working dir
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

        server.listenFD(fd);        

      });
    });
    
    // Track connections so we don't die in the middle of serving one
    server.on('connection', function(connection) {
      connection_count ++;
      connection.on('end', function() {
        connection_count --;
        if (die_soon && connection_count == 0) {
          process.exit();
        }
      });
    });

  }
}

exports.isMaster = function() {
  return !process.env._FUGUE_WORKER;
}
var workerId = exports.workerId = function() {
  return process.env._FUGUE_WORKER !== undefined ? parseInt(process.env._FUGUE_WORKER) : null;
}