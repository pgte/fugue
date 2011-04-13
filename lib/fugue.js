
var the_server;
var workers = [];
var workers_started = 0;
var server_socket;
var master_socket_path;
var master_server;
var killer, respawner;
var worker_kill_timeout;
var resuscitate = true;
var ping_master_interval;

var isMaster = exports.isMaster = function() {
  return !process.env._FUGUE_WORKER;
};
var workerId = exports.workerId = function() {
  return process.env._FUGUE_WORKER !== undefined ? parseInt(process.env._FUGUE_WORKER, 10) : null;
};
var masterSocketPath = exports.masterSocketPath = function() {
  return master_socket_path;
};
exports.workerPids = function() {
  var worker_pids = [];
  workers.forEach(function(worker) {
    worker_pids.push(worker.pid);
  });
  return worker_pids;
};

var stop = exports.stop = function() {

  if (ping_master_interval) {
    clearInterval(ping_master_interval);
  }

  if (isMaster()) {
    //console.log('stopping master with pid ' + process.pid);
    
    var workers_are_all_dead = function() {
      workers = [];
      netBinding = process.binding('net');
      if (server_socket) {
        netBinding.close(server_socket);
      }
      if (the_server) {
        the_server.watcher.stop();
        the_server = null;
      }
      server_socket = null;
      if (master_server) {
        master_server.close();
      }
      if (master_socket_path) {
        // try to remove the
        try {
          require('fs').unlinkSync(master_socket_path);
        } catch(excp) {
          // do nothing
        }
        master_socket_path = null;
      }
      master_server = null;
      process.removeListener('SIGINT', killer);
      process.removeListener('SIGHUP', killer);
      process.removeListener('SIGTERM', killer);
      process.removeListener('SIGUSR2', respawner); 
      
      try {
        process.stdout.end();
      } catch(exxcpe) {
        // do nothing
      }
    };
    
    var workers_died = 0;
    resuscitate = false;
    
    // kill all the hard way if they do not die
    var kill_all_anyway_timeout = setTimeout(function() {
      workers.forEach(function(worker) {
        try {
          if (worker) {
            worker.kill('SIGKILL'); // Kill it dead
          }
          
        } catch(exxcp) {
          // do nothing
        }
      });
      workers_are_all_dead();
    }, worker_kill_timeout);
    
    workers.forEach(function(worker) {
      worker.listeners('exit').forEach(function(listener) {
        worker.removeListener('exit', listener);
      });
      try {
        worker.on('exit', function() {
          workers_died ++;
          if (workers_died == workers.length) {
            clearTimeout(kill_all_anyway_timeout);
            workers_are_all_dead();
          }
        });
        //console.log('killing worker with PID ' + worker.pid); 
        worker.kill();
      } catch(excep) {
        // do nothing, just log
        console.log('Error killing worker with pid ' + worker.pid  + ': ' + excep.message);
      }
    });
  }
};

exports.start = function(server, port, host, worker_count, options) {
  
  the_server = server;

  function isPort (x) { return parseInt(x, 10) >= 0; }

  var unix_socket_path = null;
  if (!isPort(port)) {
    // shift arguments
    options = worker_count;
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
    verbose: false,
    worker_to_master_ping_interval: 30000,
    worker_kill_timeout: 30000
  };
  if (options) {
    (function(obj1, obj2) {
      for (var attrname in obj2) {
        obj1[attrname] = obj2[attrname];
      }
    })(default_options, options);
  }
  options = default_options;

  worker_kill_timeout = options.worker_kill_timeout;

  var path = require('path');
  // check if paths exist
  if (!path.existsSync(options.tmp_path)) {
    throw new Error("Temp path " + options.tmp_path + " does not exist. Please create it");
  }
  if (!path.existsSync(options.working_path)) {
    throw new Error("Working path " + options.working_path + " does not exist. Please create it");
  }


  // setup log function
  var log = options.verbose ?
    function(what) { console.log('process ' + process.pid + ' said: ' + what); } :
    function() {};

  // Master or worker?
  var worker_id = process.env._FUGUE_WORKER;
  var is_master = !worker_id;

  // daemonize?
  if (is_master && options.daemonize && !process.env._FUGUE_ORIG_MASTER_PID) {
    throw new Error('daemonizing is no longer supported in fugue due to event loop getting apparently borked after fork. Please refer to http://howtonode.org/deploying-node-upstart-monit if you want to daemonize your app.');
    log('daemonizing ' + process.pid);
    daemon = require(__dirname + '/../build/default/daemon');
    var new_fd = (options.log_file ? process.stdout.fd : fs.open('/dev/null'))
    var ret_pid = daemon.start(new_fd);
    process.pid = ret_pid;
    log('spawned PID:'+ret_pid);
    //console.log = function() {
      // do nothing
    //};
    //log('daemonized');
  }

  // require needed modules
  var net   = require('net'),
      http  = require('http'),
      spawn = require('child_process').spawn,
      fs    = require('fs'),
      netBinding = process.binding('net');

  // Redirect stdout and stderr
  if (options.log_file) {
    fs.close(process.stdout.fd);
    process.stdout.fd = fs.openSync(options.log_file, 'a');
    console.log = function(what) {
      process.stdout.write(what + "\n");
    }
  }

  // calculate master_socket_path.
  // It can come from env if we have been spawned or we have to create a new one
  master_socket_path = null;
  if (process.env._FUGUE_MASTER_SOCKET_PATH) {
    master_socket_path = process.env._FUGUE_MASTER_SOCKET_PATH;
  }
  log('Using master socket path: ' + master_socket_path);

  if (is_master) { // Master
    
    var old_master_socket_path = process.env._FUGUE_MASTER_SOCKET_PATH;

    master_socket_path = process.env._FUGUE_MASTER_SOCKET_PATH = path.join(options.tmp_path, 'fugue_' + process.pid + '_master.sock');

    // If we are respawned from another master we have to setsid anyway
    if (process.env._FUGUE_ORIG_MASTER_PID) {
      daemon = require(__dirname + '/../build/default/daemon');
      daemon.setSid();
    }
    log('Starting new master...');

    if (options.master_log_file) {
      fs.close(process.stdout.fd);
      process.stdout.fd = fs.openSync(options.master_log_file, 'w');
    }

    if ((process.env._FUGUE_PORT || process.env._FUGUE_SOCKET) && process.env._FUGUE_ORIG_MASTER_PID) { // we were respawned by another master
      try {
        log('Trying to get socket back from original server...');
        // request socket to original server
        // this startup part has to work synchronously, so we dig deep into the bindings...
        var client_socket = netBinding.socket('unix');
        log('connecting to ' + old_master_socket_path);
        netBinding.connect(client_socket, old_master_socket_path);
        var request_buffer = new Buffer("GIMME_SOCKET\n", 'ascii');
        netBinding.write(client_socket, request_buffer, 0, request_buffer.length);
        var responseBuffer = new Buffer(256);
        var length = null;
        // Node returns length and sets (or not) fd by design as explained in node_net.cc / RecvMsg
        do {
          length = netBinding.recvMsg(client_socket, responseBuffer, 0, responseBuffer.length);
        } while(!netBinding.recvMsg.fd);

        log('Got response from server:' + responseBuffer.toString('ascii', 0, length));
        server_socket = netBinding.recvMsg.fd;
      } catch(error) {
        log('Error trying to get server file descriptor: ' + error.message);
      }

      if (!server_socket) {
        log('Failed to get socket from original server.');
        log('Now I\'m going to try to create one...');
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
        server_socket = netBinding.socket('tcp' + (netBinding.isIP(host) == 6 ? 6 : 4));
        netBinding.bind(server_socket, port, host);
        process.env._FUGUE_PORT = port;
        process.env._FUGUE_HOST = host;
      }
      netBinding.listen(server_socket, 128);
    }

    master_server = net.createServer(function(conn) {
      require('carrier').carry(conn, function(command){
        switch(command.toString()) {
          case 'GIMME_SOCKET':
            log('serving server socket file descriptor ' + server_socket);
            conn.write('HERE_YOU_GO', 'ascii', server_socket);
            break;
          case 'LISTENING':
            workers_started ++;
            if (options.started && workers_started == worker_count) {
              options.started();
            }
            conn.end();
            break;
          case 'PING':
            conn.end("PONG\n");
            break;
        }
      });
    });
    master_server.listen(master_socket_path, function() {
      workers = [];
      workers_started = 0;

      var spawn_worker = function(worker_idx) {
        // prepare environment for worker
        var env = {};
        for (var i in process.env) {
          env[i] = process.env[i];
        }
        env._FUGUE_WORKER = "" + (worker_idx + 1);
        var args = process.argv;

        // spawn worker process
        var stdio = process.binding("stdio");
        var fds = [ stdio.stdinFD, process.stdout.fd, stdio.stderrFD ];
        var new_worker = workers[worker_idx] = spawn(args[0], args.slice(1), {env: env, customFds: [-1, -1, -1]});
        // listen for when the worker dies and bring him back to life
        new_worker.stdout.on('data', function(data) { log('child ' + worker_idx + 'said: ' + data); });
        new_worker.stderr.on('data', function(data) { log('child ' + worker_idx + 'said: ' + data);});
        new_worker.on('exit', function() {
          if (resuscitate) {
            log('Child ' + worker_idx + ' with PID ' + new_worker.pid + ' of master with PID ' + process.pid + ' died. Respawning it.');
            spawn_worker(worker_idx);
          }
        });

      };

      log('Spawning workers...');
      process.env._FUGUE_WORKER_COUNT = worker_count;
      for (var worker_idx = 0; worker_idx < worker_count; worker_idx ++) {
        spawn_worker(worker_idx);
      }
      log('spawned.');

      killer = function() {
        log('killer here');
        stop();
        process.nextTick(function() {
          process.exit();
        });
      };

      // Listen for process exits
      process.on('SIGINT', killer);
      process.on('SIGHUP', killer);
      process.on('SIGTERM', killer);

      log('master process PID: '+process.pid);


      // Listen to SIGUSR2 for master restarts
      respawner = function() {
        log('Got SIGUSR2, respawning self');
        // respawn self
        var env = {};
        for(var i in process.env) {
          env[i] = process.env[i];
        }
        env._FUGUE_ORIG_MASTER_PID = process.pid.toString();
        var args = process.argv;

        // spawn worker process
        var spawned = spawn(args[0], args.slice(1), env);
        spawned.stdout.on('data', function(data) {
          log("New master goes: " + data);
        });
      };
      process.on('SIGUSR2', respawner);

      // Save master PID
      if (options.master_pid_path) {
        fs.writeFile(options.master_pid_path, process.pid.toString(), function(error) {
          if (error) {
            throw new Error("Error saving master PID file in " + options.master_pid_path + ': ' + error);
          }
        });
      }
      
    });


  } else { // Worker

    log('Worker here');
    var die_soon = false;
    var ping_master_interval;

    process.on('exit', function() {
      log("Worker " + worker_id + " exiting.");
    });

    var connection = net.createConnection(master_socket_path);
    log('worker trying to connect to master...');
    connection.on('connect', function() {
      log('worker connected to master');
      connection.write("GIMME_SOCKET\n");
      connection.flush();
      connection.on('fd', function(fd) {
        
        if (process.env._FUGUE_ORIG_MASTER_PID) {
          var kill_master_pid = parseInt(process.env._FUGUE_ORIG_MASTER_PID, 10);
          // only the last worker tries to kill original master
          if (!!kill_master_pid && workerId() == process.env._FUGUE_WORKER_COUNT && !process.env._FUGUE_KILLED_ORIG_WORKER) {
            log('killing original master with pid ' + kill_master_pid);
            try {
              process.kill(kill_master_pid);
            } catch(excp) {
              // do nothing
            }
            process.env._FUGUE_KILLED_ORIG_WORKER = true;
          }
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
        log('worker listening');
        
        connection.end("LISTENING\n");

        // Setup killer
        var worker_killer = function() {
          log('worker killer activated...');
          die_soon = true;
          if (ping_master_interval) {
            clearInterval(ping_master_interval);
            ping_master_interval = null;
          }

          log('I have ' + server.connections + ' server connections');

          if(server.connections === 0) {
            process.exit();
          } else {
            // Stop listening for new connections - remove watcher from the event loop
            server.watcher.stop();
            // Set process to die after serving existing connections
   
            // Track connections so we don't die in the middle of serving one
            var die_soon_interval = setInterval(function() {
              if (server.connections == 0) {
                clearInterval(die_soon_interval);
                die_soon_interval = undefined;
                process.exit();
              }
            }, 1000);
            
            setTimeout(function() {
              if (die_soon_interval) {
                clearInterval(die_soon_interval);
              }
              process.exit();
            }, 30000);

          }
        };
        process.on('SIGINT', worker_killer);
        process.on('SIGHUP', worker_killer);
        process.on('SIGTERM', worker_killer);
        log('worker setup of signals is done');

        // Setup to ping master and die if it fails
        ping_master_interval = setInterval(function() {
          var ping_connection = net.createConnection(master_socket_path);
          ping_connection.on('connect', function() {
            //console.log('PING');
            ping_connection.write("PING\n");
            require('carrier').carry(ping_connection, function(response) {
              if(response == 'PONG') {
                //console.log('PONG');
                ping_connection.end();
              }
            });
          });
          ping_connection.on('error', function(error) {
            if (ping_master_interval) {
              clearInterval(ping_master_interval);
              ping_master_interval = null;
            }
            if(!die_soon) {
              log('ping error to server: '+error);
              log('going to shutdown because of it');
              worker_killer();
            }
          });
        }, options.worker_to_master_ping_interval);

      });
    });
    
  }
};
