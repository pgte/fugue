# No longer supported!!!!

# Multiple node server instance manager with Unicorn-like features

Heavily inspired by [Spark](http://github.com/senchalabs/spark) and [Unicorn](http://unicorn.bogomips.org/)

[Why does fugue exist?](http://github.com/pgte/fugue/wiki/Why-does-Fugue-exist%3F)

Fugue v0.1.0 Requires node.js v0.3.2 or superior.

Fugue v0.0.38 and below Requires node.js 0.v2.2 or superior.

## Features:

* Supports any type of Node.js server as long as it inherits from net.Server (http.Server, connect.Server, ...).
* Resuscitation -  when a worker dies it is restarted.
* Zero downtime app reload.
* Set gid, uid.
* Set working dir.
* Redirect stdout to log files for master / workers
* workers suicide after master sudden death.

## Install:

    npm install fugue

## Usage:

Example:

    var fugue = require('fugue'),
        net =   require('net');

    var server = net.createServer(function(conn) {
      conn.end(process.pid.toString() + "Hello from worker " + fugue.workerId());
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
* tmp_path : the absolute path for the temp dir. defaults to '/tmp'
* log_file : the full path of the log file if you wish stdout to be redirected there. All workers + master will write here. If absent does not touch stdout
* master_log_file : alternative path for the log file for the master only
* uid : unix user id for workers. Defaults to current user
* gid : unix group id for workers. Defaults to current group
* master_pid_path : master PID file path. If not passed in, no pid file is written
* worker_to_master_ping_interval : the interval by which children ping master to know if it's alive. in milliseconds. defaults to 30000 (30 seconds)
* worker_kill_timeout - when master is stopping, time to let workers kill themselves before REALLY killing them (miliseconds). defaults to 30000 (30 seconds)

### How to reload

You can reload the entire app (with no downtime)
For now, you will have to find the PID of the master and, on the command line:

    kill -USR2 <PID>
    
That will reload your service with no downtime.

Notice that the slaves will only die when all the TCP connections end or after 30 seconds.
If you are using an HTTP server, a slave could be waiting on browser HTTP keep-alive connections.
On development environments, you would have to kill the browser for the slave to die - (on development environments you shouldn't really use fugue).

[Read more on how this works](http://github.com/pgte/fugue/wiki/How-Fugue-Works).

### Other available functions:

#### fugue.stop()

Kills fugue workers and closes the server socket.

#### fugue.isWorker()

Returns true if current process is a worker process.
Returns false if current process is master.

#### fugue.isMaster()

Returns true if current process is master.
Returns false if current process is a worker process.

#### fugue.workerPids()

Returns an array of integers with the workers process IDs.

#### fugue.masterSocketPath()

This method is public mainly because of allowing some complicated tests to be possible. Apps should not care.

