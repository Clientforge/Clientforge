import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { SceneTransition } from '../../components/SceneTransition';
import { FloatingBackground } from '../../components/FloatingBackground';
import { Img, staticFile } from 'remotion';
import { BRAND } from '../../theme';

export const MedSpaScene6: React.FC = () => {
  const frame = useCurrentFrame();
  const assetOpacity = interpolate(frame, [5, 35], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const assetSlide = interpolate(frame, [5, 45], [80, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const textOpacity = interpolate(frame, [25, 55], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <SceneTransition transitionFrames={25} type="fade">
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
          background: BRAND.gradientMedspa,
          fontFamily: 'Inter, system-ui, sans-serif',
          position: 'relative',
          padding: 24,
        }}
      >
        <FloatingBackground color={BRAND.primary} intensity={1.5} />
        <div style={{ flex: 1, maxWidth: 420, textAlign: 'right', opacity: textOpacity }}>
          <h1
            style={{
              fontSize: 54,
              fontWeight: 800,
              color: '#0f172a',
              margin: 0,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
            }}
          >
            CUT NO-SHOWS BY 40–60%
          </h1>
          <p
            style={{
              fontSize: 38,
              color: '#475569',
              marginTop: 20,
              margin: 0,
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            Fill your schedule.
            <br />
            Recover lost revenue.
          </p>
        </div>
        <div
          style={{
            opacity: assetOpacity,
            transform: `translateX(${assetSlide}px)`,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            flexShrink: 0,
          }}
        >
          <Img
            src={staticFile('medspa-assets/7.png')}
            style={{ width: 480, height: 480, objectFit: 'cover' }}
          />
        </div>
      </div>
    </SceneTransition>
  );
};
