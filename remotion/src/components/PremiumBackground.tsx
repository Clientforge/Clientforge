import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export const PremiumBackground: React.FC<{
  variant?: 'light' | 'warm' | 'cool' | 'dark' | 'success';
}> = ({ variant = 'light' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const variants = {
    light: {
      base: 'linear-gradient(180deg, #fafbff 0%, #f5f7ff 40%, #eef2ff 100%)',
      orb1: 'rgba(99, 102, 241, 0.12)',
      orb2: 'rgba(139, 92, 246, 0.08)',
      orb3: 'rgba(59, 130, 246, 0.06)',
      light: 'rgba(255,255,255,0.6)',
    },
    warm: {
      base: 'linear-gradient(180deg, #fffaf5 0%, #fef7ed 40%, #fef3e2 100%)',
      orb1: 'rgba(251, 146, 60, 0.1)',
      orb2: 'rgba(139, 92, 246, 0.08)',
      orb3: 'rgba(59, 130, 246, 0.05)',
      light: 'rgba(255,255,255,0.6)',
    },
    cool: {
      base: 'linear-gradient(180deg, #f0f9ff 0%, #eef2ff 40%, #e0e7ff 100%)',
      orb1: 'rgba(99, 102, 241, 0.14)',
      orb2: 'rgba(139, 92, 246, 0.1)',
      orb3: 'rgba(59, 130, 246, 0.08)',
      light: 'rgba(255,255,255,0.6)',
    },
    dark: {
      base: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      orb1: 'rgba(99, 102, 241, 0.25)',
      orb2: 'rgba(139, 92, 246, 0.2)',
      orb3: 'rgba(59, 130, 246, 0.15)',
      light: 'rgba(255,255,255,0.08)',
    },
    success: {
      base: 'linear-gradient(180deg, #f0fdf4 0%, #dcfce7 40%, #bbf7d0 100%)',
      orb1: 'rgba(34, 197, 94, 0.12)',
      orb2: 'rgba(99, 102, 241, 0.08)',
      orb3: 'rgba(59, 130, 246, 0.06)',
      light: 'rgba(255,255,255,0.5)',
    },
  };

  const v = variants[variant];

  const orb1X = 50 + Math.sin(t * 0.4) * 8;
  const orb1Y = 60 + Math.cos(t * 0.3) * 8;
  const orb2X = 80 + Math.cos(t * 0.5) * 2;
  const orb2Y = 25 + Math.sin(t * 0.4) * 2;
  const orb3X = 15 + Math.sin(t * 0.35) * 3;
  const orb3Y = 75 + Math.cos(t * 0.45) * 3;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Base gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: v.base,
        }}
      />

      {/* Ambient light orbs */}
      <div
        style={{
          position: 'absolute',
          left: `${orb1X}%`,
          top: `${orb1Y}%`,
          width: '80%',
          height: '80%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle at center, ${v.orb1} 0%, transparent 60%)`,
          filter: 'blur(60px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${orb2X}%`,
          top: `${orb2Y}%`,
          width: '50%',
          height: '50%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle at center, ${v.orb2} 0%, transparent 60%)`,
          filter: 'blur(80px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${orb3X}%`,
          top: `${orb3Y}%`,
          width: '60%',
          height: '60%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle at center, ${v.orb3} 0%, transparent 60%)`,
          filter: 'blur(70px)',
        }}
      />

      {/* Top spotlight */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '-20%',
          width: '120%',
          height: '60%',
          transform: 'translateX(-50%)',
          background: `radial-gradient(ellipse at center bottom, ${v.light} 0%, transparent 70%)`,
          filter: 'blur(40px)',
        }}
      />

      {/* Subtle vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: variant === 'dark'
            ? 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 70%, rgba(0,0,0,0.4) 100%)'
            : 'radial-gradient(ellipse 90% 90% at 50% 50%, transparent 70%, rgba(0,0,0,0.06) 100%)',
          opacity: variant === 'dark' ? 1 : 0.8,
        }}
      />

      {/* Subtle light leak (premium film look) */}
      {variant === 'dark' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '60%',
            height: '40%',
            background: 'linear-gradient(135deg, transparent 40%, rgba(99, 102, 241, 0.08) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};
