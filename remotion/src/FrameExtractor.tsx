import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion';

export const FrameExtractor: React.FC<{ sourceFrame: number }> = ({ sourceFrame }) => (
  <AbsoluteFill>
    <OffthreadVideo
      src={staticFile('Medspa.mp4')}
      trimBefore={sourceFrame}
      trimAfter={sourceFrame + 1}
      muted
      style={{ objectFit: 'cover', width: '100%', height: '100%' }}
    />
  </AbsoluteFill>
);
