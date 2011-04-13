all: build test

build:
	node-waf configure build

test: build
	node tools/test.js test_zero_workers test_one_worker test_if_i_can_reach_many_workers test_app_reload test_working_dir test_leaks test_worker_dies_after_master_sudden_death test_unix_socket test_pipe_leaks

test-sudo:
	sudo NODE_PATH=${NODE_PATH} PATH=${PATH} node tools/test.js test_setuid

test-fail:
	node tools/test.js test_should_fail

.PHONY: all test build test-sudo