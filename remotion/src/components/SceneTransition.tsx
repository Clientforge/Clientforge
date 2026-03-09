import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

export const SceneTransition: React.FC<{
  children: React.ReactNode;
  transitionFrames?: number;
  type?: 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'scale';
}> = ({ children, transitionFrames = 25, type = 'fade' }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [0, transitionFrames],
    [0, 1],
    { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) }
  );

  const slideAmount = 40;
  const translateY =
    type === 'slide-up'
      ? interpolate(frame, [0, transitionFrames], [slideAmount, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
      : type === 'slide-down'
        ? interpolate(frame, [0, transitionFrames], [-slideAmount, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
        : 0;

  const translateX =
    type === 'slide-left'
      ? interpolate(frame, [0, transitionFrames], [slideAmount, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
      : type === 'slide-right'
        ? interpolate(frame, [0, transitionFrames], [-slideAmount, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
        : 0;

  const scale =
    type === 'scale'
      ? interpolate(frame, [0, transitionFrames], [0.92, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
      : 1;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        opacity,
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
      }}
    >
      {children}
    </div>
  );
};
