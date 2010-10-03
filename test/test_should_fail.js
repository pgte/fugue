var child_process = require('child_process'),
    assert        = require('assert');

exports.run = function(next) {
  
  if (!process.env._FUGUE_TEST_SHOULD_FAIL_SPAWNED) {
    var args = process.argv;
    var env = {};
    for(var i in process.env){
      env[i] = process.env[i];      
    }
    env._FUGUE_TEST_SHOULD_FAIL_SPAWNED = true;
    child = child_process.spawn(args[0], args.slice(1), env);
    child.stdout.on('data', function(data) {
      console.log(data.toString());
      child.kill();
    });
  } else {
    // first spawned
    if (!process.env._FUGUE_TEST_SHOULD_FAIL_SPAWNED_SPAWNED) {
      var args = process.argv;
      var env = {};
      for(var i in process.env){
        env[i] = process.env[i];      
      }
      env._FUGUE_TEST_SHOULD_FAIL_SPAWNED_SPAWNED = true;
      child = child_process.spawn(args[0], args.slice(1), env);
      child.stdout.on('data', function(data) {
        console.log(data.toString());
        child.kill();
      });      
    } else {
      // sub_spawned
      assert.ok(false, 'failing on purpous, this is good');
    }
  }
}