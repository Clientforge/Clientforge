import { useEffect, useState } from 'react';
import { BRAND } from './constants';
import { GALLERY_ITEMS } from './content/gallery';

export default function FebesGallery() {
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    document.title = `Gallery — ${BRAND}`;
  }, []);

  return (
    <div className="febe-section">
      <h1 className="febe-page-title">Gallery</h1>
      <p className="febe-section-lead">Before-and-after moments and styles from our chair — your next look starts here.</p>
      <div className="febe-gallery-grid">
        {GALLERY_ITEMS.map((item) => (
          <button
            key={item.image}
            type="button"
            className="febe-gallery-item"
            onClick={() => setLightbox(item)}
          >
            <img src={item.image} alt={item.title} loading="lazy" />
            <span className="febe-gallery-caption">
              {item.tag} · {item.title}
            </span>
          </button>
        ))}
      </div>
      {lightbox ? (
        <div
          role="dialog"
          aria-modal
          aria-label={lightbox.title}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setLightbox(null)}
          onKeyDown={(e) => e.key === 'Escape' && setLightbox(null)}
        >
          <img
            src={lightbox.image.replace('w=800', 'w=1200')}
            alt={lightbox.title}
            style={{ maxHeight: '90vh', maxWidth: '100%', borderRadius: '12px' }}
          />
        </div>
      ) : null}
    </div>
  );
}
