import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { SceneTransition } from '../../components/SceneTransition';
import { BRAND } from '../../theme';

export const MedSpaScene8: React.FC = () => {
  const frame = useCurrentFrame();

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
          padding: 32,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.2) 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <h1
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: '#ffffff',
            textAlign: 'center',
            margin: 0,
            lineHeight: 1.25,
            maxWidth: 560,
            letterSpacing: '-0.02em',
            opacity: interpolate(frame, [5, 35], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          FREE MED SPA REVENUE AUDIT
        </h1>
        <p
          style={{
            fontSize: 38,
            color: 'rgba(255,255,255,0.9)',
            textAlign: 'center',
            marginTop: 16,
            margin: 0,
            maxWidth: 480,
            fontWeight: 500,
            opacity: interpolate(frame, [20, 50], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          See how much money you're losing.
        </p>
        <div
          style={{
            marginTop: 32,
            padding: '22px 48px',
            background: BRAND.gradientText,
            borderRadius: 14,
            fontSize: 30,
            fontWeight: 700,
            color: '#ffffff',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
            opacity: interpolate(frame, [50, 85], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          Book your free audit today
        </div>
      </div>
    </SceneTransition>
  );
};
