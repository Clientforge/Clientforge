import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, interpolate } from 'remotion';

export const MedSpaVideoScene: React.FC<{
  trimBefore: number;
  trimAfter: number;
  children: React.ReactNode;
}> = ({ trimBefore, trimAfter, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={staticFile('Medspa.mp4')}
        trimBefore={trimBefore}
        trimAfter={trimAfter}
        muted
        style={{ objectFit: 'cover', width: '100%', height: '100%' }}
      />
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 100%)',
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
