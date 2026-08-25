import React from 'react';
import { Composition, registerRoot } from 'remotion';

import { LessonVideo, type LessonVideoProps } from './composition';

const defaultProps: LessonVideoProps = {
  storyboard: {
    version: 1,
    title: 'Lesson video',
    language: 'English',
    totalDurationSeconds: 60,
    scenes: [
      {
        id: 'default-1',
        type: 'TITLE',
        heading: 'Lesson video',
        narration: 'Lesson video',
        bullets: [],
        visualDirection: 'Title',
        visualPreset: 'FADE_UP',
        durationSeconds: 60,
        sourceRefs: ['lesson-description'],
      },
    ],
  },
  audioFiles: {},
  visualFiles: {},
  style: 'CLEAN_CORPORATE',
};

const VideoRoot: React.FC = () => (
  <Composition
    id="LessonVideo"
    component={LessonVideo}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={1800}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, Math.round(props.storyboard.totalDurationSeconds * 30)),
    })}
  />
);

registerRoot(VideoRoot);
