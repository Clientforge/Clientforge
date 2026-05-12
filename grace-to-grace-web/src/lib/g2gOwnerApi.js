import { API_PUBLIC_BASE } from '../constants.js';

function apiV1Base() {
  const base = API_PUBLIC_BASE.replace(/\/$/, '');
  if (base) return `${base}/api/v1`;
  return '/api/v1';
}

const TOKEN_KEY = 'g2g_owner_token';

export function getG2gOwnerToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setG2gOwnerToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function clearG2gOwnerToken() {
  setG2gOwnerToken(null);
}

export async function g2gOwnerLogin({ username, password }) {
  const res = await fetch(`${apiV1Base()}/g2g-owner/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Login failed (${res.status})`);
  }
  return data;
}

export async function g2gOwnerMe() {
  const token = getG2gOwnerToken();
  if (!token) {
    throw new Error('Not signed in');
  }
  const res = await fetch(`${apiV1Base()}/g2g-owner/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
