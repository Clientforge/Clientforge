import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

const shapes = [
  { size: 140, x: '10%', y: '15%', delay: 0, opacity: 0.08 },
  { size: 100, x: '85%', y: '20%', delay: 15, opacity: 0.06 },
  { size: 80, x: '75%', y: '70%', delay: 30, opacity: 0.05 },
  { size: 120, x: '15%', y: '75%', delay: 45, opacity: 0.06 },
  { size: 60, x: '50%', y: '10%', delay: 60, opacity: 0.04 },
  { size: 110, x: '90%', y: '50%', delay: 20, opacity: 0.05 },
  { size: 70, x: '5%', y: '50%', delay: 40, opacity: 0.04 },
];

export const FloatingBackground: React.FC<{ color?: string; intensity?: number }> = ({
  color = '#6366f1',
  intensity = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {shapes.map((s, i) => {
        const floatY = Math.sin((frame + s.delay * 2) / (fps * 2.5)) * 18;
        const floatX = Math.cos((frame + s.delay) / (fps * 1.8)) * 12;
        const scale = 1 + Math.sin((frame + s.delay * 3) / (fps * 3.5)) * 0.12;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: s.x,
              top: s.y,
              width: s.size,
              height: s.size,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${color}50 0%, ${color}20 40%, transparent 70%)`,
              opacity: s.opacity * intensity,
              transform: `translate(${floatX}px, ${floatY}px) scale(${scale})`,
            }}
          />
        );
      })}
    </div>
  );
};
