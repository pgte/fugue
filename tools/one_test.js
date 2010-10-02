var path = require('path');

var test_path = path.join(__dirname, '..', 'test', process.argv[2] + '.js');
if (!path.existsSync(test_path)) throw "Could not find test path "+test_path;

var test_module = require(test_path);

if (!test_module.run) throw "test module "+module_path + " does not export run() function";
if (test_module.setup) test_module.setup();
try {
  test_module.run(test_module.teardown);
} catch(excp) {
  if (test_module.teardown) test_module.teardown();
  var sys = require('sys');
  console.log(sys.inspect(excp));
  if (excp.backtrace) console.log(excp.backtrace);
}