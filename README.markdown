# Multiple node server instance manager with Unicorn-like features

Heavily inspired by [Spark](http://github.com/senchalabs/spark) and [Unicorn](http://unicorn.bogomips.org/)

## Features:

* Supports any type of Node.js server as long as it inherits from net.Server (http.Server, connect.Server, ...).
* Failover -  when a worker dies it is restarted.
* Zero downtime app reload.
* Set gid, uid.
* Set working dir.
* Redirect stdout to log files for master / workers
* daemonize properly.

## Install:

    nmp install fugue

## Usage:

Example:

    var fugue = require('fugue'),
        net =   require('net');

    var server = net.createServer(function(conn) {
      conn.end(process.pid.toString() + "Hello from "+fugue.workerId()+". I am user " + process.getuid() + " on dir " + process.cwd());
    });

    fugue.start(server, 4000, null, 2, {verbose : true});

Having trouble? read the [FAQ](http://github.com/pgte/fugue/wiki/FAQ).

### fugue.start

For UNIX sockets:

    fugue.start(server, socket_path, number_of_workers, options);
    
For TCP:

    fugue.start(server, port, host, number_of_workers, options);

### Options on fugue.start:

* working_path : absolute path for the working dir
* tmp_path : the absolute path for the temp dir. defaults to current_dir/tmp
* log_file : the full path of the log file if you wish stdout to be redirected there. All workers + master will write here. If absent does not touch stdout.
* master_log_file : alternative path for the log file for the master only.
* uid : unix user id for workers. Defaults to current user
* gid : unix group id for workers. Defaults to current group
* daemonize : to fork and detach

### How to reload

You can reload the entire app (with no downtime)
For now, you will have to find the PID of the master and, on the command line:

    kill -USR2 <PID>
    
That will reload your service with no downtime.

[Read more on how this works](http://github.com/pgte/fugue/wiki/How-Fugue-Works).

## TODO:

1. Save the PID of the master into a file. This can be tricky when handling master restarts. Should lock?
1. (DONE) Don't kill slaves with open connections.
1. Use fork() to start the workers instead of spawn
1. unit / integration tests - any ideas on how to test fugue?
1. review the master / worker protocol for passing in the server socket
1. review the code that synchronously tries to fetch the file descriptor from the  original master into the new respawned master (lib/fugue.js lines 72 - 91) - they're a bit too hacky - try and remove the recvMsg cycle...
1. Monitor request timeouts (as Unicorn does) - only plausible for HTTP Servers, though (??)
1. (DONE) Don't hardcode path for unix socket. Make it a temporary random file and pass it around on environment?
1. Somehow delete master sockets that are not being used. This can be tricky, since master socket paths are passed around to workers and new masters.
