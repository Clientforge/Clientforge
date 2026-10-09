#!/usr/bin/env node
/**
 * Generate RSA key pair for eCW Backend Services (RS384).
 * Prints ECW_JWKS_KID and instructions; writes PEM files only if OUT_DIR is set.
 *
 * Usage:
 *   node scripts/generateEcwJwksKey.js
 *   OUT_DIR=/tmp/ecw-keys node scripts/generateEcwJwksKey.js
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const kid = `clientforge-ecw-${new Date().getFullYear()}`;
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const outDir = process.env.OUT_DIR;
if (outDir) {
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ecw-private.pem'), privateKey, { mode: 0o600 });
  fs.writeFileSync(path.join(dir, 'ecw-public.pem'), publicKey);
  console.log(`Wrote ${dir}/ecw-private.pem and ecw-public.pem`);
}

console.log('\nAdd to Render (or .env):\n');
console.log(`ECW_JWKS_KID=${kid}`);
console.log('ECW_JWT_ALG=RS384');
console.log('ECW_PRIVATE_KEY="(paste private PEM; use \\n for newlines in Render)"');
console.log('\nAfter deploy, register in eCW portal:');
console.log('  https://app.clientforge-ai.com/api/v1/public/ecw-jwks');
console.log('(or set ECW_JWKS_URL if you use a custom path)\n');

if (!outDir) {
  console.log('Private key (save locally, do not commit):\n');
  console.log(privateKey);
}
