import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { SceneTransition } from '../../components/SceneTransition';
import { FloatingBackground } from '../../components/FloatingBackground';
import { Html5Video, staticFile } from 'remotion';
import { BRAND } from '../../theme';

export const MedSpaScene4: React.FC = () => {
  const frame = useCurrentFrame();
  const assetOpacity = interpolate(frame, [5, 35], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const assetSlide = interpolate(frame, [5, 45], [-50, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const textOpacity = interpolate(frame, [30, 60], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <SceneTransition transitionFrames={25} type="scale">
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          background: BRAND.gradientMedspa,
          fontFamily: 'Inter, system-ui, sans-serif',
          position: 'relative',
          padding: 24,
        }}
      >
        <FloatingBackground color={BRAND.primary} intensity={1.5} />
        <div
          style={{
            opacity: assetOpacity,
            transform: `translateY(${assetSlide}px)`,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            marginBottom: 24,
          }}
        >
          <Html5Video
            src={staticFile('medspa-assets/5.mp4')}
            muted
            loop
            style={{ width: 480, height: 480, objectFit: 'cover' }}
          />
        </div>
        <div style={{ maxWidth: 480, textAlign: 'center', opacity: textOpacity }}>
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
            MANUAL FOLLOW-UPS DON'T WORK
          </h1>
          <p
            style={{
              fontSize: 38,
              color: '#475569',
              marginTop: 16,
              margin: 0,
              fontWeight: 500,
            }}
          >
            Calls ignored.
            <br />
            Leads disappear.
          </p>
        </div>
      </div>
    </SceneTransition>
  );
};
