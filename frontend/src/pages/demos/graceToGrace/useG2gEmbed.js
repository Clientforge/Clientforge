import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

const EMBED_RESIZE_PAD_PX = 8;

function measureEmbedContentHeight() {
  const main = document.querySelector('.g2g-demo-root .g2g-main');
  const el = main || document.querySelector('.g2g-demo-root');
  if (!el) return 0;
  const rect = el.getBoundingClientRect();
  return Math.ceil(rect.height) + EMBED_RESIZE_PAD_PX;
}

export function useG2gEmbed() {
  const [searchParams] = useSearchParams();
  const lastHeightRef = useRef(0);

  const queryEmbed = searchParams.get('embed') === '1' || searchParams.get('embed') === 'true';
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;
  const embedded = queryEmbed || inIframe;

  const embedSearch = useMemo(() => {
    if (!embedded) return '';
    return '?embed=1';
  }, [embedded]);

  useEffect(() => {
    if (!inIframe) return undefined;

    const postHeight = () => {
      const height = measureEmbedContentHeight();
      if (height < 1) return;
      if (height === lastHeightRef.current) return;
      lastHeightRef.current = height;
      window.parent.postMessage({ type: 'g2g-embed-resize', height }, '*');
    };

    postHeight();

    const observeEl = document.querySelector('.g2g-demo-root .g2g-main')
      || document.querySelector('.g2g-demo-root')
      || document.documentElement;

    const ro = new ResizeObserver(() => postHeight());
    ro.observe(observeEl);

    const mo = new MutationObserver(() => postHeight());
    mo.observe(document.querySelector('.g2g-demo-root') || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    window.addEventListener('resize', postHeight);

    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', postHeight);
    };
  }, [inIframe]);

  return { embedded, embedSearch, inIframe };
}
