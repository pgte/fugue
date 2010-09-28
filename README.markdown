# Multiple node server instance manager with Unicorn-like features

Heavily inspired by [Spark](http://github.com/senchalabs/spark) and [Unicorn](http://unicorn.bogomips.org/)

## Features:

* Supports and type of Node.js server as long as it inherits from net.Server (http.Server, connect.Server, ...)
* Failover -  when a worker dies it is restarted.
* App reload using SIGUSR2.
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

## TODO:

* Monitor request timeouts (as Unicorn does) - only plausible for HTTP Servers, though (??)
