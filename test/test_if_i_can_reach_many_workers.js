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

exports.setup = function() {
  fugue.start(server, port, null, worker_count, {verbose: false} );
}

exports.run = function(next) {

  var worker_marks = {};

  var all_workers_contacted = function() {
    for(var workerIdx = 1; workerIdx <= worker_count; workerIdx ++) {
      if (!worker_marks[workerIdx]) return false;
    }
    return true;
  }
  
  
  var timeout = setTimeout(function() {
    // test that we have visited all workers
    assert.ok(all_workers_contacted, 'not all workers responded');
  }, 4000);
  
  var workers_tried = 0;
  var safety_factor = 100;
  var max_tries = worker_count * safety_factor;
  var try_next_worker = function() {
    workers_tried ++;
    workerIdx = workers_tried;
    var client = net.createConnection(port);

    var got_some_data = false;
    client.on('data', function(workerId) {
      worker_marks[workerId] = true;
      client.destroy();
      if (all_workers_contacted()) {
        //console.log('all workers contacted');
        clearTimeout(timeout);
        if (next) next();
      } else
        if (workers_tried < max_tries) try_next_worker();
    });

  };
  try_next_worker();
}

exports.teardown = function() {
  fugue.stop();
}