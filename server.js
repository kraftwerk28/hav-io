'use strict';

const testing = !1;
const fs = require('fs');
const http = require('http');
const WebSocket = require('websocket').server;
const classes = require('./classes');
const files = {};
// let messages = '';
const port = testing ? 8080 : 80;
let startUsage = process.cpuUsage();

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
  const key = (f === '/welcome.html' ? '/' : f);
  files[key] = fs.readFileSync('./client/' + f);
});

const route = (url) => {
  if (url === '/') return './client/index.html';
  return './client' + url;
};

const server = http.createServer((req, res) => {
  // const data = files[req.url] || files['/'];
  res.writeHead(200);
  fs.readFile(route(req.url), (err, data) => { res.end(data) });
  // res.end(data);
});

server.on('error', (err) => {
  console.log('Error: ' + err.message);
  process.exit(1);
});

server.listen(port, () => { console.log(`Server listen on ${port}`) });
//#endregion

const getUsage = (value) => {
  let cnt = Math.round(value / 10000);
  let res = '';
  while (cnt > 0) {
    res += '|';
    cnt--;
  }
  return res;
};

// setInterval(() => {
//   startUsage = process.cpuUsage(startUsage)
//   process.stdout.clearLine();
//   process.stdout.cursorTo(0);
//   process.stdout.write(getUsage(startUsage.user));
// }, 1000)

const rooms = [];
const sockets = new Map();
const maxPl = 10;
const mapsize = 1500;
const wallCount = mapsize / 20;
const spawnerCount = 6;
let plCount = -1;
const rotDelta = 0.1;


const randomRange = (start, end) => {
  return Math.floor(Math.random() * end + start)
};

const distance = (x1, y1, x2, y2) => {
  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2))
};

const toDeg = rad => rad * 57.3;

const normalize = (vector) => {
  const l = Math.sqrt(Math.pow(vector[0], 2) + Math.pow(vector[1], 2));
  return [vector[0] / l, vector[1] / l];
};

const rotate = (vec, rad) => {
  const v = [vec[0], vec[1]];
  v[0] = vec[0] * Math.cos(rad) - vec[1] * Math.sin(rad);
  v[1] = vec[0] * Math.sin(rad) + vec[1] * Math.cos(rad);
  return v;
};

const vecLerp = (v1, v2) => {
  const dif = [v2[0] - v1[0], v2[1] - v1[1]];
  let a = 0.5;
  if ((v1[0] + dif[0] === v2[0] && v1[1] + dif[1] === v2[1]) || v2[0] * v1[0] + v2[1] * v1[1] < 0)
    a = -0.5;
  const v = [0, 0];
  v[0] = v2[0] * Math.cos(a) - v2[1] * Math.sin(a);
  v[1] = v2[0] * Math.sin(a) + v2[1] * Math.cos(a);
  return v;
};

const dot = (v1, v2) => {
  return v1[0] * v2[0] + v1[1] * v2[1];
};

const createPlayer = (isBot) => {
  let p;
  const sendNicks = () => {
    const room = rooms[p.roomId];
    room.players.forEach(pl => {
      if (!pl.isBot)
        sockets.get(pl.id).send(JSON.stringify({
          nicks: room.players.map(p => [p.id, p.nickname])
        }));
    });
  }
  const e = () => {
    // sendNicks();
    respawn(p);
    return p;
  };
  plCount++;
  if (rooms.length < 1) {
    p = isBot ? new classes.Bot(plCount, 0) : new classes.Player(plCount, 0);
    rooms.push(new classes.Room(
      mapsize,
      maxPl,
      p,
      new classes.Bot(++plCount, 0),
      new classes.Bot(++plCount, 0)
    ));
    generateWalls(0);
    return e();
  }

  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i].players.length < rooms[i].maxPlayers) {
      p = isBot ? new classes.Bot(plCount, i) : new classes.Player(plCount, i);
      rooms[i].players.push(p);
      return e();
    }
  }
  p = isBot ? new classes.Bot(plCount, rooms.length) : new classes.Player(plCount, rooms.length);
  rooms.push(new classes.Room(mapsize,
    maxPl,
    p,
    new classes.Bot(++plCount, rooms.length),
    new classes.Bot(++plCount, rooms.length)
  ));
  // console.log('new room created');
  generateWalls(rooms.length - 1);
  return e();
};

const createBot = () => {
  createPlayer(true);
};

const kickBot = (roomId) => {
  rooms[roomId].players.some((p, i) => {
    if (p.isBot) {
      rooms[roomId].players.splice(i, 1);
      rooms[roomId].players.forEach(pl => {
        if (!pl.isBot)
          sockets.get(pl.id).send(JSON.stringify({
            nicks: rooms[roomId].players.map(p => [p.id, p.nickname]),
            // .concat(room.bots.map(p => [p.id, p.nickname])),
          }));
      });
      return true;
    }
    return false;
  });
};

const setTarget = (roomId, x, y) => {
  rooms[roomId].players.filter(p => p.isBot)[0].target = [x, y];
};

const ws = new WebSocket({
  httpServer: server,
  autoAcceptConnections: false,
  keepalive: true,
  closeTimeout: 0
});

ws.on('request', (req) => {
  const socket = req.accept('', req.origin);
  console.log(socket.remoteAddress + ' connected.');
  let player = createPlayer();
  // console.log('player created...');
  sockets.set(player.id, socket);
  // console.log('socket set');
  respawn(player);
  // console.log('player respawned');
  socket.id = player.id;
  let room = rooms[player.roomId];

  setTimeout(() => {
    socket.send(JSON.stringify({ walls: room.walls, powerups: room.powerups }));
  }, 200);

  const processIncome = (data) => {
    // perform moving
    if (data.vec) {
      player.vector = data.vec;
    }

    // perform shooting
    if (data.shoot)
      if (player.speed <= 1)
        player.shoot()
    // perform speedup
    if (data.speedup !== undefined)
      player.speed = data.speedup ? 4 : 1;

    if (data.nickname !== undefined) {
      player.nickname = data.nickname ? data.nickname : 'Player';
      room.players.filter(p => !p.isBot).forEach(pl => {
        sockets.get(pl.id).send(JSON.stringify({
          nicks: room.players.map(p => [p.id, p.nickname])
            .concat(room.bots.map(p => [p.id, p.nickname])),
          roomId: pl.roomId
        }));
      });
    }
    // send full player info if needed
    // if (data[4]) socket.sendUTF(JSON.stringify(player));
    // perform messenger
    // if (data[5]) { }

    if (data.command && testing) {
      try {
        socket.send(JSON.stringify({
          console: eval(data.command)
        }));
      } catch (e) {
        socket.send(JSON.stringify({
          console: 'Error ' + e.name + ":" + e.message + "\n" + e.stack
        }));
      }
    }

    if (data.error) {
      fs.appendFile('errorlog.txt', data.error + '\n', (err) => { });
    }
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
    if (room.players.filter(p => !p.isBot).length < 1) {
      // console.log('room deleted');
      rooms.splice(player.roomId, 1);
    }
    // if (room.players.length < 1)
    //   rooms.splice(player.roomId, 1);
    console.log(socket.remoteAddress + ' disconnected.\n\n');
    room.players.filter(p => !p.isBot).forEach(pl => {
      sockets.get(pl.id).send(JSON.stringify({
        nicks: room.players.map(p => [p.id, p.nickname])
      }));
    });
    // socket.close();
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
  // collision detection
  if (player.x - player.size < 0) player.x = player.size;
  if (player.x + player.size > mapsize) player.x = mapsize - player.size;
  if (player.y - player.size < 0) player.y = player.size;
  if (player.y + player.size > mapsize) player.y = mapsize - player.size;

  // if (player.x - player.size < 0 || player.x + player.size > mapsize)
  //   player.vector[0] = -player.vector[0];
  // if (player.y - player.size < 0 || player.y + player.size > mapsize)
  //   player.vector[1] = -player.vector[1];

  // wall colliding
  rooms[player.roomId]
    .walls
    .filter(w => distance(w.x, w.y, player.x, player.y) < 100)
    .forEach(wall => {
      // console.log(wall);
      const x = wall.x;
      const y = wall.y;
      if (player.x - player.size < x + wall.w && player.x + player.size > x &&
        player.y + player.size > y && player.y - player.size < y + wall.h) {
        if (player.x > x && player.x < x + wall.w) {
          if (player.y > y)
            player.y = y + wall.h + player.size// + player.speed;
          if (player.y < y)
            player.y = y - player.size// - player.speed;
        } else if (player.y > y && player.y < y + wall.h) {
          if (player.x > x)
            player.x = x + wall.w + player.size// + player.speed;
          if (player.x < x)
            player.x = x - player.size// - player.speed;
        }
        // return true;
      }
    });
  // powerup colliding
  rooms[player.roomId]
    .powerups
    .some((pu, i) => {
      if (distance(player.x, player.y, pu.x + 25, pu.y + 25) < 12) {
        rooms[player.roomId].powerups.splice(i, 1);

        switch (pu.type) {
          case 'heart':
            if (player.health < 3) {
              player.health++;
            }
            break;
          case 'shield':
            player.vulnerable = false;
            setTimeout(() => {
              player.vulnerable = true;
            }, 5000);
        }
        if (!player.isBot)
          sockets.get(player.id).send(JSON.stringify({
            health: player.health,
            powerup: pu.type,
          }));
        rooms[player.roomId]
          .players
          .filter(p => !p.isBot)
          .forEach(pl => {
            sockets.get(pl.id).send(JSON.stringify({
              powerups: rooms[player.roomId].powerups
            }));
          })

        return true;
      }
    });
  // bullet colliing
  for (let i = 0; i < player.bullets.length; i++) {
    const b = player.bullets[i];
    if (b.x < 0 || b.y < 0 || b.x > mapsize || b.y > mapsize) {
      player.bullets.splice(i, 1);
      // i--;
      break;
    }
    rooms[player.roomId]
      .walls
      .filter(w => distance(w.x, w.y, b.x, b.y) < 100)
      .some((wall) => {
        if (b.x < wall.x + wall.w &&
          b.x > wall.x &&
          b.y > wall.y &&
          b.y < wall.y + wall.h) {
          player.bullets.splice(i, 1);
          // i--;
          return true;
        }
      });
    rooms[player.roomId]
      .players
      .filter(pl => player.id !== pl.id)
      .some(pl => {
        if (pl.vulnerable && distance(pl.x, pl.y, b.x, b.y) < pl.size) {
          pl.health--;
          if (!pl.isBot)
            sockets.get(pl.id).send(JSON.stringify({ health: pl.health, damage: 1 }));

          if (pl.health < 1) {
            respawn(pl);
            if (!pl.isBot)
              sockets.get(pl.id).send(JSON.stringify({ health: pl.health, damage: 1 }));
            if (!player.isBot)
              sockets.get(player.id).send(JSON.stringify({ frag: 1 }));
          }


          player.bullets.splice(i, 1);
          // i--;
          return true;
        }
      });
  }


};

const updateBot = (bot) => {
  const radius = 50;
  const sideDelta = 25;

  const pls = rooms[bot.roomId].players.filter(p => p.id !== bot.id).concat(rooms[bot.roomId].powerups);
  let dis = Infinity;
  let minI = 0;
  if (pls.length > 0) {
    for (let i = 0; i < pls.length; i++) {
      const dst = distance(pls[i].x, pls[i].y, bot.x, bot.y);
      if (dst < dis) {
        dis = dst;
        minI = i;
      }
    }

    const pt = pls[minI];
    if (dis > 300) bot.speed = 4;
    else bot.speed = 1;
    bot.target = pt.type ? [pt.x + 25, pt.y + 25] : [pt.x, pt.y];
  }


  const collides = (x, y) => {
    if (x - radius + sideDelta < 0 || x + radius - sideDelta > mapsize ||
      y - radius + sideDelta < 0 || y + radius - sideDelta > mapsize) {
      return rotDelta * 4;
    }

    let rd = 0;
    rooms[bot.roomId]
      .walls
      // .filter(w => distance(w.x, w.y, bot.x, bot.y) > 100)
      .some(wall => {
        const x = wall.x + 25;
        const y = wall.y + 25;
        if (distance(x, y, bot.x, bot.y) < radius) {
          if (bot.vector[0] * y - bot.vector[1] * x > 0)
            rd = rotDelta;
          else
            rd = -rotDelta;
          return true;
        }
      });
    return rd;
  };

  const isCol = collides(bot.x, bot.y);

  if (isCol) {
    bot.speed = 1;
    bot.vector = rotate(bot.vector, isCol);
  } else {
    bot.vector = rotate(
      bot.vector,
      bot.vector[0] * (bot.target[1] - bot.y) -
        bot.vector[1] * (bot.target[0] - bot.x) > 0 ?
        rotDelta : -rotDelta
    );
  }

  // if (collides(bot.x, bot.y)) {
  //   
  // } else if (bot.target) {


  // }

  if (Math.random() < 0.05) {
    bot.shoot();
  }
  updatePlayer(bot);
};

setInterval(() => {
  // const data = [];
  // console.log(rooms.map(r => r.players));
  rooms.forEach((room) => {
    room.players.forEach((player, index) => {
      // console.log(player);
      if (player.isBot)
        updateBot(player);
      else {
        updatePlayer(player);
        sockets.get(player.id).send(JSON.stringify({
          p: room.players.map(pl => [
            Math.round(pl.x),
            Math.round(pl.y),
            Math.round(Math.atan2(pl.vector[1], pl.vector[0]) * 100) / 100,
            pl.health,
            pl.speed,
            Number(pl.vulnerable),
            pl.bullets.map(b => [Math.round(b.x), Math.round(b.y)]),
            pl.id
          ]),
          // b: room.bots.map(pl => [
          //   Math.round(pl.x),
          //   Math.round(pl.y),
          //   Math.round(Math.atan2(pl.vector[1], pl.vector[0]) * 100) / 100,
          //   pl.health,
          //   pl.speed,
          //   Number(pl.vulnerable),
          //   pl.bullets.map(b => [Math.round(b.x), Math.round(b.y)]),
          //   pl.id
          // ]),
          id: index
        }));
      }

    });
    // room.bots.forEach(bot => {
    //   updateBot(bot);
    // });
  });

}, 1000 / 50);




//#region sio
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

//#endregion

setInterval(() => {
  if (Math.random() < 0.3) {
    spawnPowerup();
  }
}, 5000);

const respawn = (player) => {
  player.x = rooms[player.roomId].spawnpoints[randomRange(0, spawnerCount)].x;
  player.y = rooms[player.roomId].spawnpoints[randomRange(0, spawnerCount)].y;
  player.vector = [1, 0];
  // player.deaths++;

  player.vulnerable = false;
  player.health = 3;
  setTimeout(() => {
    // console.log('unshield' + player.id);
    player.vulnerable = true;

  }, 2000);

};

const respawnBot = (bot) => {
  respawn(bot);
  bot.health = 3;
}

const generateWalls = (ind) => {
  for (let i = 0; i < wallCount; i++) {
    rooms[ind].walls.push(new classes.Wall(randomRange(0, mapsize / 50) * 50, randomRange(0, mapsize / 50) * 50, 50, 50));
  }
  for (let i = 0; i < spawnerCount; i++) {
    const x = randomRange(1, (mapsize / 50) - 1) * 50;
    const y = randomRange(1, (mapsize / 50) - 1) * 50;
    if (rooms[ind].walls.some(wall => (wall.x === x) && (wall.y === y)))
      i--;
    else
      rooms[ind].spawnpoints.push({ x, y });
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
    const collides = (x, y) => {
      for (let i = 0; i < walls.length; i++) {
        if (walls[i].x === x && walls[i].y === y) {
          return true;
        }
      };
      for (let i = 0; i < powerups.length; i++) {
        if (powerups[i].x === x && powerups[i].y === y) {
          return true;
        }
      };
      return false;
    }
    const px = randomRange(0, mapsize / 50) * 50;
    const py = randomRange(0, mapsize / 50) * 50;
    if (!collides(px, py))
      rooms[id].powerups.push(new classes.Powerup(px, py, type));
    rooms[id].players.filter(p => !p.isBot).forEach(p => {
      sockets.get(p.id).send(JSON.stringify({ powerups: rooms[id].powerups }));
    })
  }
};