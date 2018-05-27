'use strict';

const testing = !1,
  fs = require('fs'),
  http = require('http'),
  https = require('https'),
  qs = require('querystring'),
  WebSocket = require('websocket').server,
  classes = require('./classes'),
  _vector = require('./vector'),
  files = {},
  port = testing ? 8080 : 80;

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
  if (url === '/' || url === '/nosocket') return './client/index.html';
  if (url.startsWith('/err')) {
    fs.appendFile(
      'errorlog.txt',
      qs.unescape(url.split('=')[1]),
      (err) => { if (err) throw err }
    );
  }
  return './client' + url;
};

const server = http.createServer((req, res) => {
  res.writeHead(200);
  fs.readFile(route(req.url), (err, data) => { res.end(data) });
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

const interpol = (cur, min, max) => {
  if (cur <= max && cur >= min) {
    return (cur - min) / (max - min);
  }
};

const statToPoint = (player, val) => {
  switch (val) {
    case 0:
      return player.maxHealth <= 3 ? 0 :
        player.maxHealth === 4 ? 2 :
          player.maxHealth >= 6 ? 5 : 4;
    case 1:
      return Math.round((player.speed - 1) / 1.5 * 5);
    case 2:
      return Math.floor((500 - player.shootInterval) / 240 * 5);
    case 3:
      return (player.bulletSpeed - 10) * 0.5;
    case 4:
      return player.gunCount - 1;
    case 5:
      return (player.shieldTime - 5000) / 1000;
    default:
      break;
  }
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
    rooms.push(new classes.Room(mapsize, maxPl, p));
    generateWalls(0);
    createBot(0);
    createBot(0);
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
  rooms.push(new classes.Room(mapsize, maxPl, p));
  // console.log('new room created');
  generateWalls(rooms.length - 1);
  createBot(p.roomId);
  createBot(p.roomId);
  return e();
};

const sendStats = (player) => {
  sockets.get(player.id).send(JSON.stringify({
    points: player.points,
    upgStats: [
      [player.health, statToPoint(player, 0)], // health
      [Math.round(player.speed * 10) / 10, statToPoint(player, 1)], // speed
      [player.shootInterval, statToPoint(player, 2)], // reload time
      [player.bulletSpeed, statToPoint(player, 3)], // bullet speed
      [player.gunCount, statToPoint(player, 4)], // gun count
      [player.shieldTime, statToPoint(player, 5)] // shield time
    ]
  }));
};

const createBot = (roomId) => {
  if (roomId === undefined)
    createPlayer(true);
  else {
    const b = new classes.Bot(++plCount, roomId);
    rooms[roomId].players.push(b);
    respawnBot(b);
  }
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
  if (req.resource === '/nosocket') return;
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
    socket.send(JSON.stringify({
      walls: room.walls,
      powerups: room.powerups
    }));
    sendStats(player);
  }, 200);

  const processIncome = (data) => {
    // perform moving
    if (data.vec) {
      player.vector = data.vec;
    }

    // perform shooting
    if (data.shoot !== undefined)
      if (!player.accelerated) {
        player.isShooting = Boolean(data.shoot);
        if (data.shoot) player.shoot();
      };
    // perform speedup
    if (data.speedup !== undefined)
      // console.log(data.speedup)
      player.accelerated = data.speedup;

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
    if (data.upgrade !== undefined) {
      /*
      0:  health
      1:  speed
      2:  reload time
      3:  bullet speed
      4:  gun count
      5:  shield time
      */
      const price = Math.pow(2, statToPoint(player, data.upgrade) + 1);
      if (player.points >= price && price < 64) {
        player.points -= price;
        switch (data.upgrade) {
          case 0:
            if (player.maxHealth < 6) {
              player.maxHealth += 1;
              player.health += 1;
            }
            socket.send(JSON.stringify({ health: player.health }));
            break;
          case 1:
            if (player.speed < 2.5) {
              console.log('speed upgrade');
              player.speed = player.speed + 0.3;
            }
            break;
          case 2:
            if (player.shootInterval > 200)
              player.shootInterval -= 60;
            break;
          case 3:
            if (player.bulletSpeed < 20) {
              player.bulletSpeed += 2;
            }
            break;
          case 4:
            if (player.gunCount < 6) {
              player.gunCount += 1;
            }
            break;
          case 5:
            if (player.shieldTime < 10000)
              player.shieldTime += 1000;
          default:
            break;
        }
        // array of arrays that are raw values and percentage values
        sendStats(player);
      }
    }
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

const updatePlayer = (player) => {

  player.x += player.vector[0] * player.getSpeed();
  player.y += player.vector[1] * player.getSpeed();
  player.bullets.forEach((b) => {
    b.x += b.vector[0] * player.bulletSpeed;
    b.y += b.vector[1] * player.bulletSpeed;
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
            if (player.health < player.maxHealth) {
              player.health++;
            }
            break;
          case 'shield':
            player.vulnerable = false;
            setTimeout(() => {
              player.vulnerable = true;
            }, player.shieldTime);
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
            player.points += randomRange(1, 6);
            respawn(pl);
            if (!pl.isBot) {
              sockets.get(pl.id).send(JSON.stringify({
                health: pl.health
              }));
              sendStats(pl);
            }
            if (!player.isBot)
              sockets.get(player.id).send(JSON.stringify({ frag: 1, points: player.points }));
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

  const pls = rooms[bot.roomId]
    .players
    .filter(p => p.id !== bot.id)
    .concat(rooms[bot.roomId].powerups);
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
    bot.vector = _vector.rotate(bot.vector, isCol);
  } else {
    bot.vector = _vector.rotate(
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

/* -----MAIN SERVER CLOCK----- */
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

  player.reset();
  player.vulnerable = false;
  player.health = player.maxHealth;
  setTimeout(() => {
    // console.log('unshield' + player.id);
    player.vulnerable = true;

  }, 2000);

};

const respawnBot = (bot) => {
  respawn(bot);
  bot.health = bot.maxHealth;
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