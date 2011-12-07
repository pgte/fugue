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
#include <node.h>

#define PID_MAXLEN 10

using namespace v8;

// Go through special routines to become a daemon.
// if successful, returns daemon's PID
Handle<Value> Start(const Arguments& args) {
  pid_t pid, sid;
  int i, new_fd;

  if (args.Length() < 1) {
    return ThrowException(Exception::TypeError(
          String::New("Must have at least one arg containing the file descriptor")));
  }

  new_fd = args[0]->Int32Value();

  pid = fork();
  if(pid > 0) exit(0);
  if(pid < 0) exit(1);
  
  ev_default_fork();

  close(STDIN_FILENO);
  //close(STDOUT_FILENO);
  //close(STDERR_FILENO);
  dup2(new_fd, STDOUT_FILENO);
  dup2(new_fd, STDERR_FILENO);

  sid = setsid();
  
  return Integer::New(getpid());
}

Handle<Value> SetSid(const Arguments& args) {
  pid_t sid;
  
  sid = setsid();
  
  return Integer::New(sid);
}

extern "C" void init(Handle<Object> target) {
  HandleScope scope;
  
  target->Set(String::New("start"), FunctionTemplate::New(Start)->GetFunction());
  target->Set(String::New("setSid"), FunctionTemplate::New(SetSid)->GetFunction());

}
