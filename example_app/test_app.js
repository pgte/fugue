var fugue = require('fugue'),
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
