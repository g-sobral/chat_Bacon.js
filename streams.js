// https://gist.github.com/laser/91e8fe32b2682d3ff39f
// http://blog.carbonfive.com/2014/09/23/bacon-js-node-js-mongodb-functional-reactive-programming-on-the-server/

var request = require('request-json'),
    express = require('express'),
    app     = express(),
    http    = require('http').Server(app),
    io      = require('socket.io'),
    Bacon   = require('baconjs').Bacon,
    client  = request.newClient('http://localhost:3000/api/'),
    db      = require('mongodb').MongoClient;

///////////////////////////////////////////////////////////
// this is all boilerplate; scroll down for demo code
//

app.get('/', function(req, res) {
  res.sendFile('./static/index.html');
});

app.post('/api/log', function(req, res) {
  var x = ((Math.random() * 10) > 5) ? "NOT\nJSON" : true;
  res.send(x);
});

app.get('/api/weather', function(req, res) {
  res.send({
    "main": {
      "temp": (Math.round(Math.random() * 1000) / 10)
    },
    "weather": [{
      "main": "Cloudy"
    }]
  });
});

app.use(express.static('./static'));

http.listen(3000, function() {
  console.log(new Date(), 'started server');
});

io = io(http);

function getFunFact(callback) {
  client.connect('mongodb://127.0.0.1:27017/library', function(err, db) {
    db.collection('facts').findOne(callback);
  });
}

///////////////////////////////////////////////////////////
// demo impl below
//

var connections = Bacon.fromBinder(function(sink) {
  io.on('connection', sink)
});

var messages = connections.flatMap(function(socket) {
  return Bacon.fromBinder(function(sink) {
    socket.on('message', function(txt) {
      sink({ author: socket, txt: txt });
    });
  });
});

var currentMessages = messages
  .scan([], function(acc, message) {
    return acc.length === 20 ? [] : acc.concat(message);
  });

var funFact = currentMessages
  .filter(function(acc) {
    return acc.length === 20;
  })
  .flatMap(function() {
    return Bacon.fromNodeCallback(getFunFact);
  })
  .map(function(fact) {
    return "Did you know that: " + fact.text;
  });

var entries = currentMessages
  .filter(function(acc) {
    return acc.length === 20;
  })
  .flatMap(function(messages) {
    return Bacon.retry({
      retries: 10,
      delay: function() { return 100; },
      source: function() {
        return Bacon.fromNodeCallback(client, 'post', 'log', {
          messages: messages
        });
      }
    });
});

connections.onValue(function(socket) {
  socket.broadcast.emit('message', 'CONN: ' + socket.id);
});

messages.onValue(function(message) {
  io.emit('message', '' + message.author.id + ': ' + message.txt);
});

funFact.onValue(function(fact) {
  io.emit('message', fact);
});

entries.onValue(function() {
  // deliberate no-op
});
