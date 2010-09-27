# Startup multiple node server instance manager with Unicorn-like features

Heavily inspired by [Spark](http://github.com/senchalabs/spark) and [Unicorn](http://unicorn.bogomips.org/)

## Features:

* Failover
* Reload using SIGUSR2 (almost, as soon as [this](http://groups.google.com/group/nodejs/browse_thread/thread/eb3ba019e6dbec70) is sorted out)
* Set gid, uid
* Set working dir
* daemonize properly

## Install:

    sudo nmp install fugue

## Usage:

Example:

    var fugue = require('../lib/fugue.js'),
        net =   require('net');

    var server = net.createServer(function(conn) {
      conn.end(process.pid.toString() + "Hello from "+fugue.workerId()+". I am user " + process.getuid() + " on dir " + process.cwd());
    });

    fugue.start(server, 4000, null, 2, {
    //fugue.start(server, 'tmp/my_test_server.sock', 2, {
      daemonize: true,
      // log_file: process.cwd() +'/log/children.txt',
      // master_log_file: process.cwd() +'/log/master.txt',
      uid: 'pedroteixeira',
      gid: 'staff',
      working_path: '/tmp',
      tmp_path: process.cwd() + '/tmp',
      verbose: true
    });

### fugue.start

For UNIX sockets:

    fugue.start(server, port, host, number_of_workers, options);
    
For TCP:

    fugue.start(server, socket_path, number_of_workers, options);

### Options on fugue.start:

* working_path : absolute path for the working dir
* tmp_path : the absolute path for the temp dir. defaults to current_dir/tmp
* log_file : the full path of the log file if you wish stdout to be redirected there. All workers + master will write here. If absent does not touch stdout.
* master_log_file : alternative path for the log file for the master only.
* uid : unix user id for workers. Defaults to current user
* gid : unix group id for workers. Defaults to current group
* daemonize : Not yet supported

## TODO:

* Reload using SIGUSR2 is pending depending on [this](http://groups.google.com/group/nodejs/browse_thread/thread/eb3ba019e6dbec70)
* Monitor request timeouts (as Unicorn does) - only plausible for HTTP Servers, though (??)
