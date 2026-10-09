const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_ALG = 'RS384';

function normalizePem(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes('\\n')) {
    return trimmed.replace(/\\n/g, '\n');
  }
  return trimmed;
}

function getPrivateKeyPem() {
  const raw = process.env.ECW_PRIVATE_KEY || process.env.ECW_JWT_PRIVATE_KEY || '';
  const fromPem = normalizePem(raw);
  if (fromPem) return fromPem;

  const b64 = (process.env.ECW_PRIVATE_KEY_B64 || '').trim();
  if (b64) {
    return Buffer.from(b64, 'base64').toString('utf8');
  }
  return null;
}

function getPublicKeyPem() {
  const explicit = normalizePem(process.env.ECW_PUBLIC_KEY || '');
  if (explicit) return explicit;
  const privatePem = getPrivateKeyPem();
  if (!privatePem) return null;
  const keyObject = crypto.createPrivateKey(privatePem);
  return crypto.createPublicKey(keyObject).export({ type: 'spki', format: 'pem' });
}

function signingAlg() {
  return (process.env.ECW_JWT_ALG || DEFAULT_ALG).trim() || DEFAULT_ALG;
}

function keyId() {
  return (process.env.ECW_JWKS_KID || 'clientforge-ecw-1').trim();
}

function jwksPublicUrl() {
  const explicit = (process.env.ECW_JWKS_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const base = (process.env.BASE_URL || '').trim().replace(/\/$/, '');
  if (!base) return null;
  return `${base}/.well-known/ecw-jwks.json`;
}

function buildJwksDocument() {
  const publicPem = getPublicKeyPem();
  if (!publicPem) {
    return null;
  }
  const keyObject = crypto.createPublicKey(publicPem);
  const jwk = keyObject.export({ format: 'jwk' });
  const alg = signingAlg();
  return {
    keys: [
      {
        kty: jwk.kty,
        kid: keyId(),
        use: 'sig',
        alg,
        n: jwk.n,
        e: jwk.e,
      },
    ],
  };
}

function isJwksConfigured() {
  return !!getPrivateKeyPem();
}

/**
 * One-time client_assertion JWT for eCW Backend Services (client_credentials).
 */
function signClientAssertion({ clientId, tokenUrl }) {
  const privatePem = getPrivateKeyPem();
  if (!privatePem) {
    throw Object.assign(new Error('ECW_PRIVATE_KEY is not configured'), { statusCode: 503 });
  }
  if (!clientId) {
    throw Object.assign(new Error('ECW_CLIENT_ID is not configured'), { statusCode: 503 });
  }
  const aud = (tokenUrl || '').trim();
  if (!aud) {
    throw Object.assign(new Error('eCW token URL is required'), { statusCode: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientId,
    sub: clientId,
    aud,
    exp: now + 300,
    iat: now,
    jti: uuidv4(),
  };

  const jku = jwksPublicUrl();
  const header = {
    alg: signingAlg(),
    kid: keyId(),
    typ: 'JWT',
    ...(jku ? { jku } : {}),
  };

  return jwt.sign(payload, privatePem, { algorithm: signingAlg(), header });
}

module.exports = {
  buildJwksDocument,
  getPrivateKeyPem,
  isJwksConfigured,
  jwksPublicUrl,
  keyId,
  signClientAssertion,
  signingAlg,
};
