// Testing to see if I can reach many workers
// Setup server, spawn x workers, and then try to connect to each
// Each worker stops watcher after first connection
// Since connections might be queued on the worker before he closes the watcher, we try to connect x times x 100 (safety factor)

var path   = require('path'),
    net    = require('net'),
    assert = require('assert');
var fugue = require(path.join(__dirname, '..', 'lib', 'fugue.js'));

var expected_data = 'here is some data';
server = net.createServer(function(conn) {
  //console.log('worker '+fugue.workerId()+' got connection');
  conn.end(fugue.workerId().toString(), 'ascii');
  server.watcher.stop();
});

var port = 4001;
var worker_count = 4;
fugue.start(server, port, null, worker_count, {verbose: false} );

var worker_marks = {};

setTimeout(function() {
  // test that we have visited all workers
  for(var workerIdx = 1; workerIdx <= worker_count; workerIdx ++) {
    assert.equal(worker_marks[workerIdx], true, 'worker '+workerIdx+' did not respond');
  }
  process.exit();
}, 3000);

var workers_tried = 0;
var safety_factor = 100;
var max_tries = worker_count * safety_factor;
var try_next_worker = function() {
  workers_tried ++;
  workerIdx = workers_tried;
  var client = net.createConnection(port);
  //console.log('trying worker pass #'+workerIdx);

  var got_some_data = false;
  client.on('data', function(workerId) {
    //console.log('got: '+workerId);
    worker_marks[workerId] = true;
    client.destroy();
    if (workers_tried < max_tries) {
      try_next_worker();
    }
  });
  
};
try_next_worker();