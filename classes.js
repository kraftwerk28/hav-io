/**
 * Class container module
 */
'use strict';

const _vector = require('./vector');

const randomRange = (start, end) => (
  Math.floor(Math.random() * end + start)
);
const canvas = { width: 700, height: 500 };

class Wall {
  constructor(x, y, w, h) {
    if (typeof x === 'number') {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
    }
  }
}

class Room {
  constructor(size, maxPlayers, ...players) {
    this.size = size;
    this.maxPlayers = maxPlayers;
    this.players = players ? players : [];
    this.bots = [];
    this.walls = [];
    this.powerups = [];
    this.spawnpoints = [];
  }
}

class Player {
  constructor(id, roomId) {
    this.x = 350;
    this.y = 250;
    this.vector = [1, 0];
    this.size = 10;
    this.id = id;
    this.bullets = [];
    this.vulnerable = false;
    this.roomId = roomId;
    this.isBot = false;
    this.health = 3;
    this.accelerated = false;
    this.canShoot = true;
    this.isShooting = false;
    this.bdeg = 10 / 57;

    // upgradable
    this.speed = 1;
    this.maxHealth = 3;
    this.gunCount = 1;
    this.shieldTime = 5000;
    this.shootInterval = 500;
    this.bulletSpeed = 20;

    this.points = 0;
    this.exp = 0;
  }
  getSpeed() {
    return this.accelerated ? this.speed * 4 : this.speed;
  };
  shoot() {
    if (!this.canShoot)
      return;
    this.canShoot = false;
    setTimeout(() => {
      this.canShoot = true;
      if (this.isShooting)
        this.shoot();
    }, this.shootInterval);
    let vec = [0, 0];
    switch (this.gunCount) {
      case 1:
        this.bullets.push({
          x: this.x,
          y: this.y,
          vector: [this.vector[0], this.vector[1]]
        });
        return;
      case 2:
      case 3:
      case 4:
        let t = this.gunCount;
        let iniDeg = -((this.gunCount - 1) * this.bdeg) / 2;
        while (t > 0) {
          this.bullets.push({
            x: this.x,
            y: this.y,
            vector: _vector.rotate([this.vector[0], this.vector[1]], iniDeg)
          });
          iniDeg += this.bdeg;
          t--;
        }
        break;

      case 5:
      case 6:
        let i = -1;
        while (i < 2)
          this.bullets.push({
            x: this.x,
            y: this.y,
            vector: _vector.rotate([this.vector[0], this.vector[1]], this.bdeg * (i++))
          });
        if (this.gunCount > 5) {
          this.bullets.push(
            {
              x: this.x, y: this.y,
              vector: _vector.rotate([this.vector[0], this.vector[1]], Math.PI - this.bdeg / 2)
            },
            {
              x: this.x, y: this.y,
              vector: _vector.rotate([this.vector[0], this.vector[1]], Math.PI + this.bdeg / 2)
            },
          );
        } else {
          this.bullets.push(
            {
              x: this.x, y: this.y,
              vector: _vector.rotate([this.vector[0], this.vector[1]], Math.PI)
            }
          );
        }
        break;

      default:
        break;
    }
  }
  reset() {
    this.speed = 1;
    this.maxHealth = 3;
    this.gunCount = 1;
    this.shieldTime = 5000;
    this.shootInterval = 500;
    this.bulletSpeed = 10;

    // this.points = 0;
  }
};

class Bot extends Player {
  constructor(id, roomId) {
    super(id, roomId);
    // this.vector = [0, 1];
    this.vulnerable = true;
    this.nickname = 'bot';
    this.target = null;
    // this.isTergetting = true;
    this.isBot = true;
  }
}

class Powerup {
  constructor(x, y, type) {
    this.type = type;
    this.x = x;
    this.y = y;
  }
}

module.exports = { Player, Bot, Wall, Powerup, Room }
