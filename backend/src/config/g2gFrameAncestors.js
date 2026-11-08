/**
 * Parent origins allowed to embed Cash4JunkCar (G2G) in an iframe (CSP frame-ancestors).
 * Comma-separated full origins in G2G_FRAME_ANCESTORS, e.g. https://example.com,https://www.example.com
 */
function parseG2gFrameAncestors() {
  const raw = (process.env.G2G_FRAME_ANCESTORS || '').trim();
  if (!raw) return [];

  const out = [];
  for (const part of raw.split(',')) {
    const token = part.trim();
    if (!token) continue;
    try {
      const url = new URL(token.includes('://') ? token : `https://${token}`);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      const origin = `${url.protocol}//${url.host}`;
      if (!out.includes(origin)) out.push(origin);
    } catch {
      // skip invalid entries
    }
  }
  return out;
}

/** CSP frame-ancestors value: 'self' plus any configured parent sites. */
function g2gFrameAncestorsDirective() {
  const extra = parseG2gFrameAncestors();
  if (extra.length === 0) return "'self'";
  return `'self' ${extra.join(' ')}`;
}

module.exports = {
  parseG2gFrameAncestors,
  g2gFrameAncestorsDirective,
};
