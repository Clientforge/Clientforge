import { useEffect, useState } from 'react';
import { HERO_SLIDES } from './content/heroSlides';

const INTERVAL_MS = 5500;

export default function FebesHeroCarousel() {
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion || HERO_SLIDES.length < 2) return undefined;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  useEffect(() => {
    const next = HERO_SLIDES[(index + 1) % HERO_SLIDES.length];
    if (next?.src) {
      const img = new Image();
      img.src = next.src;
    }
  }, [index]);

  return (
    <div className="febe-hero-carousel">
      {HERO_SLIDES.map((slide, i) => (
        <div
          key={slide.id}
          className={`febe-hero-slide${i === index ? ' febe-hero-slide--active' : ''}`}
          style={{ backgroundImage: `url(${slide.src})` }}
        />
      ))}
      <div className="febe-hero-dots" role="tablist" aria-label="Hero images">
        {HERO_SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={slide.alt}
            className={`febe-hero-dot${i === index ? ' febe-hero-dot--active' : ''}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
