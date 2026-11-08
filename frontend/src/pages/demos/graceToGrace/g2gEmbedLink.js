import { g2gPath } from './g2gBase';

/** Path + optional ?embed=1 for in-frame navigation. */
export function g2gLinkPath(segment, embedSearch) {
  const base = segment ? g2gPath(segment) : g2gPath();
  if (!embedSearch) return base;
  return `${base}${embedSearch}`;
}
