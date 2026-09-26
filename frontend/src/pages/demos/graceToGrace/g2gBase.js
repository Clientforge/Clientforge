/** Route prefix for G2G demo links. Root build sets VITE_G2G_BASE=/ */
export const G2G_BASE = (() => {
  const raw = import.meta.env.VITE_G2G_BASE;
  if (raw === '/' || raw === '') return '';
  if (typeof raw === 'string' && raw.length > 0) return raw.replace(/\/$/, '') || '';
  return '/demo/grace-to-grace';
})();

/** Path under the app router (leading slash). */
export function g2gPath(...segments) {
  const tail = segments.filter(Boolean).join('/');
  if (!G2G_BASE && !tail) return '/';
  if (!G2G_BASE) return `/${tail}`;
  if (!tail) return G2G_BASE;
  return `${G2G_BASE}/${tail}`;
}
