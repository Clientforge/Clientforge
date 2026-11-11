/**
 * Parent origins allowed to embed Cash4JunkCar (G2G) in an iframe (CSP frame-ancestors).
 * Comma-separated in G2G_FRAME_ANCESTORS.
 * Examples:
 *   https://example.com,https://www.example.com
 *   https://*.gracetograce-cash4cars.pages.dev
 */
function parseG2gFrameAncestors() {
  const raw = (process.env.G2G_FRAME_ANCESTORS || '').trim();
  if (!raw) return [];

  const out = [];
  for (const part of raw.split(',')) {
    const token = part.trim();
    if (!token) continue;
    const normalized = normalizeFrameAncestorToken(token);
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }
  return out;
}

/**
 * @returns {string|null} CSP frame-ancestors source ('self' handled separately)
 */
function normalizeFrameAncestorToken(token) {
  const t = token.trim();
  if (!t) return null;

  if (t.includes('*')) {
    const schemeMatch = t.match(/^(https?):\/\/(.+)$/i);
    if (!schemeMatch) return null;
    const scheme = schemeMatch[1].toLowerCase();
    const hostPattern = schemeMatch[2].trim();
    if (scheme !== 'http' && scheme !== 'https') return null;
    if (!/^(\*\.)?[\w.*-]+$/i.test(hostPattern)) return null;
    return `${scheme}://${hostPattern}`;
  }

  try {
    const url = new URL(t.includes('://') ? t : `https://${t}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** CSP frame-ancestors value: 'self' plus any configured parent sites. */
function g2gFrameAncestorsDirective() {
  const extra = parseG2gFrameAncestors();
  if (extra.length === 0) return "'self'";
  return `'self' ${extra.join(' ')}`;
}

module.exports = {
  parseG2gFrameAncestors,
  normalizeFrameAncestorToken,
  g2gFrameAncestorsDirective,
};
