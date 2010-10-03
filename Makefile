#all: test
#
test:
	node tools/test.js test_zero_workers test_one_worker test_if_i_can_reach_many_workers test_app_reload test_working_dir test_master_socket_is_protected

test-fail:
	node tools/test.js test_should_fail

.PHONY: all test