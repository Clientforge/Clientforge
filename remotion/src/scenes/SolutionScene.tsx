import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { SceneTransition } from '../components/SceneTransition';
import { AnimatedText } from '../components/AnimatedText';
import { FloatingBackground } from '../components/FloatingBackground';
import { SceneLottie } from '../components/SceneLottie';
import { SceneImage } from '../components/SceneImage';
import { BRAND } from '../theme';

export const SolutionScene: React.FC = () => {
  const frame = useCurrentFrame();

  const cardOpacity = (i: number) =>
    interpolate(
      frame,
      [15 + i * 18, 45 + i * 18],
      [0, 1],
      { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }
    );
  const cardY = (i: number) =>
    interpolate(
      frame,
      [15 + i * 18, 45 + i * 18],
      [20, 0],
      { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }
    );

  const features = [
    { icon: '📧', label: 'Follow-up emails' },
    { icon: '⚡', label: 'Automated' },
    { icon: '🔄', label: 'Nurture chains' },
  ];

  return (
    <SceneTransition transitionFrames={25} type="slide-up">
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: BRAND.gradientAccent,
          fontFamily: 'Inter, system-ui, sans-serif',
          position: 'relative',
        }}
      >
        <FloatingBackground color={BRAND.primary} />
        <div
          style={{
            marginBottom: 32,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 20,
            opacity: interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          <SceneLottie scene="solution" width={320} height={320} playbackRate={0.6} />
          <SceneImage
            src="business-book.png"
            width={120}
            height={120}
          />
        </div>
        <div
          style={{
            display: 'flex',
            gap: 20,
            marginBottom: 36,
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                width: 130,
                padding: 24,
                background: '#ffffff',
                borderRadius: 16,
                border: '1px solid #e5e7eb',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                opacity: cardOpacity(i),
                transform: `translateY(${cardY(i)}px)`,
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>{f.icon}</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', margin: 0 }}>{f.label}</p>
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
          <AnimatedText delay={75} duration={35}>
            ClientForge handles the follow-up
          </AnimatedText>{' '}
          <AnimatedText delay={95} duration={35}>
            <span
              style={{
                background: BRAND.gradientText,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              — automatically.
            </span>
          </AnimatedText>
        </h2>
      </div>
    </SceneTransition>
  );
};
