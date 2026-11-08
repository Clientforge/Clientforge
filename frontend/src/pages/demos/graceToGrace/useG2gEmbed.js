import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useG2gEmbed() {
  const [searchParams] = useSearchParams();

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
      const height = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight || 0,
      );
      window.parent.postMessage({ type: 'g2g-embed-resize', height }, '*');
    };
    postHeight();
    const ro = new ResizeObserver(() => postHeight());
    ro.observe(document.documentElement);
    window.addEventListener('resize', postHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', postHeight);
    };
  }, [inIframe]);

  return { embedded, embedSearch, inIframe };
}
