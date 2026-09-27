export const FEBES_BASE = '/demo/febes-hair-connections';

export function febesPath(...segments) {
  const tail = segments.filter(Boolean).join('/');
  if (!tail) return FEBES_BASE;
  return `${FEBES_BASE}/${tail}`;
}
