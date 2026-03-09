import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { BRAND } from './theme';
import { MedSpaScene1 } from './scenes/medspa/MedSpaScene1';
import { MedSpaScene2 } from './scenes/medspa/MedSpaScene2';
import { MedSpaScene3 } from './scenes/medspa/MedSpaScene3';
import { MedSpaScene4 } from './scenes/medspa/MedSpaScene4';
import { MedSpaScene5 } from './scenes/medspa/MedSpaScene5';
import { MedSpaScene6 } from './scenes/medspa/MedSpaScene6';
import { MedSpaScene7 } from './scenes/medspa/MedSpaScene7';
import { MedSpaScene8 } from './scenes/medspa/MedSpaScene8';

const FPS = 30;

// 8 scenes, 30 seconds total (matching MedSpa script timing)
const S1 = 4 * FPS;   // 0-4s
const S2 = 3 * FPS;   // 4-7s
const S3 = 3 * FPS;   // 7-10s
const S4 = 4 * FPS;   // 10-14s
const S5 = 4 * FPS;   // 14-18s
const S6 = 4 * FPS;   // 18-22s
const S7 = 4 * FPS;   // 22-26s
const S8 = 4 * FPS;   // 26-30s

export const MedSpaExplainer: React.FC = () => {
  let t = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.bg }}>
      <Sequence from={t} durationInFrames={S1}>
        <MedSpaScene1 />
      </Sequence>
      <Sequence from={(t += S1)} durationInFrames={S2}>
        <MedSpaScene2 />
      </Sequence>
      <Sequence from={(t += S2)} durationInFrames={S3}>
        <MedSpaScene3 />
      </Sequence>
      <Sequence from={(t += S3)} durationInFrames={S4}>
        <MedSpaScene4 />
      </Sequence>
      <Sequence from={(t += S4)} durationInFrames={S5}>
        <MedSpaScene5 />
      </Sequence>
      <Sequence from={(t += S5)} durationInFrames={S6}>
        <MedSpaScene6 />
      </Sequence>
      <Sequence from={(t += S6)} durationInFrames={S7}>
        <MedSpaScene7 />
      </Sequence>
      <Sequence from={(t += S7)} durationInFrames={S8}>
        <MedSpaScene8 />
      </Sequence>
    </AbsoluteFill>
  );
};
