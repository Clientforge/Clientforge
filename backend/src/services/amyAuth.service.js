const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

const signAmyToken = () =>
  jwt.sign({ kind: 'amy_app' }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

const timingSafeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

const login = async ({ username, password }) => {
  const expectedUser = process.env.AMY_APP_USERNAME;
  const expectedPass = process.env.AMY_APP_PASSWORD;

  if (!expectedUser || !expectedPass) {
    const err = new Error('AMY app login is not configured');
    err.statusCode = 503;
    err.isOperational = true;
    throw err;
  }

  if (!username || !password) {
    const err = new Error('Missing required fields: username, password');
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  const u = String(username).trim();
  if (!timingSafeEqual(u, expectedUser) || !timingSafeEqual(password, expectedPass)) {
    const err = new Error('Invalid username or password');
    err.statusCode = 401;
    err.isOperational = true;
    throw err;
  }

  return { token: signAmyToken(), username: expectedUser };
};

module.exports = { login };
