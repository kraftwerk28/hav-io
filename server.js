'use strict';

const express = require('express');
const app = express();
const server = require('http').Server(app);

app.use(express.static(__dirname + '/client'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + './index.html');
})

server.listen(80);

const io = require('socket.io')(server);

const players = [];
const bullets = [];
const canvas = { width: 700, height: 500 };

function Player(id) {
  this.x = 350;
  this.y = 250;
  this.vector = { x: 0, y: 0 };
  this.speed = 1;
  this.size = 10;
  this.id = id;
  this.bullets = [];
  this.vulnerable = false;
  this.health = 3;
  // this.kills = 0;
  // this.deaths = 0;
};

const createPlayer = (id) => {
  const p = new Player(id);
  players.push(p);
  return p;
};

io.sockets.on('connection', (socket) => {
  let player = createPlayer(socket.id);
  socket.emit('welcome', player);
  setTimeout(() => {
    player.vulnerable = true;
  }, 2000);
  setTimeout(() => {
    io.sockets.emit('updateConnected', players);
  }, 200);

  socket.on('move', (data) => { // move vector
    // console.log(data);
    player.vector = data.vector;

    socket.emit('updatePlayer', player);
  });

  socket.on('updateMe', (data) => {
    const i = players.findIndex(pl => pl.id === data.id);
    if (i > -1) {
      players[i] = data;
      player = data;
      io.sockets.emit('updateConnected', players);
    }
  });

  socket.on('shoot', () => {
    if (player.speed <= 1)
      player.bullets.push({
        x: player.x,
        y: player.y,
        vector: player.vector
      });
  });

  socket.on('speedup', val => {
    if (val)
      player.speed = 4;
    else
      player.speed = 1;
  });

  socket.on('getMe', () => {
    socket.emit('updatePlayer', player);
  });

  socket.on('updateConnected', () => {
    io.sockets.emit('updateConnected', players);
  });

  socket.on('disconnect', () => {
    const i = players.findIndex(pl => pl.id === player.id);
    if (i > -1)
      players.splice(i, 1);
  });

  //#region 
  socket.on('newMsg', data => {
    const nick = data.player.nickname ? data.player.nickname : player.id;
    io.sockets.emit('newMsg', `${nick}: ${data.msg}\n`);
  });
  //#endregion

});

setInterval(() => {

  players.forEach(player => {
    player.x += player.vector.x * player.speed;
    player.y += player.vector.y * player.speed;
    if (player.x - player.size < 0 || player.x + player.size > canvas.width)
      player.vector.x = -player.vector.x;
    if (player.y - player.size < 0 || player.y + player.size > canvas.height)
      player.vector.y = -player.vector.y;

    if (player.bullets.length > 0)
      for (let i = 0; i < player.bullets.length; i++) {
        const b = player.bullets[i];
        b.x += b.vector.x * 10;
        b.y += b.vector.y * 10;

        players.forEach(p => {
          if (player.id !== p.id && p.vulnerable)
            if (distanse(b.x, b.y, p.x, p.y) < p.size) {
              player.bullets.splice(i, 1);
              io.sockets.connected[p.id].emit('hitted');
              p.health--;
              if (p.health <= 0) {
                io.sockets.connected[player.id].emit('frag');
                io.sockets.connected[p.id].emit('gameOver');
                respawn(p);
              }
              // p.deaths++;
              // player.kills++;
            }

        });

        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
          player.bullets.splice(i, 1);
        }
      }

  });

  io.sockets.emit('update', { players, bullets });
}, 1000 / 50);

const respawn = (player) => {
  player.x = 350;
  player.y = 250;
  player.vector = { x: 0, y: 0 };
  // player.deaths++;
  player.vulnerable = false;
  player.health = 3;
  setTimeout(() => {
    player.vulnerable = true;
  }, 2000);
};

const distanse = (x1, y1, x2, y2) => (
  Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
);
