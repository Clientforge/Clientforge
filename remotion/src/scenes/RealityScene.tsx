import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { SceneTransition } from '../components/SceneTransition';
import { AnimatedText } from '../components/AnimatedText';
import { SceneImage } from '../components/SceneImage';
import { FloatingBackground } from '../components/FloatingBackground';
import { BRAND } from '../theme';

export const RealityScene: React.FC = () => {
  const frame = useCurrentFrame();

  const iconOpacity = (i: number) =>
    interpolate(frame, [15 + i * 12, 40 + i * 12], [0, 1], { extrapolateRight: 'clamp' });

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
          padding: 48,
          position: 'relative',
        }}
      >
        <FloatingBackground color={BRAND.primary} />
        <div
          style={{
            marginBottom: 36,
            opacity: interpolate(frame, [5, 25], [0, 1], { extrapolateRight: 'clamp' }),
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <SceneImage src="worried-expression-character.png" width={380} height={380} />
        </div>
        <div
          style={{
            display: 'flex',
            gap: 24,
            marginBottom: 32,
            justifyContent: 'center',
          }}
        >
          {['📧', '⏰', '👋'].map((emoji, i) => (
            <span key={i} style={{ fontSize: 48, opacity: iconOpacity(i) }}>
              {emoji}
            </span>
          ))}
        </div>
        <h2
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: '#0f172a',
            textAlign: 'center',
            margin: 0,
            lineHeight: 1.35,
            padding: '0 32px',
            maxWidth: 520,
          }}
        >
          <AnimatedText delay={50} duration={30}>
            You're busy. Follow-ups slip.
          </AnimatedText>{' '}
          <AnimatedText delay={70} duration={30}>
            Clients drift away.
          </AnimatedText>
        </h2>
      </div>
    </SceneTransition>
  );
};
