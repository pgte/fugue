var fugue = require(__dirname+'/../lib/fugue.js'),
    net =   require('net');
var http = require('http');


var server = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
});



fugue.start(server, 4000, null, 1, {verbose : true, daemonize: true, log_file: '/tmp/foo.log'});
