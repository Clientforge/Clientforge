import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { BRAND } from './theme';
import { HookScene } from './scenes/HookScene';
import { RealityScene } from './scenes/RealityScene';
import { WishScene } from './scenes/WishScene';
import { ProblemScene } from './scenes/ProblemScene';
import { SolutionScene } from './scenes/SolutionScene';
import { ResultScene } from './scenes/ResultScene';
import { ClosingScene } from './scenes/ClosingScene';

const FPS = 30;

// 7 scenes, 30 seconds total
const HOOK_DURATION = 4 * FPS;       // 4s
const REALITY_DURATION = 4 * FPS;    // 4s
const WISH_DURATION = 4 * FPS;       // 4s
const PROBLEM_DURATION = 4 * FPS;    // 4s
const SOLUTION_DURATION = 5 * FPS;   // 5s
const RESULT_DURATION = 5 * FPS;     // 5s
const CLOSING_DURATION = 4 * FPS;    // 4s

export const ClientForgeExplainer: React.FC = () => {
  const s1 = 0;
  const s2 = s1 + HOOK_DURATION;
  const s3 = s2 + REALITY_DURATION;
  const s4 = s3 + WISH_DURATION;
  const s5 = s4 + PROBLEM_DURATION;
  const s6 = s5 + SOLUTION_DURATION;
  const s7 = s6 + RESULT_DURATION;

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.bg }}>
      <Sequence from={s1} durationInFrames={HOOK_DURATION}>
        <HookScene />
      </Sequence>
      <Sequence from={s2} durationInFrames={REALITY_DURATION}>
        <RealityScene />
      </Sequence>
      <Sequence from={s3} durationInFrames={WISH_DURATION}>
        <WishScene />
      </Sequence>
      <Sequence from={s4} durationInFrames={PROBLEM_DURATION}>
        <ProblemScene />
      </Sequence>
      <Sequence from={s5} durationInFrames={SOLUTION_DURATION}>
        <SolutionScene />
      </Sequence>
      <Sequence from={s6} durationInFrames={RESULT_DURATION}>
        <ResultScene />
      </Sequence>
      <Sequence from={s7} durationInFrames={CLOSING_DURATION}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
};
