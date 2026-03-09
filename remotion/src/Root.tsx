import { Composition } from 'remotion';
import { ClientForgeExplainer } from './ClientForgeExplainer';
import { MedSpaExplainer } from './MedSpaExplainer';
import { FrameExtractor } from './FrameExtractor';

const FPS = 30;
const DURATION_SECONDS = 30;
const DURATION_FRAMES = FPS * DURATION_SECONDS;

export const RemotionRoot = () => (
  <>
    <Composition
      id="ClientForgeExplainer"
      component={ClientForgeExplainer}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{}}
    />
    <Composition
      id="MedSpaExplainer"
      component={MedSpaExplainer}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{}}
    />
    <Composition
      id="FrameExtractor"
      component={FrameExtractor}
      durationInFrames={1}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ sourceFrame: 0 }}
    />
  </>
);
