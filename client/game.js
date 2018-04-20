'use strict';

const testing = true;
const socket = new WebSocket(testing ? 'ws://127.0.0.1:8080/' :
  'ws://kraftwerk28.pp.ua/');

let syncEmit = (callback) => { awaitFunc = callback };
let player = {
  x: 0,
  y: 0,
  vector: [0, 0],
  speed: 0,
  size: 10,
  id: 0,
  bullets: [],
  vulnerable: false,
  health: 3,
  collides: false,
};
const serialize = () => {

};

let movevector = { x: 0, y: 0 };
let awaitFunc = null;
let bulletClock;
let canvOffset = {};
let rClick = false;
let lClick = false;
let pingStart = 0;
let size = 1000;
let canvasCenter = {};
let smoothness = 0.2;

const viewport = {
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  init(width, height) {
    this.w = width;
    this.h = height;
  },
  center(posx, posy) {
    this.x = interpolate(this.x, posx - Math.ceil(this.w / 2));
    this.y = interpolate(this.y, posy - Math.ceil(this.h / 2));
    if (this.x < 0) this.x = 0;
    if (this.y < 0) this.y = 0;
    if (this.x + this.w > size) this.x = size - this.w;
    if (this.y + this.h > size) this.y = size - this.h;
  }
};

let kills = 0;
let deaths = 0;

let muted = false;
let walls = [];
let powerups = [];

window.onload = () => {
  muteButton.style.backgroundImage = 'url(\'./img/Mute.png\')';
  sfx.soundtrack.play();
  const n = localStorage.getItem('havionick');
  kills = localStorage.getItem('haviokills') ? localStorage.getItem('haviokills') : 0;
  deaths = localStorage.getItem('haviodeaths') ? localStorage.getItem('haviodeaths') : 0;
  updatescore();
  if (n)
    syncEmit(() => {
      player.nickname = n;
      // socket.emit('updateMe', player);
      nicknameinput.value = n;
    });

  viewport.init(canvas.width, canvas.height);
  canvasCenter = {
    cx: Math.floor(canvas.width / 2),
    cy: Math.floor(canvas.height / 2)
  };
  // socket = io();
  // initSocket();
  canvOffset = canvas.getBoundingClientRect();
};

window.onunload = () => {
  localStorage.setItem('haviodeaths', deaths);
  localStorage.setItem('haviokills', kills);
};

window.oncontextmenu = () => false;

window.onresize = () => {
  canvOffset = canvas.getBoundingClientRect();
}

window.onscroll = () => {
  canvOffset = canvas.getBoundingClientRect();
};

//#region frontend
const sfx = {
  die: new Audio('./sfx/Death.wav'),
  shoot: new Audio('./sfx/Shoot.wav'),
  speedup: new Audio('./sfx/Speedup.wav'),
  soundtrack: new Audio('./sfx/st.mp3'),
  heartPick: new Audio('./sfx/HeartPickup.wav'),
  shieldPick: new Audio('./sfx/ShieldPickup.wav'),
  hit: new Audio('./sfx/Hit.wav'),
}
sfx.soundtrack.loop = true;
sfx.soundtrack.volume = 0.5;

const heartContainer = document.getElementById('heartContainer');

const chatField = document.getElementById('chatField');
const chatInput = document.getElementById('chatInput');

const muteButton = document.getElementById('mute');
const connected = document.getElementById('connected');
const nicknameinput = document.getElementById('nickname');
nicknameinput.oninput = (e) => {
  localStorage.setItem('havionick', nicknameinput.value);
  syncEmit(() => {
    player.nickname = nicknameinput.value;
    // socket.send
  });
};
chatInput.onkeydown = (e) => {
  const str = clearSpaces(chatInput.value);
  if (e.keyCode === 13 && str.length > 0) {
    e.preventDefault();
    // socket.emit('newMsg', {
    //   player,
    //   msg: str
    // });
    chatInput.value = '';
  }
};

const canvas = document.getElementById('game');
canvas.style.animationPlayState = 'paused';
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
canvas.width = 700;
canvas.height = 500;
ctx.strokeStyle = 'yellow';
ctx.font = '12px Consolas';
ctx.textAlign = 'center';


canvas.onmousemove = (e) => {
  const x = e.x - canvOffset.x;
  const y = e.y - canvOffset.y;
  const vec = [x - player.x + viewport.x, y - player.y + viewport.y];
  // console.log(vec);
  // ctx.strokeStyle = 'red';
  // ctx.moveTo(viewport.w / 2, viewport.h / 2);
  // ctx.lineTo(x, y);
  // ctx.stroke();
  const l = Math.sqrt(Math.pow(vec[0], 2) + Math.pow(vec[1], 2));
  // console.log([...vec.map(v => v / l)]);
  socket.send(JSON.stringify({ vec: [...vec.map(v => v / l)] }));
};

canvas.onmouseleave = () => {
  clearInterval(bulletClock);
  speedup(false);
  lClick = false;
  rClick = false;
}

canvas.onmouseenter = () => {
  canvOffset = canvas.getBoundingClientRect();
}

// canvas.oncontextmenu = () => false;

canvas.onmousedown = (e) => {
  e.preventDefault();
  if (e.button === 0) {
    lClick = true;
    if (!rClick) {
      shoot();
      bulletClock = setInterval(() => {
        shoot();
      }, 500);
    }
  } else if (e.button === 2) {
    rClick = true;
    if (!lClick)
      speedup(true);
  }
};
canvas.onmouseup = (e) => {
  e.preventDefault();
  if (e.button === 0) {
    lClick = false;
    clearInterval(bulletClock);
  } else if (e.button === 2) {
    rClick = false;
    speedup(false);
  }
}

const wallimg = new Image();
wallimg.src = './img/brick.png';
// wallimg.style = 'image-rendering: pixelated';
const shield_img = new Image();
shield_img.src = './img/shield_powerup.png';
const heart_img = new Image();
heart_img.src = './img/heart_powerup.png';
//#endregion

//#region socket
const updatePlayer = (data) => {
  // const info = data[0].find((pl) => pl[4] === 1);
  player.x = data[0];
  player.y = data[1];
  player.vector[0] = data[2];
  player.vector[1] = data[3];
};

const render = (data) => {
  ctx.clearRect(0, 0, 700, 500);
  // console.log(data);
  // viewport.center(player.x, player.y);

  canvas.style.backgroundPosition = `${-viewport.x}px ${-viewport.y}px`;

  data.p.forEach(p => {
    const size = 10;
    const x = Math.round(p[0]) - viewport.x;
    const y = Math.round(p[1]) - viewport.y;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
    grad.addColorStop(0, 'white');
    grad.addColorStop(1, 'transparent');
    const angle = p[2];


    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, size * 4, angle - (Math.PI / 4), angle + (Math.PI / 4));
    ctx.lineTo(x, y);
    ctx.fill();

    if (p[4] < 2)
      switch (p[3]) {
        case 3:
          ctx.fillStyle = 'lime';
          break;
        case 2:
          ctx.fillStyle = 'yellow';
          break;
        case 1:
          ctx.fillStyle = 'red';
          break;
      }
    else
      ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // if (p.nickname) {
    //   ctx.strokeText(p.nickname, x, y - 15);
    // }
    ctx.fillStyle = 'red';
    p[6].forEach(b => {
      ctx.fillRect(b[0] - viewport.x - 2, b[1] - viewport.y - 2, 4, 4);
    });
    if (!p[5]) {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
      grad.addColorStop(1, 'chartreuse');
      grad.addColorStop(0.5, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, size * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  if (true) {
    const size = 10;
    let pColor = '';
    if (data.p[data.id][4] < 2)
      switch (data.p[data.id][3]) {
        case 3:
          ctx.fillStyle = 'lime';
          break;
        case 2:
          ctx.fillStyle = 'yellow';
          break;
        case 1:
          ctx.fillStyle = 'red';
          break;
      }
    else
      ctx.fillStyle = 'white';
    let x = data.p[data.id][0];
    let y = data.p[data.id][1];
    viewport.center(x, y);
    x -= viewport.x;
    y -= viewport.y;
    const mygrad = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
    mygrad.addColorStop(0, ctx.fillStyle);
    mygrad.addColorStop(1, 'transparent');
    ctx.fillStyle = mygrad;
    ctx.beginPath();
    ctx.arc(x, y, size * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ctx.fillStyle = ctx.createPattern(wallimg, 'repeat');

  // walls.forEach(wall => {
  //   ctx.drawImage(wallimg, 50 * wall.x - viewport.x, 50 * wall.y - viewport.y);
  // });

  // calcCollisions();
  /*
  powerups.forEach((pu, i) => {
    const x = pu.x * 50;
    const y = pu.y * 50;
    const lowb = 15;
    const topb = 35;
    if (pu.type === 'shield')
      ctx.drawImage(shield_img, x - viewport.x, y - viewport.y);
    else if (pu.type === 'heart')
      ctx.drawImage(heart_img, x - viewport.x, y - viewport.y);
    if (player.x > x + lowb && player.x < x + topb && player.y > y + lowb && player.y < y + topb) {
      powerups.splice(i, 1);
      if (pu.type === 'heart')
        sfx.heartPick.play();
      else if (pu.type === 'shield')
        sfx.shieldPick.play();
      socket.emit('pickupPowerup', i);
    }
  });
  */
};

socket.onmessage = (ev) => {
  const data = JSON.parse(ev.data);
  updatePlayer(data.p[data.id]);
  render(data);
};

socket.onclose = (event) => {
  console.log('Connection closed. Code: ' + event.code)
};
//#endregion

const initSocket = () => {
  socket.on('welcome', data => {
    player = data.player;
    document.getElementById('hav-io').textContent = `hav-io   room id: ${player.roomId}`;
    walls = data.room.walls;
    powerups = data.room.powerups;
    size = data.size
    chatField.textContent = data.messages;
    updateHealth();
    setTimeout(() => setInterval(() => {
      calcCollisions();
      viewport.center(player.x, player.y);
    }, 1000 / 50), 10);
  });

  socket.on('update', data => {

  });

  socket.on('updatePlayer', data => {
    document.getElementById('ping').textContent = 'ping: ' + (Date.now() - pingStart);

    player = data;
    if (awaitFunc) {
      awaitFunc();
      awaitFunc = null;
    }
  });

  socket.on('updatePowerups', data => {
    powerups = data;
  });

  socket.on('updateConnected', data => {
    let str = '';
    data.forEach(pl => {
      if (pl.nickname && pl.nickname.length > 0) {
        str += `${pl.nickname}\r\n`;
      } else {
        str += `player_${pl.id}\r\n`;
      }
    });
    connected.textContent = str;
  });

  socket.on('gameOver', () => {
    sfx.die.play();
    deaths++;
    canvas.classList = '';
    setTimeout(() => {
      canvas.classList.add('animhit')
    }, 100);
    canvas.style.animationPlayState = 'running';
    updatescore();
  });

  socket.on('hitted', () => {
    sfx.hit.play();
    syncEmit(() => {
      canvas.classList = '';
      // canvas.classList.remove('animhit');
      setTimeout(() => {
        canvas.classList.add('animhit')
      }, 100);

      canvas.style.animationPlayState = 'running';
      updateHealth();
    });
  });

  socket.on('healthup', () => {
    canvas.classList = '';
    setTimeout(() => {
      canvas.classList.add('animheal')
    }, 100);
    canvas.style.animationPlayState = 'running';
    syncEmit(() => {
      updateHealth();
    });
  })

  socket.on('frag', () => {
    kills++;
    updatescore();
  });

  socket.on('newMsg', data => {
    chatField.textContent += data;
  });

  setInterval(() => {
    pingStart = Date.now();
    socket.emit('getMe');
    socket.emit('move', { vector: movevector });
    console.log('mv');
  }, 50);

  syncEmit = (callback) => {
    socket.emit('getMe');
    awaitFunc = callback;
  };
};


const shoot = () => {
  sfx.shoot.play();
  socket.send('{"shoot":1}');
};

const speedup = (val) => {
  if (val)
    sfx.speedup.play();
  else {
    sfx.speedup.pause();
    sfx.speedup.currentTime = 0;
  }
  player.speed = Number(val);
  socket.send(JSON.stringify({ speedup: val }));
};

const interpolate = (start, end) => (
  start + (end - start) * smoothness
)

const reload = () => {
  setInterval(() => {
    location.reload()
  }, 200)
};

const mute = () => {
  if (muted) {
    muteButton.style.backgroundImage = 'url(\'./img/Mute.png\')';
    muted = false;
    for (const s in sfx) {
      sfx[s].muted = false;
    }
  } else {
    muteButton.style.backgroundImage = 'url("./img/Unmute.png")';
    muted = true;
    for (const s in sfx) {
      sfx[s].muted = true;
    }
  }
};

const updatescore = () => {
  document.getElementById('kills').textContent = `kills: ${kills ? kills : 0}`;
  document.getElementById('deaths').textContent = `deaths: ${deaths ? deaths : 0}`;
};

const updateHealth = () => {
  Array.prototype.forEach.call(heartContainer.children, child => {
    child.style.display = 'none';
  })
  let i = 0;
  while (i < player.health) {
    heartContainer.children[i].style.display = 'inline';
    i++;
  }
};

const clearSpaces = s => {
  while (s.charAt(0) === ' ')
    s = s.substring(1, s.length);
  while (s.charAt(s.length - 1) === ' ')
    s = s.substring(0, s.length - 1);
  if (s === ' ')
    return '';
  return s;
};

const calcCollisions = () => {

  for (let i = 0; i < walls.length; i++) {
    const wall = walls[i];
    const x = wall.x * 50;
    const y = wall.y * 50;

    for (let i = 0; i < player.bullets.length; i++) {
      const b = player.bullets[i];
      if (b.x - 2 < x + wall.w && b.x + 2 > x &&
        b.y + 2 > y && b.y - 2 < y + wall.h) {
        player.bullets.splice(i, 1);
        socket.emit('updateMe', player);
        break;
      }
    }

    const s = player.speed;
    const fdx = player.vector.x * player.speed;
    const fdy = player.vector.y * player.speed;

    if (player.x - player.size + fdx < x + wall.w && player.x + player.size + fdx > x &&
      player.y + player.size + fdy > y && player.y - player.size + fdy < y + wall.h) {

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

      // syncEmit(() => {
      socket.emit('updateMe', player);
      // })

      // syncEmit(() => {
      //   socket.emit('updateMe', player);
      // })
      break;
    }
    // player.collides = false;
  }

};

if (testing) mute();
