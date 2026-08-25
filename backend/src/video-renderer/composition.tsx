import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import type {
  VideoStoryboardScene,
  VideoStoryboardV1,
} from '@/modules/video-generation/video-generation.types';

export interface LessonVideoProps extends Record<string, unknown> {
  storyboard: VideoStoryboardV1;
  audioFiles: Record<string, string>;
  visualFiles: Record<string, string>;
  style: 'CLEAN_CORPORATE' | 'VISUAL_EXPLAINER' | 'CODE_WALKTHROUGH';
}

type VideoStyle = LessonVideoProps['style'];
type Colors = (typeof palette)[VideoStyle];

const palette = {
  CLEAN_CORPORATE: {
    background: '#06101f',
    surface: '#0c1d33',
    accent: '#22d3c5',
    secondary: '#60a5fa',
    glow: '#22d3c555',
  },
  VISUAL_EXPLAINER: {
    background: '#100d27',
    surface: '#241547',
    accent: '#a78bfa',
    secondary: '#fb7185',
    glow: '#a78bfa66',
  },
  CODE_WALKTHROUGH: {
    background: '#030d0a',
    surface: '#071c15',
    accent: '#4ade80',
    secondary: '#22d3ee',
    glow: '#4ade8055',
  },
};

export const LessonVideo: React.FC<LessonVideoProps> = ({ storyboard, audioFiles, visualFiles, style }) => {
  let startFrame = 0;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette[style].background,
        color: 'white',
        fontFamily: 'Inter, Arial, sans-serif',
      }}
    >
      {storyboard.scenes.map((scene, index) => {
        const durationInFrames = Math.max(1, Math.round(scene.durationSeconds * 30));
        const from = startFrame;
        startFrame += durationInFrames;
        return (
          <Sequence key={scene.id} from={from} durationInFrames={durationInFrames} premountFor={30}>
            <Scene
              scene={scene}
              index={index}
              total={storyboard.scenes.length}
              durationInFrames={durationInFrames}
              style={style}
              visualFiles={visualFiles}
            />
            {audioFiles[scene.id] ? <Audio src={staticFile(audioFiles[scene.id] as string)} /> : null}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const Scene: React.FC<{
  scene: VideoStoryboardScene;
  index: number;
  total: number;
  durationInFrames: number;
  style: VideoStyle;
  visualFiles: Record<string, string>;
}> = ({ scene, index, total, durationInFrames, style, visualFiles }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = palette[style];
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const entrance = spring({ fps, frame, config: { damping: 18, stiffness: 105, mass: 0.8 } });
  const exitStart = Math.max(12, durationInFrames - 9);
  const opacity = interpolate(frame, [0, 7, exitStart, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const visual = scene.sourceRefs
    .map((reference) => visualFiles[reference] ?? visualFiles[reference.split('#')[0] as string])
    .find(Boolean);

  return (
    <AbsoluteFill style={{ opacity, overflow: 'hidden' }}>
      <AnimatedBackdrop frame={frame} index={index} colors={colors} />
      {visual ? (
        <Img
          src={staticFile(visual)}
          style={{
            position: 'absolute',
            right: 58,
            top: 130,
            width: 670,
            height: 670,
            objectFit: 'contain',
            opacity: 0.2,
            borderRadius: 36,
            transform: `scale(${1.02 + progress * 0.08}) rotate(${Math.sin(frame / 70) * 1.2}deg)`,
            filter: 'saturate(1.15) contrast(1.05)',
          }}
        />
      ) : null}
      <Header scene={scene} index={index} total={total} colors={colors} progress={progress} />
      <div
        style={{
          position: 'absolute',
          inset: '125px 82px 175px',
          transform: `translateY(${(1 - entrance) * 34}px)`,
          opacity: entrance,
        }}
      >
        <SceneVisual
          scene={scene}
          frame={frame}
          fps={fps}
          progress={progress}
          colors={colors}
          hasVisual={Boolean(visual)}
        />
      </div>
      <KaraokeCaption narration={scene.narration} progress={progress} colors={colors} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: `${((index + progress) / total) * 100}%`,
          height: 7,
          background: `linear-gradient(90deg, ${colors.secondary}, ${colors.accent})`,
          boxShadow: `0 0 24px ${colors.glow}`,
        }}
      />
    </AbsoluteFill>
  );
};

const AnimatedBackdrop: React.FC<{ frame: number; index: number; colors: Colors }> = ({
  frame,
  index,
  colors,
}) => (
  <AbsoluteFill>
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${18 + Math.sin(frame / 80 + index) * 7}% 22%, ${colors.glow}, transparent 32%), radial-gradient(circle at 82% ${70 + Math.cos(frame / 90) * 8}%, ${colors.secondary}33, transparent 34%), linear-gradient(135deg, ${colors.background}, ${colors.surface})`,
      }}
    />
    <AbsoluteFill
      style={{
        opacity: 0.16,
        backgroundImage: `linear-gradient(${colors.accent}44 1px, transparent 1px), linear-gradient(90deg, ${colors.accent}44 1px, transparent 1px)`,
        backgroundSize: '72px 72px',
        transform: `translate(${(frame * 0.22) % 72}px, ${(frame * 0.14) % 72}px)`,
      }}
    />
    {[0, 1, 2, 3].map((item) => (
      <div
        key={item}
        style={{
          position: 'absolute',
          width: 10 + item * 4,
          height: 10 + item * 4,
          borderRadius: '50%',
          background: item % 2 ? colors.secondary : colors.accent,
          left: `${12 + item * 24 + Math.sin(frame / (24 + item * 7)) * 3}%`,
          top: `${18 + ((item * 19) % 62) + Math.cos(frame / (31 + item * 5)) * 5}%`,
          opacity: 0.38,
          boxShadow: `0 0 28px ${colors.glow}`,
        }}
      />
    ))}
  </AbsoluteFill>
);

const Header: React.FC<{
  scene: VideoStoryboardScene;
  index: number;
  total: number;
  colors: Colors;
  progress: number;
}> = ({ scene, index, total, colors, progress }) => (
  <div
    style={{
      position: 'absolute',
      left: 82,
      right: 82,
      top: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 22,
      letterSpacing: 1.4,
      color: '#cbd5e1',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span
        style={{
          width: 13,
          height: 13,
          borderRadius: '50%',
          background: colors.accent,
          boxShadow: `0 0 20px ${colors.accent}`,
        }}
      />
      <span style={{ fontWeight: 700 }}>DATABEAT LEARNING</span>
      <span style={{ opacity: 0.46 }}>/</span>
      <span style={{ color: colors.accent }}>{scene.type.replaceAll('_', ' ')}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <span>{Math.round(((index + progress) / total) * 100)}%</span>
      <span>
        {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </span>
    </div>
  </div>
);

interface VisualProps {
  scene: VideoStoryboardScene;
  frame: number;
  fps: number;
  progress: number;
  colors: Colors;
  hasVisual: boolean;
}

const SceneVisual: React.FC<VisualProps> = (props) => {
  switch (props.scene.type) {
    case 'TITLE':
      return <TitleVisual {...props} />;
    case 'STEPS':
      return <StepsVisual {...props} />;
    case 'COMPARISON':
      return <ComparisonVisual {...props} />;
    case 'TIMELINE':
      return <TimelineVisual {...props} />;
    case 'DIAGRAM':
      return <DiagramVisual {...props} />;
    case 'CODE':
      return <CodeVisual {...props} />;
    case 'CALLOUT':
      return <CalloutVisual {...props} />;
    case 'SUMMARY':
      return <SummaryVisual {...props} />;
    default:
      return <ConceptVisual {...props} />;
  }
};

const TitleVisual: React.FC<VisualProps> = ({ scene, frame, fps, colors }) => {
  const words = scene.heading.split(/\s+/);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ color: colors.accent, fontSize: 25, fontWeight: 800, letterSpacing: 5 }}>
        ANIMATED LESSON
      </div>
      <h1 style={{ margin: '24px 0 34px', maxWidth: 1480, fontSize: 86, lineHeight: 1.04 }}>
        {words.map((word, index) => {
          const reveal = spring({ fps, frame: Math.max(0, frame - index * 3), config: { damping: 16 } });
          return (
            <span
              key={`${word}-${index}`}
              style={{
                display: 'inline-block',
                marginRight: 24,
                transform: `translateY(${(1 - reveal) * 48}px) rotate(${(1 - reveal) * 2}deg)`,
                opacity: reveal,
              }}
            >
              {word}
            </span>
          );
        })}
      </h1>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {scene.bullets.slice(0, 4).map((bullet, index) => (
          <AnimatedPill key={bullet} text={bullet} index={index} frame={frame} fps={fps} colors={colors} />
        ))}
      </div>
    </div>
  );
};

const ConceptVisual: React.FC<VisualProps> = ({ scene, frame, fps, colors, hasVisual }) => (
  <div
    style={{
      height: '100%',
      display: 'grid',
      gridTemplateColumns: hasVisual ? '1.15fr 0.85fr' : '0.9fr 1.1fr',
      gap: 70,
      alignItems: 'center',
    }}
  >
    <div>
      <SceneHeading scene={scene} colors={colors} />
      <p style={{ maxWidth: 760, color: '#cbd5e1', fontSize: 29, lineHeight: 1.45 }}>
        {scene.visualDirection}
      </p>
    </div>
    <div style={{ position: 'relative', height: 510 }}>
      <div
        style={{
          position: 'absolute',
          inset: '135px 170px',
          borderRadius: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 30,
          textAlign: 'center',
          fontSize: 31,
          fontWeight: 800,
          background: `linear-gradient(145deg, ${colors.accent}44, ${colors.surface})`,
          border: `2px solid ${colors.accent}`,
          boxShadow: `0 0 ${38 + Math.sin(frame / 8) * 8}px ${colors.glow}`,
        }}
      >
        {scene.heading}
      </div>
      {scene.bullets.slice(0, 4).map((bullet, index) => {
        const positions = [
          { left: 4, top: 20 },
          { right: 4, top: 30 },
          { left: 12, bottom: 12 },
          { right: 12, bottom: 12 },
        ];
        const reveal = spring({ fps, frame: Math.max(0, frame - 8 - index * 5), config: { damping: 17 } });
        return (
          <div
            key={bullet}
            style={{
              position: 'absolute',
              ...positions[index],
              width: 210,
              padding: '18px 20px',
              borderRadius: 18,
              textAlign: 'center',
              fontSize: 23,
              fontWeight: 700,
              background: '#ffffff12',
              border: `1px solid ${colors.secondary}99`,
              transform: `scale(${0.7 + reveal * 0.3})`,
              opacity: reveal,
            }}
          >
            {bullet}
          </div>
        );
      })}
    </div>
  </div>
);

const StepsVisual: React.FC<VisualProps> = ({ scene, frame, fps, progress, colors }) => {
  const items = scene.bullets.length ? scene.bullets.slice(0, 5) : [scene.visualDirection];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <SceneHeading scene={scene} colors={colors} />
      <div
        style={{
          position: 'relative',
          marginTop: 58,
          display: 'grid',
          gridTemplateColumns: `repeat(${items.length}, 1fr)`,
          gap: 24,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '5%',
            right: '5%',
            top: 51,
            height: 5,
            background: '#ffffff1c',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '5%',
            top: 51,
            height: 5,
            width: `${Math.max(0, progress * 90)}%`,
            background: colors.accent,
            boxShadow: `0 0 20px ${colors.glow}`,
          }}
        />
        {items.map((item, index) => {
          const reveal = spring({ fps, frame: Math.max(0, frame - index * 7), config: { damping: 17 } });
          return (
            <div
              key={`${item}-${index}`}
              style={{
                position: 'relative',
                textAlign: 'center',
                opacity: reveal,
                transform: `translateY(${(1 - reveal) * 35}px)`,
              }}
            >
              <div
                style={{
                  margin: '0 auto 28px',
                  width: 106,
                  height: 106,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 42,
                  fontWeight: 900,
                  background: colors.surface,
                  border: `4px solid ${colors.accent}`,
                  boxShadow: `0 0 25px ${colors.glow}`,
                }}
              >
                {index + 1}
              </div>
              <div
                style={{
                  padding: '22px 16px',
                  borderRadius: 18,
                  minHeight: 92,
                  background: '#ffffff0f',
                  border: '1px solid #ffffff22',
                  fontSize: 25,
                  fontWeight: 700,
                  lineHeight: 1.3,
                }}
              >
                {item}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ComparisonVisual: React.FC<VisualProps> = ({ scene, frame, fps, colors }) => {
  const midpoint = Math.max(1, Math.ceil(scene.bullets.length / 2));
  const columns = [scene.bullets.slice(0, midpoint), scene.bullets.slice(midpoint)];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <SceneHeading scene={scene} colors={colors} centered />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 100px 1fr',
          gap: 28,
          alignItems: 'stretch',
          marginTop: 42,
        }}
      >
        {columns.map((items, column) => {
          const reveal = spring({ fps, frame: Math.max(0, frame - column * 7), config: { damping: 17 } });
          return (
            <React.Fragment key={column}>
              {column === 1 ? (
                <div
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 28,
                    color: colors.accent,
                    fontWeight: 900,
                  }}
                >
                  VS
                </div>
              ) : null}
              <div
                style={{
                  minHeight: 360,
                  padding: 34,
                  borderRadius: 30,
                  background: column ? `${colors.secondary}20` : `${colors.accent}20`,
                  border: `2px solid ${column ? colors.secondary : colors.accent}`,
                  transform: `translateX(${(1 - reveal) * (column ? 55 : -55)}px)`,
                  opacity: reveal,
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    color: column ? colors.secondary : colors.accent,
                    fontWeight: 900,
                    marginBottom: 28,
                  }}
                >
                  OPTION {column + 1}
                </div>
                {items.map((item) => (
                  <div
                    key={item}
                    style={{ fontSize: 28, padding: '17px 0', borderBottom: '1px solid #ffffff22' }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const TimelineVisual: React.FC<VisualProps> = ({ scene, frame, fps, progress, colors }) => {
  const items = scene.bullets.length ? scene.bullets.slice(0, 6) : [scene.visualDirection];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <SceneHeading scene={scene} colors={colors} />
      <div style={{ position: 'relative', marginTop: 90, height: 300 }}>
        <div
          style={{
            position: 'absolute',
            left: 40,
            right: 40,
            top: 84,
            height: 6,
            background: '#ffffff20',
            borderRadius: 9,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 40,
            top: 84,
            height: 6,
            width: `calc(${progress * 100}% - 80px)`,
            maxWidth: 'calc(100% - 80px)',
            background: colors.secondary,
            borderRadius: 9,
            boxShadow: `0 0 22px ${colors.glow}`,
          }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 20 }}>
          {items.map((item, index) => {
            const reveal = spring({ fps, frame: Math.max(0, frame - index * 6), config: { damping: 18 } });
            return (
              <div key={`${item}-${index}`} style={{ textAlign: 'center', opacity: reveal }}>
                <div style={{ height: 62, fontSize: 20, color: '#cbd5e1' }}>
                  {index % 2 === 0 ? item : ''}
                </div>
                <div
                  style={{
                    margin: '0 auto',
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: colors.background,
                    border: `4px solid ${colors.secondary}`,
                    fontWeight: 900,
                  }}
                >
                  {index + 1}
                </div>
                <div style={{ marginTop: 24, fontSize: 23, color: '#e2e8f0' }}>{index % 2 ? item : ''}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const DiagramVisual: React.FC<VisualProps> = ({ scene, frame, fps, colors }) => {
  const items = scene.bullets.length ? scene.bullets.slice(0, 5) : [scene.visualDirection];
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <SceneHeading scene={scene} colors={colors} centered />
      <div
        style={{
          position: 'absolute',
          left: '38%',
          right: '38%',
          top: '39%',
          padding: '30px 20px',
          textAlign: 'center',
          borderRadius: 24,
          fontSize: 28,
          fontWeight: 900,
          background: colors.surface,
          border: `3px solid ${colors.accent}`,
          boxShadow: `0 0 32px ${colors.glow}`,
          zIndex: 3,
        }}
      >
        {scene.heading}
      </div>
      {items.map((item, index) => {
        const angle = (Math.PI * 2 * index) / items.length - Math.PI / 2;
        const left = 50 + Math.cos(angle) * 36;
        const top = 57 + Math.sin(angle) * 29;
        const reveal = spring({ fps, frame: Math.max(0, frame - 6 - index * 5), config: { damping: 16 } });
        return (
          <div
            key={`${item}-${index}`}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}%`,
              width: 250,
              minHeight: 80,
              marginLeft: -125,
              marginTop: -40,
              display: 'grid',
              placeItems: 'center',
              padding: 18,
              textAlign: 'center',
              borderRadius: 20,
              fontSize: 23,
              fontWeight: 700,
              background: '#ffffff12',
              border: `1px solid ${colors.secondary}`,
              transform: `scale(${0.65 + reveal * 0.35})`,
              opacity: reveal,
              zIndex: 2,
            }}
          >
            {item}
          </div>
        );
      })}
    </div>
  );
};

const CodeVisual: React.FC<VisualProps> = ({ scene, frame, colors }) => {
  const lines = scene.bullets.length ? scene.bullets : [scene.visualDirection];
  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        gridTemplateColumns: '0.72fr 1.28fr',
        gap: 54,
        alignItems: 'center',
      }}
    >
      <SceneHeading scene={scene} colors={colors} />
      <div
        style={{
          overflow: 'hidden',
          borderRadius: 24,
          background: '#020806',
          border: `1px solid ${colors.accent}88`,
          boxShadow: '0 25px 70px #0008',
        }}
      >
        <div style={{ display: 'flex', gap: 10, padding: '18px 22px', background: '#ffffff0c' }}>
          {['#fb7185', '#facc15', '#4ade80'].map((color) => (
            <span key={color} style={{ width: 14, height: 14, borderRadius: '50%', background: color }} />
          ))}
        </div>
        <div style={{ padding: 34, fontFamily: 'Consolas, monospace', fontSize: 27, lineHeight: 1.7 }}>
          {lines.map((line, index) => {
            const characters = Math.max(0, Math.min(line.length, Math.floor((frame - index * 9) * 1.8)));
            return (
              <div key={`${line}-${index}`} style={{ color: index % 2 ? colors.secondary : '#d1fae5' }}>
                <span style={{ color: '#64748b', marginRight: 24 }}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                {line.slice(0, characters)}
                <span style={{ opacity: frame % 18 < 9 ? 1 : 0, color: colors.accent }}>▌</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const CalloutVisual: React.FC<VisualProps> = ({ scene, frame, colors }) => (
  <div style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
    <div style={{ position: 'relative', maxWidth: 1320 }}>
      <div
        style={{
          position: 'absolute',
          inset: -55,
          borderRadius: 60,
          border: `2px solid ${colors.accent}`,
          transform: `scale(${1 + Math.sin(frame / 10) * 0.025})`,
          opacity: 0.45,
        }}
      />
      <div style={{ color: colors.accent, fontSize: 26, letterSpacing: 6, fontWeight: 900 }}>KEY IDEA</div>
      <h1 style={{ margin: '28px 0 38px', fontSize: 76, lineHeight: 1.08 }}>{scene.heading}</h1>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
        {scene.bullets.slice(0, 4).map((bullet, index) => (
          <span
            key={bullet}
            style={{
              padding: '15px 24px',
              borderRadius: 999,
              background: index % 2 ? `${colors.secondary}24` : `${colors.accent}24`,
              border: `1px solid ${index % 2 ? colors.secondary : colors.accent}`,
              fontSize: 24,
            }}
          >
            {bullet}
          </span>
        ))}
      </div>
    </div>
  </div>
);

const SummaryVisual: React.FC<VisualProps> = ({ scene, frame, fps, colors }) => (
  <div
    style={{
      height: '100%',
      display: 'grid',
      gridTemplateColumns: '0.7fr 1.3fr',
      gap: 80,
      alignItems: 'center',
    }}
  >
    <SceneHeading scene={scene} colors={colors} />
    <div style={{ display: 'grid', gap: 18 }}>
      {scene.bullets.slice(0, 6).map((bullet, index) => {
        const reveal = spring({ fps, frame: Math.max(0, frame - index * 6), config: { damping: 17 } });
        return (
          <div
            key={bullet}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              padding: '20px 24px',
              borderRadius: 18,
              background: '#ffffff10',
              border: '1px solid #ffffff24',
              transform: `translateX(${(1 - reveal) * 55}px)`,
              opacity: reveal,
            }}
          >
            <span
              style={{
                width: 46,
                height: 46,
                display: 'grid',
                placeItems: 'center',
                flex: '0 0 auto',
                borderRadius: '50%',
                color: colors.background,
                background: colors.accent,
                fontSize: 27,
                fontWeight: 1000,
              }}
            >
              ✓
            </span>
            <span style={{ fontSize: 29, fontWeight: 700 }}>{bullet}</span>
          </div>
        );
      })}
    </div>
  </div>
);

const SceneHeading: React.FC<{ scene: VideoStoryboardScene; colors: Colors; centered?: boolean }> = ({
  scene,
  colors,
  centered = false,
}) => (
  <div style={{ textAlign: centered ? 'center' : 'left' }}>
    <div style={{ color: colors.accent, fontSize: 23, fontWeight: 900, letterSpacing: 4 }}>
      {scene.type.replaceAll('_', ' ')}
    </div>
    <h1 style={{ margin: '17px 0 0', fontSize: 61, lineHeight: 1.08 }}>{scene.heading}</h1>
  </div>
);

const AnimatedPill: React.FC<{ text: string; index: number; frame: number; fps: number; colors: Colors }> = ({
  text,
  index,
  frame,
  fps,
  colors,
}) => {
  const reveal = spring({ fps, frame: Math.max(0, frame - 12 - index * 4), config: { damping: 17 } });
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '14px 23px',
        borderRadius: 999,
        background: '#ffffff10',
        border: `1px solid ${colors.secondary}88`,
        fontSize: 24,
        transform: `translateX(${(1 - reveal) * 30}px)`,
        opacity: reveal,
      }}
    >
      {text}
    </span>
  );
};

const KaraokeCaption: React.FC<{ narration: string; progress: number; colors: Colors }> = ({
  narration,
  progress,
  colors,
}) => {
  const phrases = chunkWords(narration, 10);
  const scaled = Math.min(Math.max(0, phrases.length - 0.001), progress * phrases.length);
  const phrase = phrases[Math.floor(scaled)] ?? narration;
  const words = phrase.split(/\s+/).filter(Boolean);
  const activeWord = Math.min(words.length - 1, Math.floor((scaled % 1) * Math.max(1, words.length)));
  return (
    <div
      style={{
        position: 'absolute',
        left: 250,
        right: 250,
        bottom: 53,
        minHeight: 74,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '0 10px',
        padding: '15px 28px',
        borderRadius: 20,
        background: '#020617dc',
        border: '1px solid #ffffff20',
        boxShadow: '0 18px 60px #0009',
        fontSize: 29,
        lineHeight: 1.35,
        textAlign: 'center',
      }}
    >
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          style={{
            color: index === activeWord ? colors.accent : '#f8fafc',
            fontWeight: index === activeWord ? 850 : 550,
            transform: index === activeWord ? 'scale(1.05)' : 'scale(1)',
          }}
        >
          {word}
        </span>
      ))}
    </div>
  );
};

function chunkWords(text: string, size: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += size)
    chunks.push(words.slice(index, index + size).join(' '));
  return chunks.length ? chunks : [''];
}
