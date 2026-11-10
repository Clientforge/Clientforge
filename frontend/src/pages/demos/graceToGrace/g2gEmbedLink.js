import { g2gPath } from './g2gBase';

function mergeSearch(base, embedSearch, extraQuery) {
  const params = new URLSearchParams();
  if (embedSearch) {
    new URLSearchParams(embedSearch.replace(/^\?/, '')).forEach((v, k) => params.set(k, v));
  }
  if (typeof extraQuery === 'string' && extraQuery.trim()) {
    new URLSearchParams(extraQuery.trim().replace(/^\?/, '')).forEach((v, k) => params.set(k, v));
  } else if (extraQuery && typeof extraQuery === 'object') {
    for (const [k, v] of Object.entries(extraQuery)) {
      if (v != null && String(v) !== '') params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Path + optional ?embed=1 and extra query params. */
export function g2gLinkPath(segment, embedSearch, extraQuery) {
  const base = segment ? g2gPath(segment) : g2gPath();
  return mergeSearch(base, embedSearch, extraQuery);
}

/** Multi-segment path (e.g. cash-for-junk-cars / city slug) with embed query. */
export function g2gLinkPathSegments(embedSearch, ...segments) {
  const clean = segments.filter((s) => s != null && s !== '');
  const base = clean.length ? g2gPath(...clean) : g2gPath();
  return mergeSearch(base, embedSearch, undefined);
}
