'use strict';

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
    this.speed = 1;
    this.size = 10;
    this.id = id;
    this.bullets = [];
    this.vulnerable = false;
    this.health = 3;
    this.roomId = roomId;
    this.isBot = false;
  }
  shoot() {
    this.bullets.push({
      x: this.x,
      y: this.y,
      vector: [this.vector[0], this.vector[1]]
    });
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
