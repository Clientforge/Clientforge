/**
 * Hostnames that serve Grace to Grace at the site root (e.g. www.cash4junkcar.net).
 * Comma-separated in G2G_PUBLIC_HOSTS; defaults include cash4junkcar.net + www.
 */
function parseG2gPublicHosts() {
  const raw = (process.env.G2G_PUBLIC_HOSTS || 'www.cash4junkcar.net,cash4junkcar.net').trim();
  return raw
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

const G2G_PUBLIC_HOSTS = parseG2gPublicHosts();

function normalizeHostname(hostname) {
  return String(hostname || '').trim().toLowerCase().split(':')[0];
}

function isG2gPublicHost(hostname) {
  const host = normalizeHostname(hostname);
  if (!host) return false;
  return G2G_PUBLIC_HOSTS.includes(host);
}

function g2gCanonicalOrigin() {
  const explicit = (process.env.G2G_CANONICAL_ORIGIN || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const www = G2G_PUBLIC_HOSTS.find((h) => h.startsWith('www.'));
  if (www) return `https://${www}`;
  if (G2G_PUBLIC_HOSTS[0]) return `https://${G2G_PUBLIC_HOSTS[0]}`;
  return '';
}

module.exports = {
  G2G_PUBLIC_HOSTS,
  isG2gPublicHost,
  g2gCanonicalOrigin,
};
