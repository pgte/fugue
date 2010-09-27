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

## TODO:

* Reload using SIGUSR2 is pending depending on [this](http://groups.google.com/group/nodejs/browse_thread/thread/eb3ba019e6dbec70)
* Monitor request timeouts (as Unicorn does) - only plausible for HTTP Servers, though (??)
