import React from 'react';
import { useCurrentFrame, interpolate, useVideoConfig } from 'remotion';

/**
 * Animated SVG: Business person with phone receiving notification.
 * Fallback when Lottie isn't available - pure CSS/Remotion animation.
 */
export const AnimatedBusinessPerson: React.FC<{
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}> = ({ width = 280, height = 280, style = {} }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneBounce = Math.sin((frame / fps) * 3) * 4;
  const notificationScale = interpolate(
    frame,
    [0, 15, 30, 45],
    [0, 1.2, 1, 1],
    { extrapolateRight: 'clamp' }
  );
  const notificationOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const personOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 200"
      fill="none"
      style={{ ...style, opacity: personOpacity }}
    >
      {/* Person body */}
      <ellipse cx="100" cy="140" rx="35" ry="25" fill="#6366f1" opacity={0.2} />
      <path
        d="M85 120 L85 95 Q85 75 100 75 Q115 75 115 95 L115 120"
        fill="#e2e8f0"
        stroke="#cbd5e1"
        strokeWidth="2"
      />
      {/* Head */}
      <circle cx="100" cy="55" r="28" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
      <circle cx="94" cy="52" r="3" fill="#64748b" />
      <circle cx="106" cy="52" r="3" fill="#64748b" />
      <path d="M92 62 Q100 68 108 62" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Phone in hand */}
      <g transform={`translate(0, ${phoneBounce})`}>
        <rect x="118" y="85" width="28" height="50" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="2" />
        <rect x="121" y="90" width="22" height="35" rx="2" fill="#0f172a" />
        <circle cx="131" cy="130" r="3" fill="#22c55e" />

        {/* Notification badge */}
        <g
          transform={`translate(131, 95) scale(${notificationScale}) translate(-131, -95)`}
          style={{ opacity: notificationOpacity }}
        >
          <circle cx="131" cy="95" r="10" fill="#ef4444" />
          <text x="131" y="98" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
            3
          </text>
        </g>
      </g>
    </svg>
  );
};
