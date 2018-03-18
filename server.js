'use strict';

const express = require('express');
const app = express();
const server = require('http').Server(app);
const classes = require('./classes');

app.use(express.static(__dirname + '/client'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + './index.html');
})

server.listen(80);

const io = require('socket.io')(server);

const players = [];
const walls = [];
const powerups = [];
const canvas = { width: 700, height: 500 };
const randomRange = (start, end) => (
  Math.floor(Math.random() * end + start)
);
for (let i = 0; i < 20; i++) {
  walls.push(new classes.Wall(randomRange(0, canvas.width / 50), randomRange(0, canvas.height / 50), 50, 50));
}



const createPlayer = (id) => {
  const p = new classes.Player(id);
  players.push(p);
  return p;
};

io.sockets.on('connection', (socket) => {
  let player = createPlayer(socket.id);
  socket.emit('welcome', { player, walls, powerups });
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
    console.log('upMe' + Math.random());
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

  socket.on('pickupPowerup', data => {
    // console.log(powerups.length)
    switch (powerups.splice(data, 1)[0].type) {
      case 'shield':
        player.vulnerable = false;
        setTimeout(() => {
          player.vulnerable = true;
        }, 5000);
        break;
      case 'heart':
        if (player.health < 3) {
          player.health++;
          socket.emit('healthup');
        }
        break;
    }
    io.sockets.emit('updatePowerups', powerups);

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

  //#region chat
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

  io.sockets.emit('update', { players });
}, 1000 / 50);

setInterval(() => {
  if (Math.random() < 0.3) {
    spawnPowerup();
  }
}, 10000);

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

const spawnPowerup = () => {
  let type = '';
  if (Math.random() > 0.5)
    type = 'shield'
  else
    type = 'heart';
  let pu;
  const collides = (p) => {
    for (let i = 0; i < walls.length; i++) {
      if (walls[i].x === p.x && walls[i].y === p.y) {
        return true;
      }
    };
    for (let i = 0; i < powerups.length; i++) {
      if (powerups[i].x === p.x && powerups[i].y === p.y) {
        return true;
      }
    };
    return false;
  }
  do {
    pu = new classes.Powerup(randomRange(0, canvas.width / 50), randomRange(0, canvas.height / 50), type);
  }
  while (collides(pu))
  powerups.push(pu);
  io.sockets.emit('updatePowerups', powerups);
};
