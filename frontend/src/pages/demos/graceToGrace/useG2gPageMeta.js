import { useEffect } from 'react';

function upsertMeta(name, content) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href) {
  if (!href) return;
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useG2gPageMeta({ title, description, canonical }) {
  useEffect(() => {
    if (title) document.title = title;
    upsertMeta('description', description);
    upsertCanonical(canonical);
  }, [title, description, canonical]);
}
