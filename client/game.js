'use strict';

const testing = !1;
const testURL = 'ws://192.168.1.104:8080/';
const nativeURL = 'ws://kraftwerk28.pp.ua/';
let socket = null;

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
  nickname: ''
};

let playersData = {};


let awaitFunc = null;
let bulletClock;
let canvOffset = {};
let rClick = false;
let lClick = false;
let pingStart = 0;
let size = 1500;
let canvasCenter = {};
let loaded = false;
let smoothness = 0.2;
let isMobile = false;

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

const sendHTTP = (data) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'err=' + data.toString(), false);
  xhr.send();
};

window.onload = () => {
  muteButton.style.backgroundImage = 'url(\'./img/Mute.png\')';
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
  updateHealth(3);
  canvOffset = canvas.getBoundingClientRect();
};

window.onunload = () => {
  localStorage.setItem('haviodeaths', deaths);
  localStorage.setItem('haviokills', kills);
};

window.oncontextmenu = () => testing;

window.onwheel = (e) => {
  e.preventDefault();
}

window.onresize = (e) => {
  canvOffset = canvas.getBoundingClientRect();
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  viewport.init(canvas.width, canvas.height);
}

window.onscroll = (e) => {
  e.preventDefault();
  // canvOffset = canvas.getBoundingClientRect();
};

window.onerror = (msg, url, line, column) => {
  // console.error(e);
  if (true) {
    if (socket && socket.readyState === 1)
      socket.send(JSON.stringify({
        error: `${new Date()}\n${navigator.userAgent}\n\t${line}:${column}\t${msg}\n\n`
      }));
    else
      sendHTTP(`${new Date()}%0A${navigator.userAgent}%0A%09${line}:${column}%09${msg}%0A%0A`);
  }

};

const overlay = document.getElementById('authoverlay');
const auth = () => {
  document.getElementById('loader').style.visibility = 'visible';
  const check = () => {
    if (!loaded) {
      setTimeout(() => {
        check();
      }, 500);
    } else {
      overlay.style.animationPlayState = 'running';
      // overlay.style.display = 'none';
      socketize();
      sfx.soundtrack.play();
    }
  };
  check();
};

//#region frontend
// sound init
const _play = Audio.prototype.play;
Audio.prototype.play = function () {
  if (!isMobile) {
    _play.apply(this);
  }
};
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
sfx.soundtrack.oncanplaythrough = () => { loaded = true }

const heartContainer = document.getElementById('heartContainer');

const muteButton = document.getElementById('mute');
const connected = document.getElementById('connected');
const _roomId = document.getElementById('roomId');
const nicknameinput = document.getElementById('nick');
nicknameinput.oninput = (e) => {
  localStorage.setItem('havionick', nicknameinput.value);
  player.nickname = nicknameinput.value;
};

/*
let upMenuFlag = false;
const upgrader = document.getElementById('upgradeMenu');
const upgradeBnt = document.getElementById('upgradeBtn');
upgradeBnt.style.top = '0px';
upgrader.style.top = upgradeBnt.style.top;
upgrader.style.left = upgradeBnt.style.left;
upgradeBnt.onclick = () => {
  upMenuFlag = !upMenuFlag;
  if (upMenuFlag) {
    upgradeBtn.style.top = '-50px';
    upgradeBtn.style.backgroundColor = 'green';
  } else {
    upgradeBtn.style.top = '0px';
    upgradeBtn.style.backgroundColor = 'orange';
  }
};
*/

// minimap
const minimap = document.getElementById('minimap');
const minictx = minimap.getContext('2d');
minictx.fillStyle = 'lime';
minictx.strokeStyle = 'lime';

// main canvas
const canvas = document.getElementById('game');
canvas.style.animationPlayState = 'paused';
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
canvas.width = window.innerWidth;//900;
canvas.height = window.innerHeight;//550;
ctx.strokeStyle = 'yellow';
ctx.font = '10px Roboto Mono';
ctx.textAlign = 'center';
ctx.lineCap = 'round';

// canvas event binding
canvas.onmousemove = (e) => {
  const x = e.x - canvOffset.x;
  const y = e.y - canvOffset.y;
  const vec = [x - player.x + viewport.x, y - player.y + viewport.y];
  const l = Math.sqrt(Math.pow(vec[0], 2) + Math.pow(vec[1], 2));
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

// images init
const wallimg = new Image();
wallimg.src = './img/brick.png';
const shield_img = new Image();
shield_img.src = './img/shield_powerup.png';
const heart_img = new Image();
heart_img.src = './img/heart_powerup.png';

const screenEffects = {
  hit() {
    canvas.classList = '';
    setTimeout(() => {
      canvas.classList.add('animhit')
    }, 100);

    canvas.style.animationPlayState = 'running';
  },
  heal() {
    canvas.classList = '';
    setTimeout(() => {
      canvas.classList.add('animheal')
    }, 100);

    canvas.style.animationPlayState = 'running';
  },
  gameover() {
    canvas.classList = '';
    setTimeout(() => {
      canvas.classList.add('animgameover')
    }, 100);

    canvas.style.animationPlayState = 'running';
  },
  shield() {
    canvas.classList = '';
    setTimeout(() => {
      canvas.classList.add('animshield')
    }, 100);

    canvas.style.animationPlayState = 'running';
  }
};
//#endregion

const mobilize = () => {
  isMobile = true;
  let startX = 0;
  let startY = 0;
  const mobSpeedup = document.getElementById('mobSpeedup');
  const mobShoot = document.getElementById('mobShoot');
  document.getElementById('mute').style.display = 'none';
  mobSpeedup.style.display = 'inline';
  mobShoot.style.display = 'inline';
  // speedup(true);
  mobSpeedup.ontouchstart = () => {
    speedup(true);
  };
  mobSpeedup.ontouchend = () => {
    speedup(false);
  };
  mobShoot.ontouchstart = () => {
    shoot();
  };
  // mobSpeedup.style.backgroundImage
  canvas.ontouchstart = (e) => {
    if (e.touches.length < 2) {

      startX = e.changedTouches[0].clientX;
      startY = e.changedTouches[0].clientY;
    }
    else
      shoot();
  };
  canvas.ontouchmove = (e) => {
    const x = e.changedTouches[0].clientX - canvOffset.x;
    const y = e.changedTouches[0].clientY - canvOffset.y;
    const vec = [x - startX/* - player.x + viewport.x*/, y - startY/* - player.y + viewport.y*/];
    const l = Math.sqrt(Math.pow(vec[0], 2) + Math.pow(vec[1], 2));
    socket.send(JSON.stringify({ vec: [...vec.map(v => v / l)] }));

    ctx.strokeStyle = 'lime';

    ctx.lineWidth = 5;
    ctx.moveTo(startX, startY);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  // document.body.style.transform = 'rotate(90deg)';
  // document.body.style.position = 'absolute';
  // document.body.style.right = '0px';
  // document.body.style.top = '0px';
};

if (typeof window.orientation !== 'undefined') {
  if (window.orientation === 0 || window.orientation === 180)
    document.getElementById('mob').style.display = 'inline';
  // document.getElementById('authentification').disabled = true;
  // document.getElementById('about').textContent = 'Sorry, this game is for desktops only yet((';
  // document.getElementById('about').style.backgroundColor = 'crimson';

  document.getElementById('authentification').onclick = () => {
    auth();
    document.getElementById('mob').style.display = 'none';
    mobilize();
    setTimeout(() => {
      try {
        document.body.requestFullscreen();
      } catch (error) {
        try {
          document.body.webkitRequestFullscreen();
        } catch (error) {
          const m1 = document.createElement('meta');
          m1.name = 'apple-mobile-web-app-capable';
          m1.content = 'yes';
          const m2 = document.createElement('meta');
          m2.name = 'apple-mobile-web-app-status-bar-style';
          m2.content = 'black-translucent';
          document.head.appendChild(m1);
          document.head.appendChild(m2);
        }
      }
      loaded = true;
    }, 500);
  };
  document.getElementById('overlay').children[0].style.transform = 'scale(0.5) translate(-50%, -50%)';
  document.getElementById('overlay').children[1].style.transform = 'scale(0.5) translate(50%, -50%)';
}

//#region pre-render init
// const grad1 = ctx.createRadialGradient(x, y, 0, x, y, s * 4);
//#endregion

const render = (data) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  minictx.clearRect(0, 0, minimap.width, minimap.height);
  minictx.strokeRect(0, 0, minimap.width, minimap.height);
  ctx.lineWidth = 1;
  // console.log(data);
  // viewport.center(player.x, player.y);

  canvas.style.backgroundPosition = `${-viewport.x}px ${-viewport.y}px`;

  walls.forEach(wall => {
    ctx.drawImage(wallimg, wall.x - viewport.x, wall.y - viewport.y);
  });

  if (data.p) {
    data.p.forEach(p => {
      const s = player.size;
      let x = Math.round(p[0]);
      let y = Math.round(p[1]);
      minictx.fillRect(x / size * 100, y / size * 100, 2, 2);
      x -= viewport.x;
      y -= viewport.y;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, s * 4);
      grad.addColorStop(0, 'white');
      grad.addColorStop(1, 'transparent');
      const angle = p[2];

      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, s * 4, angle - (Math.PI / 4), angle + (Math.PI / 4));
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
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'yellow';
      if (playersData.nicknames) {
        const ii = playersData.nicknames.findIndex(pn => pn[0] === p[7]);
        if (ii > -1) {
          ctx.strokeText(playersData.nicknames[ii][1], x, y - 15);
        }
      }
      ctx.fillStyle = 'red';
      p[6].forEach(b => {
        ctx.fillRect(b[0] - viewport.x - 2, b[1] - viewport.y - 2, 4, 4);
      });
      if (!p[5]) {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, s * 3);
        grad.addColorStop(1, 'chartreuse');
        grad.addColorStop(0.5, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, s * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    if (true) {
      const s = player.size;
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
      minictx.fillStyle = 'yellow';
      minictx.fillRect(x / size * 100, y / size * 100, 4, 4);
      minictx.fillStyle = 'lime';
      x -= viewport.x;
      y -= viewport.y;

      const mygrad = ctx.createRadialGradient(x, y, 0, x, y, s * 4);
      mygrad.addColorStop(0, ctx.fillStyle);
      mygrad.addColorStop(1, 'transparent');
      ctx.fillStyle = mygrad;
      // ctx.beginPath();
      ctx.arc(x, y, s * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (data.b) {
    data.b.forEach(p => {
      // console.log(p);
      const s = player.size;
      let x = Math.round(p[0]);
      let y = Math.round(p[1]);
      minictx.fillRect(x / size * 100, y / size * 100, 2, 2);
      x -= viewport.x;
      y -= viewport.y;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, s * 4);
      grad.addColorStop(0, 'white');
      grad.addColorStop(1, 'transparent');
      const angle = p[2];


      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, s * 4, angle - (Math.PI / 4), angle + (Math.PI / 4));
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
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'yellow';
      if (playersData.nicknames) {
        const ii = playersData.nicknames.findIndex(pn => pn[0] === p[7]);
        if (ii > -1) {
          ctx.strokeText(playersData.nicknames[ii][1], x, y - 15);
        }
      }
      ctx.fillStyle = 'red';
      p[6].forEach(b => {
        ctx.fillRect(b[0] - viewport.x - 2, b[1] - viewport.y - 2, 4, 4);
      });
      if (!p[5]) {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, s * 3);
        grad.addColorStop(1, 'chartreuse');
        grad.addColorStop(0.5, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, s * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  if (data.walls) {
    walls = data.walls;
  }
  if (data.powerups) {
    powerups = data.powerups;
  }

  // ctx.fillStyle = ctx.createPattern(wallimg, 'repeat');

  // calcCollisions();

  powerups.forEach((pu, i) => {
    const x = pu.x;
    const y = pu.y;
    const lowb = 15;
    const topb = 35;
    if (pu.type === 'shield')
      ctx.drawImage(shield_img, x - viewport.x, y - viewport.y);
    else if (pu.type === 'heart')
      ctx.drawImage(heart_img, x - viewport.x, y - viewport.y);
  });

  ctx.strokeStyle = 'red';
  ctx.beginPath();
  ctx.moveTo(-viewport.x, -viewport.y);
  ctx.lineTo(size - viewport.x, -viewport.y);
  ctx.lineTo(size - viewport.x, size - viewport.y);
  ctx.lineTo(-viewport.x, size - viewport.y);
  ctx.lineTo(-viewport.x, -viewport.y);
  ctx.stroke();
};

const processData = (data) => {
  if (data.p) {
    const info = data.p[data.id];
    player.x = info[0];
    player.y = info[1];
    // player.health = info[3];
    // player.vector[0] = info[2];
    // player.vector[1] = info[3];
  }
  if (data.health !== undefined) {
    player.health = data.health;
    updateHealth(player.health);
  }
  if (data.damage !== undefined) {
    if (data.health < 1) {
      deaths++;
      sfx.die.play();
      screenEffects.gameover();
      updatescore();
    } else {
      sfx.hit.play();
      screenEffects.hit();
      // updateHealth(player.health);
    }
    return;
  }
  if (data.frag !== undefined) {
    kills++;
    updatescore();
  }
  if (data.powerup !== undefined) {
    switch (data.powerup) {
      case 'heart':
        // updateHealth(player.health);
        screenEffects.heal();
        sfx.heartPick.play();
        break;
      case 'shield':
        sfx.shieldPick.play();
        screenEffects.shield();
    }

  }

  if (data.nicks !== undefined) {
    playersData.nicknames = data.nicks;
    connected.textContent = data.nicks.reduce((res, cur) => res + cur[1] + '\n', '');
  }
  if (data.roomId !== undefined) {
    _roomId.textContent = 'room id: ' + data.roomId;
  }

  if (data.console) {
    console.log(data.console);
  }

  render(data);
};

const socketize = () => {
  socket = new WebSocket(testing ? testURL : nativeURL);

  socket.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    processData(data);
    // render(data);
  };

  socket.onopen = (ev) => {
    socket.send(JSON.stringify({ nickname: player.nickname }));
    document.body.removeChild(overlay);
  };

  socket.onclose = (event) => {
    console.log('Connection closed. Code: ' + event.code);
    if (event.code === 1006)
      setTimeout(() => {
        socketize();
      }, 500);
  };

  socket.onerror = (event) => {
    console.warn(event);
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
  socket.close();
  // setInterval(() => {
  location.replace('/');
  // }, 200)
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

const updateHealth = (health) => {
  Array.prototype.forEach.call(heartContainer.children, child => {
    child.style.display = 'none';
  })
  let i = 0;
  while (i < health) {
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

const goFullScreen = () => {
  document.body.webkitRequestFullScreen();
};

const command = (c) => {
  socket.send(JSON.stringify({ command: c }));
};

if (testing) mute();
nicknameinput.focus();
