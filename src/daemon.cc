/*
* Daemon.node
*** A node.JS addon that allows creating Unix/Linux Daemons in pure Javascript.
*** Copyright 2010 (c) <arthur@norgic.com>
* Under MIT License. See LICENSE file.
*/

#include <v8.h>
#include <unistd.h>
#include <stdlib.h>
#include <sys/stat.h>
#include <fcntl.h>

#define PID_MAXLEN 10

using namespace v8;

// Go through special routines to become a daemon.
// if successful, returns daemon's PID
Handle<Value> Start(const Arguments& args) {
  pid_t pid, sid;
  int i;

  pid = fork();
  if(pid > 0) exit(0);
  if(pid < 0) exit(1);
  
  //for (i=getdtablesize();i>=0;--i) close(i); /* close all descriptors */
  // i=open("/dev/null",O_RDWR); /* open stdin */
  //   dup(i); /* stdout */
  //   dup(i); /* stderr */
  //   
	// Can be changed after with process.umaks
	//umask(0);
	
  // sid = setsid();
  //   if(sid < 0) exit(1);
  //  
	// Can be changed with process.chdir
	//chdir("/");
	
	return Integer::New(getpid());
}

// Close Standard IN/OUT/ERR Streams
Handle<Value> CloseIO(const Arguments& args) {
	close(STDIN_FILENO);
	close(STDOUT_FILENO);
	close(STDERR_FILENO);
}

// Close Standard IN/OUT/ERR Streams
Handle<Value> SetSid(const Arguments& args) {
  pid_t sid;
	sid = setsid();
	return Integer::New(sid);
}

// File-lock to make sure that only one instance of daemon is running.. also for storing PID
/* lock ( filename )
*** filename: a path to a lock-file.
*** Note: if filename doesn't exist, it will be created when function is called.
*/
Handle<Value> LockD(const Arguments& args) {
	if(!args[0]->IsString())
		return Boolean::New(false);
	
	String::Utf8Value data(args[0]->ToString());
	char pid_str[PID_MAXLEN+1];
	
	int lfp = open(*data, O_RDWR | O_CREAT, 0640);
	if(lfp < 0) exit(1);
	if(lockf(lfp, F_TLOCK, 0) < 0) exit(0);
	
	int len = snprintf(pid_str, PID_MAXLEN, "%d", getpid());
	write(lfp, pid_str, len);
	
	return Boolean::New(true);
}

extern "C" void init(Handle<Object> target) {
	HandleScope scope;
	
	target->Set(String::New("start"), FunctionTemplate::New(Start)->GetFunction());
	target->Set(String::New("lock"), FunctionTemplate::New(LockD)->GetFunction());
	target->Set(String::New("closeIO"), FunctionTemplate::New(CloseIO)->GetFunction());
	target->Set(String::New("setSid"), FunctionTemplate::New(SetSid)->GetFunction());

}