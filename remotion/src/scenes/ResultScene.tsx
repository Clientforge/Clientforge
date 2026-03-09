import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { SceneTransition } from '../components/SceneTransition';
import { AnimatedText } from '../components/AnimatedText';
import { SceneLottie } from '../components/SceneLottie';
import { SceneImage } from '../components/SceneImage';
import { FloatingBackground } from '../components/FloatingBackground';
import { BRAND } from '../theme';

const stats = [
  { label: 'Leads', value: '1,248', icon: '👥' },
  { label: 'Coming back', value: '312', icon: '🔄' },
];

export const ResultScene: React.FC = () => {
  const frame = useCurrentFrame();

  const cardOpacity = (i: number) =>
    interpolate(
      frame,
      [20 + i * 15, 50 + i * 15],
      [0, 1],
      { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }
    );

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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            opacity: interpolate(frame, [5, 30], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          <SceneLottie scene="result" width={320} height={320} playbackRate={0.6} />
          <SceneImage src="person-buys-online.png" width={200} height={200} />
        </div>
        <div
          style={{
            display: 'flex',
            gap: 28,
            marginBottom: 32,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          {stats.map((s, i) => (
            <div
              key={i}
              style={{
                padding: 28,
                background: '#ffffff',
                borderRadius: 16,
                border: `1px solid ${BRAND.cardBorderStrong}`,
                minWidth: 140,
                opacity: cardOpacity(i),
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>{s.icon}</div>
              <p style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 16, color: BRAND.accentText, fontWeight: 600, margin: '8px 0 0 0' }}>
                {s.label}
              </p>
            </div>
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
          <AnimatedText delay={70} duration={35}>
            You focus on your business.
          </AnimatedText>{' '}
          <AnimatedText delay={90} duration={35}>
            <span
              style={{
                background: BRAND.gradientText,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              We bring them back.
            </span>
          </AnimatedText>
        </h2>
      </div>
    </SceneTransition>
  );
};
