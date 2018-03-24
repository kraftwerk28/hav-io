'use strict';

const os = require('os');
const express = require('express');
const app = express();
const fs = require('fs');
const http = require('http');
const classes = require('./classes');
const files = {};
let messages = '';

/*
const readR = (root, path) => {
  const getFilenames = (path, prefix) => {
    if (fs.lstatSync(root + prefix + path).isDirectory()) {
      return fs.readdirSync(root + prefix + path).map(val => getFilenames(val, prefix + path + '/'));
    } else {
      return prefix + path;
    }
  };

  const flatty = (arr) => {
    if (!Array.isArray(arr)) return [arr];
    return arr.reduce((flat, toFlat) => (
      flat.concat(Array.isArray(toFlat) ? flatty(toFlat) : toFlat)
    ), [])
  };

  return flatty(getFilenames(path, ''));
};
*/
// readR('client/', '').forEach(f => {
//   const key = (f === '/index.html' ? '/' : f);
//   files[key] = fs.readFileSync('./client/' + f);
// });

const server = http.createServer(app);

app.use(express.static(__dirname + '/client/'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/client/index.html');
});

server.listen(80);

const io = require('socket.io')(server);

const rooms = [];
const maxPl = 5;
const size = 1500;
const wallCount = size / 20;
const spawnCount = 4;

const canvas = {
  width: 700,
  height: 500
};

const randomRange = (start, end) => (
  Math.floor(Math.random() * end + start)
);

const createPlayer = (id) => {
  let p;
  if (rooms.length < 1) {
    p = new classes.Player(id, 0);
    rooms.push(new classes.Room(size, maxPl, p));
    generateWalls(0);
    return p;
  }

  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i].players.length < rooms[i].maxPlayers) {
      p = new classes.Player(id, i);
      rooms[i].players.push(p);
      return p;
    }
  }
  p = new classes.Player(id, rooms.length);
  rooms.push(new classes.Room(size, maxPl, p));
  generateWalls(rooms.length);
  return p;
};

io.sockets.on('connection', (socket) => {
  let player = createPlayer(socket.id);
  respawn(player);
  let room = rooms[player.roomId];
  const roomid = player.roomId;
  socket.emit('welcome', {
    player,
    room,
    messages,
    size
  });
  setTimeout(() => {
    player.vulnerable = true;
  }, 3000);
  setTimeout(() => {
    io.sockets.emit('updateConnected', room.players);
  }, 1000);

  socket.on('move', (data) => { // move vector
    player.vector = data.vector;
    socket.emit('updatePlayer', player);
  });

  socket.on('updateMe', (data) => {
    const i = room.players.findIndex(pl => pl.id === data.id);
    if (i > -1) {
      room.players[i] = data;
      player = data;
      io.sockets.emit('updateConnected', room.players);
    }
  });

  socket.on('collided', data => {
    player.collides = data.collides;
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
    switch (room.powerups.splice(data, 1)[0].type) {
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
    room.players.forEach(p => {
      io.sockets.connected[p.id].emit('updatePowerups', room.powerups);
    });


  });

  socket.on('getMe', () => {
    socket.emit('updatePlayer', player);
  });

  socket.on('updateConnected', () => {
    room.players.forEach(p => {
      io.sockets.connected[p.id].emit('updateConnected', room.players);
    })

  });

  socket.on('disconnect', () => {
    const i = room.players.findIndex(pl => pl.id === player.id);
    if (i > -1) {
      room.players.splice(i, 1);
      if (room.players.length < 1)
        rooms.splice(player.roomId, 1);
    }
  });

  //#region chat
  socket.on('newMsg', data => {
    const nick = data.player.nickname ? data.player.nickname : player.id;
    const text = `${nick}: ${data.msg}\n`;
    messages += text
    io.sockets.emit('newMsg', text);
  });
  //#endregion

});

setInterval(() => { // sever clock

  rooms.forEach(room => {
    room.players.forEach(player => {
      // console.log(player.collides);
      player.x += player.vector.x * player.speed;
      player.y += player.vector.y * player.speed;

      if (player.x - player.size < 0 || player.x + player.size > size)
        player.vector.x = -player.vector.x;
      if (player.y - player.size < 0 || player.y + player.size > size)
        player.vector.y = -player.vector.y;

      if (player.bullets.length > 0)
        for (let i = 0; i < player.bullets.length; i++) {
          const b = player.bullets[i];
          b.x += b.vector.x * 10;
          b.y += b.vector.y * 10;

          room.players.forEach(p => {
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

          if (b.x < 0 || b.x > size || b.y < 0 || b.y > size) {
            player.bullets.splice(i, 1);
          }
        }


      // io.sockets.connected[player.id].emit({ players: room.players });
    });
    room.players.forEach(p => {
      io.sockets.connected[p.id].emit('update', {
        players: room.players
      });
    });
  });

  // io.sockets.emit('update', { players });
}, 1000 / 50);

setInterval(() => {
  if (Math.random() < 0.3) {
    spawnPowerup();
  }
}, 5000);

const respawn = (player) => {
  player.x = rooms[player.roomId].spawnpoints[randomRange(0, spawnCount)].x;
  player.y = rooms[player.roomId].spawnpoints[randomRange(0, spawnCount)].y;
  player.vector = {
    x: 0,
    y: 0
  };
  // player.deaths++;
  player.vulnerable = false;
  player.health = 3;
  setTimeout(() => {
    // console.log('unshield' + player.id);
    player.vulnerable = true;
    io.sockets.connected[player.id].emit('updatePlayer', player);
  }, 2000);

};

const distanse = (x1, y1, x2, y2) => (
  Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
);

const generateWalls = (ind) => {
  for (let i = 0; i < wallCount; i++) {
    rooms[ind].walls.push(new classes.Wall(randomRange(0, size / 50), randomRange(0, size / 50), 50, 50));
  }
  for (let i = 0; i < spawnCount; i++) {
    const x = randomRange(0, size / 50);
    const y = randomRange(0, size / 50);
    if (rooms[ind].walls.every(wall => (wall.x !== x) && (wall.y !== y)))
      rooms[ind].spawnpoints.push({
        x: x * 50 + 25,
        y: y * 50 + 25
      });
    else i--;
  }
};

const spawnPowerup = () => {
  if (rooms.length > 0) {
    const id = Math.floor(Math.random() * rooms.length);
    const walls = rooms[id].walls;
    const powerups = rooms[id].powerups;
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
    pu = new classes.Powerup(randomRange(0, size / 50), randomRange(0, size / 50), type);
    if (!collides(pu))
      rooms[id].powerups.push(pu);
    rooms[id].players.forEach(p => {
      io.sockets.connected[p.id].emit('updatePowerups', powerups);
    })
  }
};