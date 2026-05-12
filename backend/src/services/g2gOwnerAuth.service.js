const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const config = require('../config');

const SALT_ROUNDS = 12;

const throwInvalidCreds = () => {
  const err = new Error('Invalid username or password');
  err.statusCode = 401;
  err.isOperational = true;
  throw err;
};

const signOwnerToken = (owner) =>
  jwt.sign(
    {
      kind: 'g2g_owner',
      ownerId: owner.id,
      username: owner.username,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );

const login = async ({ username, password }) => {
  if (!username || !password) {
    const err = new Error('Missing required fields: username, password');
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  const u = String(username).trim().toLowerCase();
  const result = await db.query(
    `SELECT id, username, password_hash, active FROM g2g_owner_accounts WHERE username = $1`,
    [u],
  );

  if (result.rows.length === 0) throwInvalidCreds();

  const row = result.rows[0];
  if (!row.active) throwInvalidCreds();

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) throwInvalidCreds();

  await db.query(
    `UPDATE g2g_owner_accounts SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [row.id],
  );

  const token = signOwnerToken({ id: row.id, username: row.username });

  return {
    token,
    owner: { id: row.id, username: row.username },
  };
};

const getProfile = async (ownerId) => {
  const result = await db.query(
    `SELECT id, username, last_login_at, created_at
     FROM g2g_owner_accounts
     WHERE id = $1 AND active = true`,
    [ownerId],
  );

  if (result.rows.length === 0) {
    const err = new Error('Owner not found');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  return result.rows[0];
};

module.exports = {
  login,
  getProfile,
  SALT_ROUNDS,
};
