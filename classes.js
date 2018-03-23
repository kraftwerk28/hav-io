'use strict';

const randomRange = (start, end) => (
  Math.floor(Math.random() * end + start)
);
const canvas = { width: 700, height: 500 };

function Wall(x, y, w, h) {
  if (typeof x === 'number') {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
}

function Room(size, maxPlayers, ...players) {
  this.size = size;
  this.maxPlayers = maxPlayers;
  this.players = players ? players : [];
  this.walls = [];
  this.powerups = [];
  // for (let i = 0; i < 20; i++) {
  //   this.walls.push(new Wall(randomRange(0, canvas / 50), randomRange(0, canvas.height / 50), 50, 50));
  // }
}

function Player(id, roomId) {
  this.x = 350;
  this.y = 250;
  this.vector = { x: 0, y: 0 };
  this.speed = 1;
  this.size = 10;
  this.id = id;
  this.bullets = [];
  this.vulnerable = false;
  this.health = 3;
  this.roomId = roomId;
  this.collides = false;
};

function Powerup(x, y, type) {
  this.type = type
  this.x = x;
  this.y = y;
}

module.exports = { Player, Wall, Powerup, Room }
