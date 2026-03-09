import React, { useState, useEffect } from 'react';
import { Lottie } from '@remotion/lottie';
import { delayRender, continueRender, staticFile } from 'remotion';

/**
 * Different Lottie character per scene.
 * Add JSON to public/ (scene-1-hook.json, etc.) to use your own — local files override URLs.
 */
const SCENE_LOTTIES: Record<string, { url: string; local: string }> = {
  hook: { url: 'https://assets2.lottiefiles.com/packages/lf20_ydo1amjm.json', local: 'scene-1-hook.json' },
  reality: { url: 'https://assets2.lottiefiles.com/packages/lf20_touohxv0.json', local: 'scene-2-reality.json' },
  wish: { url: 'https://assets4.lottiefiles.com/packages/lf20_success_feedback.json', local: 'packaging-for-delivery.json' },
  problem: { url: 'https://assets2.lottiefiles.com/packages/lf20_ukgycxej.json', local: 'scene-4-problem.json' },
  solution: { url: 'https://assets2.lottiefiles.com/packages/lf20_zw0djhar.json', local: 'business-salesman.json' },
  result: { url: 'https://assets4.lottiefiles.com/packages/lf20_success_feedback.json', local: 'packaging-for-delivery.json' },
  closing: { url: 'https://assets2.lottiefiles.com/packages/lf20_ydo1amjm.json', local: 'business-salesman.json' },
};

export const SceneLottie: React.FC<{
  scene: keyof typeof SCENE_LOTTIES;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  playbackRate?: number;
  loop?: boolean;
}> = ({ scene, width = 280, height = 280, style = {}, playbackRate = 0.7, loop = true }) => {
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [handle] = useState(() => delayRender(`Loading Lottie: ${scene}`));

  const { url, local } = SCENE_LOTTIES[scene];

  useEffect(() => {
    const load = (src: string) =>
      fetch(src)
        .then((res) => res.json())
        .then((data) => {
          setAnimationData(data);
          continueRender(handle);
        })
        .catch(() => continueRender(handle));

    fetch(staticFile(local))
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setAnimationData(data);
        continueRender(handle);
      })
      .catch(() => load(url));
  }, [scene, handle, url, local]);

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
