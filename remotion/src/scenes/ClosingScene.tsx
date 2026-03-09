import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { Logo } from '../components/Logo';
import { SceneTransition } from '../components/SceneTransition';
import { SceneLottie } from '../components/SceneLottie';
import { BRAND } from '../theme';

export const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();

  const headlineOpacity = interpolate(frame, [10, 35], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const logoOpacity = interpolate(frame, [40, 70], [0, 1], { extrapolateRight: 'clamp' });
  const ctaOpacity = interpolate(frame, [70, 100], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <SceneTransition transitionFrames={25} type="scale">
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: BRAND.gradientDark,
          fontFamily: 'Inter, system-ui, sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: interpolate(frame, [5, 35], [0, 1], { extrapolateRight: 'clamp' }),
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <SceneLottie scene="closing" width={300} height={300} playbackRate={0.5} />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <h2
          style={{
            fontSize: 42,
            fontWeight: 800,
            color: '#ffffff',
            textAlign: 'center',
            margin: 0,
            opacity: headlineOpacity,
            letterSpacing: '-0.02em',
            lineHeight: 1.3,
            maxWidth: 520,
            padding: '0 32px',
          }}
        >
          Stop losing clients.
          <br />
          <span
            style={{
              background: BRAND.gradientText,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Start nurturing them.
          </span>
        </h2>
        <div
          style={{
            marginTop: 40,
            opacity: logoOpacity,
          }}
        >
          <Logo size={72} variant="light" />
        </div>
        <div
          style={{
            marginTop: 32,
            opacity: ctaOpacity,
          }}
        >
          <div
            style={{
              padding: '20px 48px',
              background: BRAND.gradientText,
              color: '#ffffff',
              fontSize: 24,
              fontWeight: 700,
              borderRadius: 14,
              boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
            }}
          >
            Start Free Trial
          </div>
        </div>
        <p
          style={{
            fontSize: 18,
            color: '#94a3b8',
            marginTop: 24,
            opacity: interpolate(frame, [90, 115], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          clientforge.ai
        </p>
      </div>
    </SceneTransition>
  );
};
