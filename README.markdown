# Multiple node server instance manager with Unicorn-like features

Heavily inspired by [Spark](http://github.com/senchalabs/spark) and [Unicorn](http://unicorn.bogomips.org/)

[Why does fugue exist?](http://github.com/pgte/fugue/wiki/Why-does-Fugue-exist%3F)

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
      conn.end(process.pid.toString() + "Hello from worker "+fugue.workerId());
    });

    fugue.start(server, 4000, null, 2, {verbose : true});

Having trouble? read the [FAQ](http://github.com/pgte/fugue/wiki/FAQ).

### fugue.start

For TCP:

    fugue.start(server, port, host, number_of_workers, options);

For UNIX sockets:

    fugue.start(server, socket_path, number_of_workers, options);

### Options on fugue.start:

* started : callback to be invoked when all workers are up and running
* working_path : absolute path for the working dir
* tmp_path : the absolute path for the temp dir. defaults to current_dir/tmp
* log_file : the full path of the log file if you wish stdout to be redirected there. All workers + master will write here. If absent does not touch stdout.
* master_log_file : alternative path for the log file for the master only.
* uid : unix user id for workers. Defaults to current user
* gid : unix group id for workers. Defaults to current group
* daemonize : to fork and detach
* master_pid_path : master PID file path. If not passed in, no pid file is written.

### How to reload

You can reload the entire app (with no downtime)
For now, you will have to find the PID of the master and, on the command line:

    kill -USR2 <PID>
    
That will reload your service with no downtime.

[Read more on how this works](http://github.com/pgte/fugue/wiki/How-Fugue-Works).
