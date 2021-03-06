/**
 * Main client-side script
 */
'use strict';

const testing = !1,
  testURL = 'ws://127.0.0.1:8080' + location.pathname,
  nativeURL = 'ws://kraftwerk28.pp.ua:8090',
  $ = (s) => document.getElementById(s);
let
  socket = null,

  player = {
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
    nickname: '',
  },

  playersData = {},
  touches = {
    is: false,
    sx: null, sy: null, x: null, y: null,
    reset() { this.sx = this.x; this.sy = this.y }
  },

  bulletClock,
  canvOffset = {},
  rClick = false,
  lClick = false,

  pingStart = 0,
  pingElapsed = true,
  size = 1500,
  canvasCenter = {},
  loaded = false,
  smoothness = 0.2,
  isMobile = false,

  points = 0,
  minPrice = 2,

  shClock,
  shootInterval = 0;

requestAnimationFrame =
  requestAnimationFrame ||
  webkitRequestAnimationFrame ||
  window.requestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.msRequestAnimationFrame;

// virtual 'camera'
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

let kills = 0,
  deaths = 0,

  muted = false,
  walls = [],
  powerups = [];

// send indepentent http SET reqest
const sendHTTP = (data) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'err=' + data.toString(), false);
  xhr.send();
};

window.onload = () => {
  muteButton.style.backgroundImage = 'url(\'./img/Mute.png\')';
  const n = localStorage.getItem('havionick');
  kills = localStorage.getItem('haviokills') ?
    localStorage.getItem('haviokills') : 0;
  deaths = localStorage.getItem('haviodeaths') ?
    localStorage.getItem('haviodeaths') : 0;
  updatescore();
  if (n) {
    player.nickname = n;
    nicknameinput.value = n;
  }
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

window.oncontextmenu = () => false;

window.onwheel = (e) => {
  e.preventDefault();
};

window.onresize = (e) => {
  canvOffset = canvas.getBoundingClientRect();
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  viewport.init(canvas.width, canvas.height);
};

window.onscroll = (e) => {
  e.preventDefault();
};

window.onerror = (msg, url, line, column) => {
  if (true) {
    if (socket && socket.readyState === 1)
      socket.send(JSON.stringify({
        error: `${new Date()}\n${navigator.userAgent}\n\t${line}:${column}\t${msg}\n\n`
      }));
    else
      sendHTTP(`${new Date()}%0A${navigator.userAgent}%0A%09${line}:${column}%09${msg}%0A%0A`);
  }

};

const overlay = $('authoverlay');
const auth = () => {
  $('loader').style.visibility = 'visible';
  const check = () => {
    if (!loaded) {
      setTimeout(() => {
        check();
      }, 500);
    } else {
      overlay.style.animationPlayState = 'running';
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
};
sfx.soundtrack.loop = true;
sfx.soundtrack.volume = 0.5;
sfx.soundtrack.oncanplaythrough = () => { loaded = true; }

const
  heartContainer = $('heartContainer'),
  muteButton = $('mute'),
  connected = $('connected'),
  _roomId = $('roomId'),
  nicknameinput = $('nick'),
  fullscreenBtn = $('fullScreen');
nicknameinput.oninput = (e) => {
  localStorage.setItem('havionick', nicknameinput.value);
  player.nickname = nicknameinput.value;
};

nicknameinput.onkeydown = (e) => {
  if (e.keyCode === 13) {
    auth();
  }
};

$('authentification').onclick = () => {
  auth();
};

Array.prototype.forEach.call(document.getElementsByClassName('upBtn'), el => {
  el.onclick = () => {
    upgrade(parseInt(el.id));
  }
});

// upgrade menu setup
let upMenuFlag = false;
const
  upgradeBtn = $('upgradeBtn'),
  arrow = upgradeBtn.children[0],
  upgradeMenu = $('upgradeMenu');

Array.prototype.forEach.call(
  upgradeMenu.children,
  c => {
    // c.style.visibility = 'hidden';
    setTimeout(() => {
      c.style.display = 'none';
    }, 300);
  }
);

upgradeBtn.onclick = () => {
  upgradeBtn.style.animationName = '';
  upMenuFlag = !upMenuFlag;
  if (upMenuFlag) {
    Array.prototype.forEach.call(
      upgradeMenu.children,
      c => {
        c.style.visibility = 'visible';
        c.style.display = 'block';
      }
    );
    upgradeMenu.style.height = '260px';
    upgradeMenu.style.opacity = '1';
    arrow.style.transform = 'rotateX(180deg)';
    upgradeMenu.addEventListener('mouseleave',
      () => {
        setTimeout(() => {
          if (upMenuFlag) upgradeBtn.click();
        }, 1000);
      },
      { once: true });
  } else {
    Array.prototype.forEach.call(
      upgradeMenu.children,
      c => {
        c.style.visibility = 'hidden';
      }
    );
    upgradeMenu.style.height = '0px';
    upgradeMenu.style.opacity = '0';

    upgradeBtn.style.backgroundColor = 'orange';
    arrow.style.transform = 'rotateX(0deg)';
  }
};

fullscreenBtn.onclick = () => { goFullScreen(); }

// minimap
const minimap = $('minimap');
const minictx = minimap.getContext('2d');
minictx.fillStyle = 'lime';
minictx.strokeStyle = 'lime';

// main canvas setup
const canvas = $('game');
canvas.style.animationPlayState = 'paused';
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
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
};

canvas.onmouseenter = () => {
  canvOffset = canvas.getBoundingClientRect();
};

canvas.onmousedown = (e) => {
  e.preventDefault();
  if (e.button === 0) {
    lClick = true;
    if (!rClick) {
      shoot(true);
    }
  } else if (e.button === 2) {
    e.preventDefault();
    rClick = true;
    if (!lClick)
      speedup(true);
  }
};

canvas.onmouseup = (e) => {
  e.preventDefault();
  if (e.button === 0) {
    lClick = false;
    shoot(false);
    clearInterval(bulletClock);
  } else if (e.button === 2) {
    rClick = false;
    speedup(false);
  }
};

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
  const mobSpeedup = $('mobSpeedup');
  const mobShoot = $('mobShoot');
  $('mute').style.display = 'none';
  mobSpeedup.style.display = 'inline';
  mobShoot.style.display = 'inline';
  mobSpeedup.ontouchstart = () => {
    speedup(true);
  };
  mobSpeedup.ontouchend = () => {
    speedup(false);
  };
  mobShoot.ontouchstart = () => {
    shoot(true);
  };
  mobShoot.ontouchend = (e) => {
    shoot(false);
  };

  canvas.ontouchstart = (e) => {
    if (e.targetTouches.length < 2) {
      touches.sx = e.changedTouches[0].clientX;
      touches.sy = e.changedTouches[0].clientY;
    }
    else {
      shoot();
    }
  };
  canvas.ontouchmove = (e) => {
    touches.is = true;
    touches.x = e.targetTouches[0].clientX;
    touches.y = e.targetTouches[0].clientY;
    const x = touches.x - canvOffset.x;
    const y = touches.y - canvOffset.y;
    const vec = [touches.x - touches.sx, touches.y - touches.sy];
    const l = Math.sqrt(Math.pow(vec[0], 2) + Math.pow(vec[1], 2));
    socket.send(JSON.stringify({ vec: [...vec.map(v => v / l)] }));
  };
  canvas.ontouchend = (e) => {
    if (e.target === canvas) {
      touches.is = false;
      touches.reset();
    }
  }

  // upgradeBtn.addEventListener('cl') = upgradeBtn.onclick;
};

// making compatible with mobile devices
if (typeof window.orientation !== 'undefined') {
  if (window.orientation === 0 || window.orientation === 180)
    $('mob').style.display = 'inline';
  document.onfullscreenchange = () => {
    $('fullScreen').hidden =
      document.fullscreenEnabled || document.webkitIsFullScreen;
  };
  document.body.onwebkitfullscreenchange = document.onfullscreenchange;
  $('authentification').onclick = () => {
    auth();
    $('mob').style.display = 'none';
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
  $('overlay').children[0].style.transform = 'scale(0.5) translate(-50%, -50%)';
  $('overlay').children[1].style.transform = 'scale(0.5) translate(50%, -50%)';
}

// disallow for iPhones
if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
  $('about').style.backgroundColor = 'tomato';
  $('about').textContent = 'Sorry, this game is\nunavailable for your device';
  $('authentification').disabled = 'true';
} else {
  $('about').textContent = 'left click: shoot\nright click: accelerate\nearn points and upgrade your unit\n kill players to be coolest; gl hf)';
}

const getPlColor = (val) => {
  switch (val) {
    case 1:
      return 'red';
    case 2:
      return 'yellow';
    case 3:
      return 'lime';
    case 4:
      return 'cyan';
    case 5:
      return 'blue';
    case 6:
      return 'magenta';
    default:
      break;
  }
};

// color-by-number
const rainbow = (val) => {
  switch (val) {
    case 0:
      return 'tomato';
    case 1:
      return 'gold';
    case 2:
      return 'lime';
    case 3:
      return 'lightskyblue';
    case 4:
      return 'royalblue';
    case 5:
      return 'magenta';
    default:
      break;
  }
}

// main rendering function
const render = (data) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  minictx.clearRect(0, 0, minimap.width, minimap.height);
  minictx.strokeRect(0, 0, minimap.width, minimap.height);
  ctx.lineWidth = 1;

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

      ctx.fillStyle = getPlColor(p[3]);

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
      ctx.fillStyle = getPlColor(data.p[data.id][3]);
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
      ctx.arc(x, y, s * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (data.b) {
    data.b.forEach(p => {
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

  if (touches.is) {
    ctx.strokeStyle = 'rgba(50, 255, 0, 0.4)';

    ctx.beginPath();
    ctx.lineWidth = 30;
    ctx.lineCap = 'round';
    ctx.moveTo(touches.sx, touches.sy);
    ctx.lineTo(touches.x, touches.y);
    ctx.stroke();
  }
};

// parsing income data
const processData = (data) => {
  if (data.p) {
    const info = data.p[data.id];
    player.x = info[0];
    player.y = info[1];
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
        screenEffects.heal();
        sfx.heartPick.play();
        break;
      case 'shield':
        sfx.shieldPick.play();
        screenEffects.shield();
    }
  }
  if (data.points !== undefined) {
    $('points').children[1].textContent = data.points;
    points = data.points;
    if (points >= minPrice &&
      upgradeBtn.style.animationName === '' && !upMenuFlag)
      upgradeBtn.style.animationName = 'upgra';
  }
  if (data.upgStats !== undefined) {
    shootInterval = data.upgStats[2][0];
    minPrice = Math.min(...data.upgStats.map(a => Math.pow(2, a[1] + 1)));
    Array.prototype.forEach.call(upgradeMenu.children, (ch, i) => {
      ch.children[1].textContent = data.upgStats[i][0];
      ch.children[2].textContent =
        Math.pow(2, data.upgStats[i][1] + 1) >= 64 ? 'MAX' :
          Math.pow(2, data.upgStats[i][1] + 1);
      ch.style.backgroundColor = rainbow(data.upgStats[i][1]);
    });
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
  if (data === 'p') {
    pingStart = Date.now() - pingStart;
    $('ping').textContent = pingStart;
  }
  requestAnimationFrame(() => { render(data); });
  // window.requestAnimationFrame(render);
  // render(data);
};

// initializing sockets on client-side
const socketize = () => {
  socket = new WebSocket(testing ? testURL : nativeURL);

  socket.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    processData(data);
  };

  socket.onopen = (ev) => {
    socket.send(JSON.stringify({ nickname: player.nickname }));
    // document.body.removeChild(overlay);
    setInterval(() => {
      pingStart = Date.now();
      socket.send('"p"');
    }, 1000);
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

// custom functions 
const upgrade = (index) => {
  socket.send(`{"upgrade":${index}}`);
};

const shoot = (bool) => {
  if (lClick)
    sfx.shoot.play();
  const f = () => {
    setTimeout(() => {
      if (lClick) {
        sfx.shoot.play();
        f();
      }
    }, shootInterval);
  };
  f();
  socket.send(`{"shoot":${bool ? 1 : 0}}`);
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
  location.replace('/');
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
  $('kills').textContent = `kills: ${kills ? kills : 0}`;
  $('deaths').textContent = `deaths: ${deaths ? deaths : 0}`;
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

const goFullScreen = () => {
  document.body.webkitRequestFullScreen();
};

const command = (c) => {
  socket.send(JSON.stringify({ command: c }));
};

if (testing) {
  mute();
}
nicknameinput.focus();
