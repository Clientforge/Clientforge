const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const config = require('../config');

const SALT_ROUNDS = 12;

/**
 * Generate an access token (short-lived) and refresh token (long-lived).
 */
const generateTokens = (user) => {
  const payload = {
    userId: user.id,
    tenantId: user.tenant_id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn },
  );

  return { accessToken, refreshToken };
};

/**
 * Register a new tenant and its first admin user.
 * This is a single atomic transaction — both are created or neither is.
 */
const registerTenant = async ({ businessName, industry, email, password, firstName, lastName }) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // 1. Check if email already exists
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()],
    );

    if (existing.rows.length > 0) {
      throw Object.assign(new Error('An account with this email already exists'), {
        statusCode: 409,
        isOperational: true,
      });
    }

    // 2. Create tenant
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, industry)
       VALUES ($1, $2)
       RETURNING id, name, industry, timezone, plan, created_at`,
      [businessName, industry || null],
    );
    const tenant = tenantResult.rows[0];

    // 3. Hash password and create user
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const userResult = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, 'admin')
       RETURNING id, tenant_id, email, first_name, last_name, role, created_at`,
      [tenant.id, email.toLowerCase(), passwordHash, firstName || null, lastName || null],
    );
    const user = userResult.rows[0];

    await client.query('COMMIT');

    const tokens = generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        industry: tenant.industry,
        plan: tenant.plan,
      },
      ...tokens,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Authenticate a user by email and password. Returns tokens + user info.
 */
const login = async ({ email, password }) => {
  const result = await db.query(
    `SELECT u.id, u.tenant_id, u.email, u.password_hash, u.first_name, u.last_name, u.role, u.active,
            t.name as tenant_name, t.plan as tenant_plan, t.active as tenant_active
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.email = $1`,
    [email.toLowerCase()],
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Invalid email or password'), {
      statusCode: 401,
      isOperational: true,
    });
  }

  const user = result.rows[0];

  if (!user.active) {
    throw Object.assign(new Error('Account is deactivated'), {
      statusCode: 403,
      isOperational: true,
    });
  }

  if (!user.tenant_active) {
    throw Object.assign(new Error('Organization account is deactivated'), {
      statusCode: 403,
      isOperational: true,
    });
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    throw Object.assign(new Error('Invalid email or password'), {
      statusCode: 401,
      isOperational: true,
    });
  }

  // Update last login
  await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  const tokens = generateTokens(user);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
    },
    tenant: {
      id: user.tenant_id,
      name: user.tenant_name,
      plan: user.tenant_plan,
    },
    ...tokens,
  };
};

/**
 * Refresh an access token using a valid refresh token.
 */
const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, config.jwt.secret);

    if (decoded.type !== 'refresh') {
      throw new Error('Not a refresh token');
    }

    // Verify user still exists and is active
    const result = await db.query(
      'SELECT id, tenant_id, email, role, active FROM users WHERE id = $1',
      [decoded.userId],
    );

    if (result.rows.length === 0 || !result.rows[0].active) {
      throw new Error('User not found or deactivated');
    }

    const user = result.rows[0];
    const tokens = generateTokens(user);

    return tokens;
  } catch (err) {
    throw Object.assign(new Error('Invalid or expired refresh token'), {
      statusCode: 401,
      isOperational: true,
    });
  }
};

/**
 * Get the current user's profile (from token data + fresh DB lookup).
 */
const getProfile = async (userId) => {
  const result = await db.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.created_at,
            t.id as tenant_id, t.name as tenant_name, t.industry, t.plan,
            t.phone_number, t.booking_link, t.timezone
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = $1`,
    [userId],
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('User not found'), {
      statusCode: 404,
      isOperational: true,
    });
  }

  const row = result.rows[0];

  return {
    user: {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      createdAt: row.created_at,
    },
    tenant: {
      id: row.tenant_id,
      name: row.tenant_name,
      industry: row.industry,
      plan: row.plan,
      phoneNumber: row.phone_number,
      bookingLink: row.booking_link,
      timezone: row.timezone,
    },
  };
};

module.exports = {
  registerTenant,
  login,
  refreshAccessToken,
  getProfile,
};
