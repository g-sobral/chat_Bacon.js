var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var Bacon   = require('baconjs').Bacon;

var clients = {};
var counter = 1;

app.get('/chat', function(req, res) {
  res.sendFile('/Users/gabriel.sobral/Desktop/test_nodejs/chat/index.html');
});

http.listen(3000, function(){
  console.log(new Date(), 'listening on *:3000');
});

// ********************************************************************

var connections = Bacon.fromBinder(function(sink) {
  io.on('connection', sink);
});

var disconnections = connections.flatMap(function(socket) {
  return Bacon.fromBinder(function(sink) {
    socket.on('disconnect', function(txt) {
      sink(socket);
    });
  });
});

var messages = connections.flatMap(function(socket) {
  return Bacon.fromBinder(function(sink) {
    socket.on('message', function(txt) {
      sink({ author: socket, txt: txt });
    });
  });
});

var updateNickname = connections.flatMap(function(socket) {
  return Bacon.fromBinder(function(sink) {
    socket.on('nickname', function(txt) {
      sink({ author: socket, nickname: txt });
    });
  });
});

// ********************************************************************

connections.onValue(function(socket) {
  clients[socket.id] = 'client_#' + counter;
  socket.broadcast.emit('message', clients[socket.id] + ' has joined this chat.');
  counter++;
});

disconnections.onValue(function(socket) {
  io.emit('message', clients[socket.id] + ' has left this chat.');
  delete clients[socket.id];
});

messages.onValue(function(message) {
  io.emit('message', '' + clients[message.author.id] + ': ' + message.txt);
});

updateNickname.onValue(function(message) {
  oldName = clients[message.author.id]
  clients[message.author.id] = message.nickname
  io.emit('message', oldName + ' has changed his nickname to ' + clients[message.author.id]);
});
