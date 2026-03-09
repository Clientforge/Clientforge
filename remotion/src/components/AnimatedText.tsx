import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

export const AnimatedText: React.FC<{
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: React.CSSProperties;
  animate?: 'fade-up' | 'fade' | 'scale';
}> = ({ children, delay = 0, duration = 25, style = {}, animate = 'fade-up' }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [delay, delay + duration],
    [0, 1],
    { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }
  );

  const translateY = animate === 'fade-up'
    ? interpolate(frame, [delay, delay + duration], [24, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 0;

  const scale = animate === 'scale'
    ? interpolate(frame, [delay, delay + duration], [0.92, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 1;

  return (
    <span
      style={{
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        display: 'inline-block',
        ...style,
      }}
    >
      {children}
    </span>
  );
};
