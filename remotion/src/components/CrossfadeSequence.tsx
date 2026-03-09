import React from 'react';
import { Sequence, useCurrentFrame, interpolate, Easing } from 'remotion';

export const CrossfadeSequence: React.FC<{
  from: number;
  durationInFrames: number;
  children: React.ReactNode;
  fadeOutFrames?: number;
}> = ({ from, durationInFrames, children, fadeOutFrames = 20 }) => {
  return (
    <Sequence from={from} durationInFrames={durationInFrames}>
      <CrossfadeWrapper durationInFrames={durationInFrames} fadeOutFrames={fadeOutFrames}>
        {children}
      </CrossfadeWrapper>
    </Sequence>
  );
};

const CrossfadeWrapper: React.FC<{
  durationInFrames: number;
  fadeOutFrames: number;
  children: React.ReactNode;
}> = ({ durationInFrames, fadeOutFrames, children }) => {
  const frame = useCurrentFrame();
  const fadeOutStart = durationInFrames - fadeOutFrames;
  const opacity = interpolate(
    frame,
    [fadeOutStart, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) }
  );
  return (
    <div style={{ opacity: frame >= fadeOutStart ? opacity : 1 }}>
      {children}
    </div>
  );
};
