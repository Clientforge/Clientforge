import React from 'react';
import { useCurrentFrame, interpolate, useVideoConfig } from 'remotion';

type Mood = 'thoughtful' | 'overwhelmed' | 'hopeful' | 'relieved';

export const BusinessOwnerCharacter: React.FC<{
  mood: Mood;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}> = ({ mood, width = 240, height = 240, style = {} }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const breathe = Math.sin((frame / fps) * 2) * 2;
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // Mouth/expression varies by mood
  const mouthY = mood === 'overwhelmed' ? 66 : mood === 'hopeful' ? 64 : mood === 'relieved' ? 65 : 64;
  const eyeScale = mood === 'overwhelmed' ? 0.7 : 1;
  const browOffset = mood === 'overwhelmed' ? 4 : mood === 'hopeful' ? -2 : mood === 'relieved' ? -3 : 0;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 200"
      fill="none"
      style={{ ...style, opacity }}
    >
      {/* Body - subtle movement */}
      <g transform={`translate(0, ${breathe})`}>
        <ellipse cx="100" cy="140" rx="38" ry="28" fill="#6366f1" opacity={0.15} />
        <path
          d="M82 118 L82 92 Q82 70 100 70 Q118 70 118 92 L118 118"
          fill="#e2e8f0"
          stroke="#cbd5e1"
          strokeWidth="2"
        />

        {/* Head */}
        <circle cx="100" cy="52" r="30" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />

        {/* Eyes */}
        <ellipse cx="90" cy="50" rx="4" ry={4 * eyeScale} fill="#475569" />
        <ellipse cx="110" cy="50" rx="4" ry={4 * eyeScale} fill="#475569" />

        {/* Brows (mood) */}
        <path
          d={`M78 ${48 + browOffset} Q90 ${46 + browOffset} 92 ${48 + browOffset}`}
          stroke="#64748b"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={`M108 ${48 + browOffset} Q120 ${46 + browOffset} 122 ${48 + browOffset}`}
          stroke="#64748b"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />

        {/* Mouth */}
        <path
          d={
            mood === 'overwhelmed'
              ? `M88 ${mouthY} Q100 ${mouthY + 4} 112 ${mouthY}`
              : mood === 'relieved' || mood === 'hopeful'
              ? `M88 ${mouthY} Q100 ${mouthY - 4} 112 ${mouthY}`
              : `M90 ${mouthY} Q100 ${mouthY + 1} 110 ${mouthY}`
          }
          stroke="#94a3b8"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />

        {/* Desk/laptop for context */}
        <rect x="60" y="125" width="80" height="6" rx="2" fill="#cbd5e1" opacity={0.8} />
        <rect x="70" y="110" width="60" height="18" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="1" />
      </g>
    </svg>
  );
};
