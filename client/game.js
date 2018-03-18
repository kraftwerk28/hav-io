'use strict';

const socket = io();
let player = {};
let movevector = [0, 0];
let awaitFunc = null;
let bulletClock;
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
      socket.emit('updateMe', player);
      nicknameinput.value = n;
    });
};

window.onunload = () => {
  localStorage.setItem('haviodeaths', deaths);
  localStorage.setItem('haviokills', kills);
};

//#region audio
const sfx = {
  die: new Audio('./sfx/Death.wav'),
  shoot: new Audio('./sfx/Shoot.wav'),
  speedup: new Audio('./sfx/Speedup.wav'),
  soundtrack: new Audio('./sfx/st.mp3')
}
sfx.soundtrack.loop = true;
sfx.soundtrack.volume = 0.5;
//#endregion

//#region html
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
    socket.emit('updateMe', player);
    socket.emit('updateConnected');
  });
}
chatInput.onkeydown = (e) => {
  const str = clearSpaces(chatInput.value);
  if (e.keyCode === 13 && str.length > 0) {
    e.preventDefault();
    socket.emit('newMsg', { player, msg: str });
    chatInput.value = '';
  }
};

const canvas = document.getElementById('game');
canvas.style.animationPlayState = 'paused';
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
canvas.width = 700;
canvas.height = 500;
const canvOffset = canvas.getBoundingClientRect();
// ctx.fillStyle = 'lime';
ctx.strokeStyle = 'yellow';
ctx.font = '12px Consolas';
ctx.textAlign = 'center';


canvas.onmousemove = (e) => {
  const x = e.x - canvOffset.x;
  const y = e.y - canvOffset.y;
  const vec = [x - player.x, y - player.y];
  const l = Math.sqrt(Math.pow(vec[0], 2) + Math.pow(vec[1], 2));
  const vector = { x: vec[0] / l, y: vec[1] / l };
  socket.emit('move', { vector });
};

canvas.onmouseleave = () => {
  clearInterval(bulletClock);
}

canvas.oncontextmenu = () => false;

canvas.onmousedown = (e) => {
  e.preventDefault();
  if (e.button === 0) {
    shoot();
    bulletClock = setInterval(() => {
      shoot();
    }, 500);
  }
  else if (e.button === 2) {
    speedup(true);
  }
};
canvas.onmouseup = (e) => {
  e.preventDefault();
  if (e.button === 0) {
    clearInterval(bulletClock);
  }
  else if (e.button === 2) {
    speedup(false);
  }
}
//#endregion

//#region images
const wallimg = new Image();
wallimg.src = './img/brick.png';
// wallimg.style = 'image-rendering: pixelated';
const shield_img = new Image();
shield_img.src = './img/shield_powerup.png';
const heart_img = new Image();
heart_img.src = './img/heart_powerup.png';
//#endregion

socket.on('welcome', data => {
  player = data.player;
  walls = data.walls;
  powerups = data.powerups;
  updateHealth();
});

socket.on('updatePlayer', data => {
  player = data;
  if (awaitFunc) {
    awaitFunc();
    awaitFunc = null;
  }
});

socket.on('updatePowerups', data => {
  powerups = data;
});

socket.on('update', data => {
  ctx.clearRect(0, 0, 700, 500);

  data.players.forEach(p => {
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, p.size * 4);
    grad.addColorStop(0, 'white');
    grad.addColorStop(1, 'transparent');
    const angle = Math.atan2(p.vector.y, p.vector.x);


    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, p.size * 4, angle - (Math.PI / 4), angle + (Math.PI / 4));
    ctx.lineTo(x, y);
    ctx.fill();

    if (p.speed <= 1)
      switch (p.health) {
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
    ctx.arc(x, y, player.size, 0, Math.PI * 2);
    ctx.fill();
    if (player.id === p.id) {
      const mygrad = ctx.createRadialGradient(x, y, 0, x, y, player.size * 3);
      mygrad.addColorStop(0, ctx.fillStyle);
      mygrad.addColorStop(1, 'transparent');
      ctx.fillStyle = mygrad;
      ctx.beginPath();
      ctx.arc(x, y, player.size * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p.nickname) {
      ctx.strokeText(p.nickname, x, y - 15);
    }
    ctx.fillStyle = 'red';
    p.bullets.forEach(b => {
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    })
    if (!p.vulnerable) {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, p.size * 3);
      grad.addColorStop(1, 'chartreuse');
      grad.addColorStop(0.5, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.fillStyle = ctx.createPattern(wallimg, 'repeat');
  walls.forEach(wall => {
    // ctx.fillRect(50 * wall.x, 50 * wall.y, wall.w, wall.h);
    ctx.drawImage(wallimg, 50 * wall.x, 50 * wall.y);
    const x = wall.x * 50;
    const y = wall.y * 50;    //collision
    const s = player.speed;
    if (player.x - player.size < x + wall.w && player.x + player.size > x &&
      player.y + player.size > y && player.y - player.size < y + wall.h) {
      if (player.y + player.size > y && player.y - player.size < y + wall.h) {
        player.vector.x = -player.vector.x;
        player.x += player.x - x < 0 ? -s - 1 : s + 1;
      }

      if (player.x + player.size > x && player.x - player.size < x + wall.w) {
        player.vector.y = -player.vector.y;
        player.y += player.y - y < 0 ? -s - 1 : s + 1;
      }
      // ctx.fillStyle = 'red'
      // ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      // ctx.fillStyle = ctx.createPattern(wallimg, 'repeat');
      // player.vector.x = -player.vector.x;
      socket.emit('updateMe', player);
    }

    for (let i = 0; i < player.bullets.length; i++) {
      const b = player.bullets[i];
      if (b.x - 2 < x + wall.w && b.x + 2 > x &&
        b.y + 2 > y && b.y - 2 < y + wall.h) {
        player.bullets.splice(i, 1);
        socket.emit('updateMe', player);
      }
    }

  });

  powerups.forEach((pu, i) => {
    const x = pu.x * 50;
    const y = pu.y * 50;
    const lowb = 15;
    const topb = 35;
    if (pu.type === 'shield')
      ctx.drawImage(shield_img, x, y);
    else if (pu.type === 'heart')
      ctx.drawImage(heart_img, x, y);
    if (player.x > x + lowb && player.x < x + topb && player.y > y + lowb && player.y < y + topb) {
      powerups.splice(i, 1);
      socket.emit('pickupPowerup', i);
    }
  });
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
  canvas.classList.remove('animhit');
  setTimeout(() => {
    canvas.classList.add('animhit')
  }, 100);
  canvas.style.animationPlayState = 'running';
  // setInterval(() => { canvas.style.animationPlayState = 'paused'; }, 3000);
  updatescore();
});

socket.on('hitted', () => {
  syncEmit(() => {
    canvas.classList.remove('animhit');
    setTimeout(() => {
      canvas.classList.add('animhit')
    }, 100);

    canvas.style.animationPlayState = 'running';
    // canvas.classList = '';
    updateHealth();
  });
});

socket.on('healthup', () => {
  syncEmit(() => {
    // canvas.style.animationPlayState = 'paused';
    // canvas.classList.remove('animheal');
    // setInterval(() => { canvas.style.animationPlayState = 'paused' }, 2000);
    // setInterval(() => {
    //   canvas.classList.add('animheal')
    // }, 100);
    // canvas.classList.add('animheal')
    // canvas.style.animationPlayState = 'running';
    // canvas.classList = '';
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

const shoot = () => {
  sfx.shoot.play();
  syncEmit(() => {
    socket.emit('shoot');
  });
};

const speedup = (val) => {
  if (val)
    sfx.speedup.play();
  else {
    sfx.speedup.pause();
    sfx.speedup.currentTime = 0;
  }

  syncEmit(() => {
    socket.emit('speedup', val);
  });
};

const syncEmit = (callback) => {
  socket.emit('getMe');
  awaitFunc = callback;
};

const reload = () => {
  setInterval(() => { location.reload() }, 200)
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
}

const updateHealth = () => {
  Array.prototype.forEach.call(heartContainer.children, child => {
    child.style.display = 'none';
  })
  let i = 0;
  while (i < player.health) {
    heartContainer.children[i].style.display = 'inline';
    i++;
  }
}

const clearSpaces = s => {
  while (s.charAt(0) === ' ')
    s = s.substring(1, s.length);
  while (s.charAt(s.length - 1) === ' ')
    s = s.substring(0, s.length - 1);
  if (s === ' ')
    return '';
  return s;
};

setInterval(() => {
  socket.emit('getMe');
}, 100);
