import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

export const PremiumTransition: React.FC<{
  children: React.ReactNode;
  transitionFrames?: number;
  type?: 'fade' | 'slide-up' | 'scale' | 'blur-in' | 'parallax' | 'cinematic';
}> = ({ children, transitionFrames = 30, type = 'cinematic' }) => {
  const frame = useCurrentFrame();

  const easeOut = Easing.out(Easing.cubic);
  const easeOutExpo = Easing.out(Easing.exp);

  const opacity = interpolate(
    frame,
    [0, transitionFrames * 0.6], // Faster opacity
    [0, 1],
    { extrapolateRight: 'clamp', easing: easeOut }
  );

  const translateY = type === 'slide-up' || type === 'parallax' || type === 'cinematic'
    ? interpolate(frame, [0, transitionFrames], [40, 0], { extrapolateRight: 'clamp', easing: easeOutExpo })
    : 0;

  const scale = type === 'scale' || type === 'cinematic'
    ? interpolate(frame, [0, transitionFrames], [0.96, 1], { extrapolateRight: 'clamp', easing: easeOutExpo })
    : 1;

  const blur = type === 'blur-in' || type === 'cinematic'
    ? interpolate(frame, [0, transitionFrames * 0.5], [12, 0], { extrapolateRight: 'clamp', easing: easeOut })
    : 0;

  const contentTranslateY = type === 'parallax'
    ? interpolate(frame, [0, transitionFrames], [20, 0], { extrapolateRight: 'clamp', easing: easeOut })
    : 0;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
      }}
    >
      {type === 'parallax' ? (
        <div
          style={{
            transform: `translateY(${contentTranslateY * 0.1}px)`,
          }}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
};
