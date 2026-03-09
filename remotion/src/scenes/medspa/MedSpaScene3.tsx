import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { SceneTransition } from '../../components/SceneTransition';
import { FloatingBackground } from '../../components/FloatingBackground';
import { Html5Video, Img, staticFile } from 'remotion';
import { BRAND } from '../../theme';

export const MedSpaScene3: React.FC = () => {
  const frame = useCurrentFrame();
  const videoOpacity = interpolate(frame, [5, 35], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const videoScale = interpolate(frame, [5, 40], [0.8, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.2)) });
  const dollarOpacity = interpolate(frame, [20, 50], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const dollarSlide = interpolate(frame, [20, 55], [40, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const textOpacity = interpolate(frame, [35, 65], [0, 1], { extrapolateRight: 'clamp' });

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
          background: BRAND.gradientMedspa,
          fontFamily: 'Inter, system-ui, sans-serif',
          position: 'relative',
          padding: 16,
        }}
      >
        <FloatingBackground color={BRAND.primary} intensity={1.5} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 24,
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              opacity: videoOpacity,
              transform: `scale(${videoScale})`,
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            }}
          >
            <Html5Video
              src={staticFile('medspa-assets/4.mp4')}
              muted
              loop
              style={{ width: 380, height: 380, objectFit: 'cover' }}
            />
          </div>
          <div
            style={{
              opacity: dollarOpacity,
              transform: `translateX(${dollarSlide}px)`,
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
              background: '#fff',
              padding: 20,
            }}
          >
            <Img
              src={staticFile('medspa-assets/3.png')}
              style={{ width: 240, height: 240, objectFit: 'contain' }}
            />
          </div>
        </div>
        <div style={{ opacity: textOpacity, textAlign: 'center' }}>
          <h1
            style={{
              fontSize: 54,
              fontWeight: 800,
              color: '#0f172a',
              margin: 0,
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
            }}
          >
            $10,000 – $20,000
            <br />
            LOST EVERY MONTH
          </h1>
          <p
            style={{
              fontSize: 38,
              color: '#475569',
              marginTop: 12,
              margin: 0,
              fontWeight: 500,
            }}
          >
            From missed Botox, fillers, and consultations.
          </p>
        </div>
      </div>
    </SceneTransition>
  );
};
