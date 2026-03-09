import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

export const Rotating3DCard: React.FC<{
  children: React.ReactNode;
  startFrame?: number;
  duration?: number;
  style?: React.CSSProperties;
}> = ({ children, startFrame = 0, duration = 60, style = {} }) => {
  const frame = useCurrentFrame();

  const rotateY = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 360],
    { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease) }
  );

  const opacity = interpolate(
    frame,
    [startFrame, startFrame + 15],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        perspective: 1000,
        opacity,
        ...style,
      }}
    >
      <div
        style={{
          transform: `rotateY(${rotateY}deg)`,
          transformStyle: 'preserve-3d',
          backfaceVisibility: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
};
