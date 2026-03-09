import React from 'react';

const logoStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontWeight: 700,
  fontSize: 48,
  color: '#111827',
};

const aiStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

export const Logo: React.FC<{ size?: number; variant?: 'light' | 'dark' }> = ({ size = 48, variant = 'dark' }) => (
  <div style={{ ...logoStyle, fontSize: size, color: variant === 'light' ? '#ffffff' : '#111827' }}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <rect width="28" height="28" rx="8" fill="url(#logoGrad)" />
      <path
        d="M8 14l4 4 8-8"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="28" y2="28">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
    ClientForge<span style={aiStyle}>.ai</span>
  </div>
);
