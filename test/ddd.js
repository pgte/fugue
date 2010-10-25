var fs = require('fs');
var net = require('net'); 

var stdio = process.binding("stdio");
fs.close(stdio.stdinFD);
fs.close(process.stdout.fd);
fs.close(stdio.stderrFD);

var daemon = require(__dirname + '/../build/default/daemon');
var pid = daemon.fork();

console.log("pid = "+pid);

// fs.close(stdio.stdinFD);
// fs.close(process.stdout.fd);
// fs.close(stdio.stderrFD);
// stdio.stderrFD = fs.openSync('/tmp/log.txt');
// 
var http = net.createServer(function(conn) {
  conn.end('here you go');
});

http.listen(4000);
