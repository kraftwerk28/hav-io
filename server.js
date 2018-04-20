'use strict';

const fs = require('fs');
const http = require('http');
const WebSocket = require('websocket').server;
const classes = require('./classes');
const files = {};
let messages = '';
const port = 8080;

//#region static routing and server init
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

readR('client/', '').forEach(f => {
  const key = (f === '/index.html' ? '/' : f);
  files[key] = fs.readFileSync('./client/' + f);
});

const route = (url) => {
  if (url === '/') return './client/index.html';
  return './client' + url;
};

const server = http.createServer((req, res) => {
  // const data = files[req.url] || files['/'];
  res.writeHead(200);
  // res.emit('init', );
  fs.readFile(route(req.url), (err, data) => { res.end(data) });
  // res.end();
});

server.on('error', (err) => {
  console.log('Error: ' + err.message);
  process.exit(1);
});

server.listen(port, () => { console.log(`Server listen on ${port}`) });
//#endregion

const rooms = [];
const sockets = new Map();
const maxPl = 5;
const mapsize = 1500;
const wallCount = mapsize / 20;
const spawnerCount = 6;
let plCount = -1;

const randomRange = (start, end) => {
  return Math.floor(Math.random() * end + start)
};

const createPlayer = () => {
  let p;
  plCount++;
  if (rooms.length < 1) {
    p = new classes.Player(plCount, 0);
    rooms.push(new classes.Room(mapsize, maxPl, p));
    generateWalls(0);
    return p;
  }

  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i].players.length < rooms[i].maxPlayers) {
      p = new classes.Player(plCount, i);
      rooms[i].players.push(p);
      return p;
    }
  }
  p = new classes.Player(plCount, rooms.length);
  rooms.push(new classes.Room(mapsize, maxPl, p));
  generateWalls(rooms.length);
  return p;
};

const createBot = () => {

};

const ws = new WebSocket({
  httpServer: server,
  autoAcceptConnections: false
});

ws.on('request', (req) => {
  const socket = req.accept('', req.origin);
  console.log(socket.remoteAddress + ' connected.');
  let player = createPlayer(plCount);
  respawn(player);
  socket.id = plCount;
  sockets.set(plCount, socket);
  let room = rooms[player.roomId];

  const processIncome = (data) => {
    if (data.length < 1) return;
    // perform moving
    if (data.vec) {
      player.vector = data.vec;
    }

    // perform shooting
    if (data.shoot)
      if (player.speed <= 1)
        player.bullets.push({
          x: player.x,
          y: player.y,
          vector: [player.vector[0], player.vector[1]]
        });
    // perform speedup
    if (data.speedup !== undefined)
      player.speed = data.speedup ? 4 : 1;
    // send full player info if needed
    // if (data[4]) socket.sendUTF(JSON.stringify(player));
    // perform messenger
    // if (data[5]) { }
  };

  socket.on('message', (event) => {
    processIncome(JSON.parse(event.utf8Data));
  });

  socket.on('close', (code, desc) => {
    // plCount--;
    const i = room.players.findIndex(p => p.id === player.id);
    sockets.delete(player.id);
    // sockets.splice(sockets.findIndex(s => s.id === socket.id), 1);
    room.players.splice(i, 1);
    if (room.players.length < 1)
      rooms.splice(player.roomId, 1);
    console.log(socket.remoteAddress + ' disconnected.');
  });
});

/* -----MAIN SERVER CLOCK----- */

const updatePlayer = (player) => {
  player.x += player.vector[0] * player.speed;
  player.y += player.vector[1] * player.speed;
  player.bullets.forEach((b) => {
    b.x += b.vector[0] * 10;
    b.y += b.vector[1] * 10;
  });
};

setInterval(() => {
  // const data = [];
  // console.log(rooms.map(r => r.players));
  rooms.forEach((room) => {
    room.players.forEach((player, index) => {
      // console.log(player);
      updatePlayer(player);
      sockets.get(player.id).send(JSON.stringify({
        p: room.players.map(pl => [
          Math.round(pl.x),
          Math.round(pl.y),
          Math.round(Math.atan2(pl.vector[1], pl.vector[0]) * 100) / 100,
          pl.health,
          pl.speed,
          Number(pl.vulnerable),
          pl.bullets.map(b => [b.x, b.y])
        ]),
        id: index
      }));
      // sockets.get(player.id).send(JSON.stringify([
      //   room.players.map((pl) => [
      //     pl.x, pl.y, pl.vector[0], pl.vector[1], Number(player.id === pl.id),
      //     pl.health, pl.speed, Number(pl.vulnerable),
      //     pl.bullets.map((bull) => [bull.x, bull.y])
      //   ]),
      //   room.powerups.map((pu) => [pu.x, pu.y])
      // ]));
    });
  });

}, 1000 / 50);







// FUCKIN SUCKET.IO SHIT
/*
io.sockets.on('connection', (socket) => {
  console.log(socket.id + ' connected.')
  let player = createPlayer(socket.id);
  respawn(player);
  let room = rooms[player.roomId];
  const updateRoom = (method, data) => {
    if (data)
      room.players.forEach(p => {
        io.sockets.connected[p.id].emit(method, data);
      });
    else
      room.players.forEach(p => {
        io.sockets.connected[p.id].emit(method);
      });
  };

  const roomid = player.roomId;
  socket.emit('welcome', {
    player,
    room,
    messages,
    mapsize
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

      // io.sockets.emit('updateConnected', room.players);
    }
    // updateRoom('update')
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



  });

  socket.on('getMe', () => {
    socket.emit('updatePlayer', player);
  });

  socket.on('updateConnected', () => {
    room.players.forEach(p => {
      io.sockets.connected[p.id].emit('updateConnected', room.players);
    });
  });

  socket.on('disconnect', () => {
    const i = room.players.findIndex(pl => pl.id === player.id);
    if (i > -1) {
      room.players.splice(i, 1);
      room.players.forEach(p => {
        io.sockets.connected[p.id].emit('updateConnected', room.players);
      });
      if (room.players.length < 1)
        rooms.splice(player.roomId, 1);

    }
    console.log(socket.id + ' disconnected.')
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



/* -----MAIN SERVER CLOCK----- */
/*
setInterval(() => { // sever clock

  rooms.forEach(room => {
    room.players.forEach(player => {
      // console.log(player.collides);
      player.x += player.vector.x * player.speed;
      player.y += player.vector.y * player.speed;

      if (player.x - player.mapsize < 0 || player.x + player.mapsize > mapsize)
        player.vector.x = -player.vector.x;
      if (player.y - player.mapsize < 0 || player.y + player.mapsize > mapsize)
        player.vector.y = -player.vector.y;

      if (player.bullets.length > 0)
        for (let i = 0; i < player.bullets.length; i++) {
          const b = player.bullets[i];
          b.x += b.vector.x * 10;
          b.y += b.vector.y * 10;

          room.players.forEach(p => {
            if (player.id !== p.id && p.vulnerable)
              if (distanse(b.x, b.y, p.x, p.y) < p.mapsize) {
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

          if (b.x < 0 || b.x > mapsize || b.y < 0 || b.y > mapsize) {
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
*/
setInterval(() => {
  if (Math.random() < 0.3) {
    spawnPowerup();
  }
}, 5000);

const respawn = (player) => {
  player.x = rooms[player.roomId].spawnpoints[randomRange(0, spawnerCount)].x;
  player.y = rooms[player.roomId].spawnpoints[randomRange(0, spawnerCount)].y;
  player.vector = [0, 0];
  // player.deaths++;

  if (sockets.has(player.id)) {
    player.vulnerable = false;
    player.health = 3;
    // io.sockets.connected[player.id].emit('updatePlayer', player);
    setTimeout(() => {
      // console.log('unshield' + player.id);
      if (sockets.has(player.id)) {
        player.vulnerable = true;
        // io.sockets.connected[player.id].emit('updatePlayer', player);
      }
    }, 2000);
  }


};

const distanse = (x1, y1, x2, y2) => (
  Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
);

const generateWalls = (ind) => {
  for (let i = 0; i < wallCount; i++) {
    rooms[ind].walls.push(new classes.Wall(randomRange(0, mapsize / 50), randomRange(0, mapsize / 50), 50, 50));
  }
  for (let i = 0; i < spawnerCount; i++) {
    const x = randomRange(0, mapsize / 50);
    const y = randomRange(0, mapsize / 50);
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
    pu = new classes.Powerup(randomRange(0, mapsize / 50), randomRange(0, mapsize / 50), type);
    if (!collides(pu))
      rooms[id].powerups.push(pu);
    rooms[id].players.forEach(p => {
      // io.sockets.connected[p.id].emit('updatePowerups', powerups);
    })
  }
};