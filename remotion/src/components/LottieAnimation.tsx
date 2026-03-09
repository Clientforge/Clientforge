import React, { useState, useEffect } from 'react';
import { Lottie } from '@remotion/lottie';
import { delayRender, continueRender } from 'remotion';

const LOTTIE_URLS: Record<string, string> = {
  businessPerson: 'https://assets2.lottiefiles.com/packages/lf20_ydo1amjm.json',
  phoneNotification: 'https://assets2.lottiefiles.com/packages/lf20_touohxv0.json',
  success: 'https://assets2.lottiefiles.com/packages/lf20_success_feedback.json',
};

export const LottieAnimation: React.FC<{
  type: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  playbackRate?: number;
  loop?: boolean;
}> = ({ type, width = 280, height = 280, style = {}, playbackRate = 0.8, loop = true }) => {
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [handle] = useState(() => delayRender('Loading Lottie'));

  useEffect(() => {
    fetch(LOTTIE_URLS[type])
      .then((res) => res.json())
      .then((data) => {
        setAnimationData(data);
        continueRender(handle);
      })
      .catch(() => {
        continueRender(handle);
      });
  }, [type, handle]);

  if (!animationData) return null;

  return (
    <Lottie
      animationData={animationData}
      style={{ width, height, ...style }}
      playbackRate={playbackRate}
      loop={loop}
    />
  );
};
