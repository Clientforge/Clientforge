import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { SceneTransition } from '../components/SceneTransition';
import { AnimatedText } from '../components/AnimatedText';
import { SceneImage } from '../components/SceneImage';
import { FloatingBackground } from '../components/FloatingBackground';
import { BRAND } from '../theme';

export const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();

  const clockOpacity = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: 'clamp' });
  const listOpacity = interpolate(frame, [35, 60], [0, 1], { extrapolateRight: 'clamp' });

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
            marginBottom: 32,
            opacity: interpolate(frame, [5, 28], [0, 1], { extrapolateRight: 'clamp' }),
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
            gap: 32,
            marginBottom: 32,
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              padding: 24,
              background: '#eef2ff',
              borderRadius: 16,
              opacity: clockOpacity,
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 44, display: 'block', marginBottom: 8 }}>⏰</span>
            <p style={{ fontSize: 18, color: BRAND.accentText, margin: 0, fontWeight: 600 }}>
              No time
            </p>
          </div>
          <div
            style={{
              padding: 24,
              background: '#eef2ff',
              borderRadius: 16,
              opacity: listOpacity,
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 44, display: 'block', marginBottom: 8 }}>📋</span>
            <p style={{ fontSize: 18, color: BRAND.accentText, margin: 0, fontWeight: 600 }}>
              No system
            </p>
          </div>
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
          <AnimatedText delay={65} duration={35}>
            But who has time to nurture everyone?
          </AnimatedText>
        </h2>
      </div>
    </SceneTransition>
  );
};
