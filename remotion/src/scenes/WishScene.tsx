import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { SceneTransition } from '../components/SceneTransition';
import { AnimatedText } from '../components/AnimatedText';
import { SceneLottie } from '../components/SceneLottie';
import { FloatingBackground } from '../components/FloatingBackground';
import { BRAND } from '../theme';

export const WishScene: React.FC = () => {
  const frame = useCurrentFrame();

  const sparkleOpacity = interpolate(frame, [30, 50], [0, 0.6], { extrapolateRight: 'clamp' });

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
        <FloatingBackground color={BRAND.purple} />
        <div
          style={{
            marginBottom: 36,
            opacity: interpolate(frame, [5, 28], [0, 1], { extrapolateRight: 'clamp' }),
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <SceneLottie scene="wish" width={380} height={380} playbackRate={0.6} />
        </div>
        <div
          style={{
            fontSize: 56,
            marginBottom: 20,
            opacity: sparkleOpacity,
          }}
        >
          ✨
        </div>
        <h2
          style={{
            fontSize: 38,
            fontWeight: 700,
            color: '#0f172a',
            textAlign: 'center',
            margin: 0,
            lineHeight: 1.35,
            padding: '0 32px',
            maxWidth: 520,
          }}
        >
          <AnimatedText delay={55} duration={35}>
            What if they came back on their own?
          </AnimatedText>
        </h2>
      </div>
    </SceneTransition>
  );
};
