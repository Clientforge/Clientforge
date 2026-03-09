import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from 'remotion';

export const MedSpaImageScene: React.FC<{
  src: string;
  children: React.ReactNode;
}> = ({ src, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <Img
        src={staticFile(src)}
        style={{
          objectFit: 'cover',
          width: '100%',
          height: '100%',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 100%)',
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: 48,
          paddingBottom: 80,
          opacity,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
