import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { SceneTransition } from '../components/SceneTransition';
import { AnimatedText } from '../components/AnimatedText';
import { SceneImage } from '../components/SceneImage';
import { FloatingBackground } from '../components/FloatingBackground';
import { BRAND } from '../theme';

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneTransition transitionFrames={25} type="fade">
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: BRAND.gradientLight,
          fontFamily: 'Inter, system-ui, sans-serif',
          position: 'relative',
        }}
      >
        <FloatingBackground color={BRAND.primary} />
        <div
          style={{
            marginBottom: 40,
            opacity: interpolate(frame, [5, 30], [0, 1], { extrapolateRight: 'clamp' }),
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <SceneImage src="worried-expression-character.png" width={400} height={400} />
        </div>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 700,
            color: '#0f172a',
            textAlign: 'center',
            lineHeight: 1.35,
            letterSpacing: '-0.02em',
            maxWidth: 520,
            padding: '0 32px',
          }}
        >
          <AnimatedText delay={20} duration={35}>
            Every client that leaves is a client you could've kept.
          </AnimatedText>
        </h1>
      </div>
    </SceneTransition>
  );
};
