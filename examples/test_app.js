process.on('uncaughtException', function(excp) {
  var util = require('util')
  console.log(util.inspect(excp));
  console.log(util.inspect(excp.stack));
});

var fugue = require('../lib/fugue.js'),
    net =   require('net');

var server = net.createServer(function(conn) {
  //setTimeout(function() {
    conn.end("Hello from worker "+fugue.workerId()+".\nI am user " + process.getuid() + "\non dir " + process.cwd()+"\nPID: "+process.pid.toString() + "\n");
  //}, 5000);
  
});

fugue.start(server, 4000, null, 2, {
//fugue.start(server, 'tmp/my_test_server.sock', 2, {
  daemonize: false,
  // log_file: process.cwd() +'/log/children.txt',
  // master_log_file: process.cwd() +'/log/master.txt',
  // uid: 'pedroteixeira',
  // gid: 'staff',
  working_path: '/tmp',
  verbose: true,
  master_pid_path: '/tmp/fugue_master.pid'
});

