'use strict';

function Player(id) {
  this.x = 350;
  this.y = 250;
  this.vector = { x: 0, y: 0 };
  this.speed = 1;
  this.size = 10;
  this.id = id;
  this.bullets = [];
  this.vulnerable = false;
  this.health = 3;
  // this.kills = 0;
  // this.deaths = 0;
};

function Wall(x, y, w, h) {
  if (typeof x === 'number') {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
}

function Powerup(x, y, type) {
  this.type = type
  this.x = x;
  this.y = y;
}

// function ShieldPowerup

module.exports = { Player, Wall, Powerup }
