
var path = require('path');

var test_path = path.join(__dirname, '..', 'test', process.argv[2] + '.js');
if (!path.existsSync(test_path)) throw "Could not find test path " + test_path;

var test_module = require(test_path);

var test_timeout = test_module.global_timeout ? test_module.global_timeout : 30000;

var exiting = false;
var do_exit = function() {
  if (exiting) return;
  exiting = true;
  if (test_module.teardown) test_module.teardown();
  process.removeListener('exit', do_exit);
  process.nextTick(function() {
    process.exit();
  });
}

if (!test_module.run) throw "test module " + module_path + " does not export run() function";
process.on('uncaughtException', function(excp) {
  if (excp.message || excp.name) {
    if (excp.name) process.stdout.write(excp.name);
    if (excp.message) process.stdout.write(excp.message);
    if (excp.backtrace) process.stdout.write(excp.backtrace);
    if (excp.stack) process.stdout.write(excp.stack);
  } else {
    sys = require('sys');
    process.stdout.write(sys.inspect(excp));    
  }
  process.stdout.write("\n");
  do_exit();
});

process.on('exit', do_exit);

if (test_module.setup) test_module.setup();

test_module.run(do_exit);