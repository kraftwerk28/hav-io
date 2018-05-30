/**
 * Package contains all required vector functions used in game
 */
'use strict';

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

module.exports = { toDeg, normalize, rotate, vecLerp, dot };
