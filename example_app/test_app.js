process.on('uncaughtException', function(excp) {
  console.log(require('sys').inspect(excp));
  console.log(require('sys').inspect(excp.stack));
});

var fugue = require('../lib/fugue.js'),
    net =   require('net');

var server = net.createServer(function(conn) {
  setTimeout(function() {
    conn.end(process.pid.toString() + "Hello from "+fugue.workerId()+". I am user " + process.getuid() + " on dir " + process.cwd());
  }, 5000);
  
});

fugue.start(server, 4000, null, 2, {
//fugue.start(server, 'tmp/my_test_server.sock', 2, {
  daemonize: false,
  //log_file: process.cwd() +'/log/children.txt',
  //master_log_file: process.cwd() +'/log/master.txt',
  uid: 'pedroteixeira',
  gid: 'staff',
  working_path: '/tmp',
  tmp_path: process.cwd() + '/tmp',
  verbose: true
});

