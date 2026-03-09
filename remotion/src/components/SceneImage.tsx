import React from 'react';
import { staticFile } from 'remotion';

export const SceneImage: React.FC<{
  src: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  alt?: string;
}> = ({ src, width = 260, height = 260, style = {}, alt = '' }) => {
  return (
    <img
      src={staticFile(src)}
      alt={alt}
      style={{
        width,
        height,
        objectFit: 'contain',
        ...style,
      }}
    />
  );
};
