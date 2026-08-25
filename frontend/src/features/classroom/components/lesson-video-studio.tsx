import { ArrowDown, ArrowUp, Film, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/utils/error';

import {
  useCancelVideo,
  useCreateVideoGeneration,
  usePublishVideo,
  useRegenerateVideo,
  useRenderVideo,
  useSaveVideoStoryboard,
  useVideoJobsQuery,
  useVideoPreviewQuery,
  useVideoSourcesQuery,
} from '../hooks';
import type {
  VideoGenerationJob,
  VideoSceneType,
  VideoStoryboardScene,
  VideoStoryboardV1,
  VideoStyle,
} from '../types';

const SCENE_TYPES: VideoSceneType[] = [
  'TITLE',
  'CONCEPT',
  'STEPS',
  'COMPARISON',
  'TIMELINE',
  'DIAGRAM',
  'CODE',
  'CALLOUT',
  'SUMMARY',
];
const VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'onyx',
  'nova',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar',
];
const ACTIVE_STATUSES = new Set(['PLANNING', 'QUEUED', 'SYNTHESIZING', 'RENDERING']);

export interface LessonVideoStudioProps {
  lessonId: string;
}

export function LessonVideoStudio({ lessonId }: LessonVideoStudioProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('sources');
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [creativeInstructions, setCreativeInstructions] = useState('');
  const [duration, setDuration] = useState(180);
  const [language, setLanguage] = useState('English');
  const [voice, setVoice] = useState('coral');
  const [style, setStyle] = useState<VideoStyle>('VISUAL_EXPLAINER');
  const [editedStoryboard, setEditedStoryboard] = useState<VideoStoryboardV1>();
  const [storyboardDirty, setStoryboardDirty] = useState(false);
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const initializedSources = useRef(false);

  const sourcesQuery = useVideoSourcesQuery(lessonId);
  const enabled = sourcesQuery.data?.enabled === true;
  const jobsQuery = useVideoJobsQuery(lessonId, enabled);
  const jobs = useMemo(() => jobsQuery.data?.jobs ?? [], [jobsQuery.data?.jobs]);
  const currentJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs[0],
    [jobs, selectedJobId],
  );
  const createVideo = useCreateVideoGeneration(lessonId);
  const saveStoryboard = useSaveVideoStoryboard(lessonId);
  const regenerate = useRegenerateVideo(lessonId);
  const renderVideo = useRenderVideo(lessonId);
  const publishVideo = usePublishVideo(lessonId);
  const cancelVideo = useCancelVideo(lessonId);
  const preview = useVideoPreviewQuery(
    lessonId,
    currentJob?.id,
    Boolean(currentJob && ['READY', 'PUBLISHED'].includes(currentJob.status)),
  );
  const storyboard = editedStoryboard ?? currentJob?.storyboard ?? undefined;
  const previewUrl = useMemo(
    () => (preview.data ? URL.createObjectURL(preview.data) : undefined),
    [preview.data],
  );

  useEffect(() => {
    if (!sourcesQuery.data?.enabled || initializedSources.current) return;
    initializedSources.current = true;
    setSelectedResourceIds(sourcesQuery.data.sources.map((source) => source.id));
    setDuration(sourcesQuery.data.defaults?.targetDurationSeconds ?? 180);
    setLanguage(sourcesQuery.data.defaults?.language ?? 'English');
    setVoice(sourcesQuery.data.defaults?.voice ?? 'coral');
    setStyle(sourcesQuery.data.defaults?.style ?? 'CLEAN_CORPORATE');
  }, [sourcesQuery.data]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!enabled) return null;

  const create = async () => {
    try {
      const job = await createVideo.mutateAsync({
        selectedResourceIds,
        creativeInstructions: creativeInstructions.trim() || undefined,
        targetDurationSeconds: duration,
        language,
        voice,
        style,
      });
      setSelectedJobId(job.id);
      setEditedStoryboard(undefined);
      setStoryboardDirty(false);
      setTab('storyboard');
      toast.success('Storyboard generation started. You can close this window while it runs.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const save = async () => {
    if (!currentJob || !storyboard) return undefined;
    try {
      const updated = await saveStoryboard.mutateAsync({ jobId: currentJob.id, storyboard });
      setStoryboardDirty(false);
      toast.success('Storyboard saved.');
      return updated;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return undefined;
    }
  };

  const approveAndRender = async () => {
    if (!currentJob || !storyboard) return;
    const saved = await save();
    if (!saved) return;
    try {
      await renderVideo.mutateAsync(currentJob.id);
      setTab('review');
      toast.success('Voice and video rendering queued.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const retryRender = async () => {
    if (!currentJob) return;
    try {
      await renderVideo.mutateAsync(currentJob.id);
      toast.success('Video rendering queued again.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const regenerateScenes = async () => {
    if (!currentJob) return;
    try {
      await regenerate.mutateAsync({
        jobId: currentJob.id,
        sceneIds: selectedSceneIds.length ? selectedSceneIds : undefined,
      });
      setSelectedSceneIds([]);
      setEditedStoryboard(undefined);
      setStoryboardDirty(false);
      toast.success(
        selectedSceneIds.length
          ? 'Selected scenes are being regenerated.'
          : 'Storyboard regeneration started.',
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const cancel = async () => {
    if (!currentJob) return;
    try {
      await cancelVideo.mutateAsync(currentJob.id);
      toast.success('Video generation cancelled and draft artifacts queued for cleanup.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const publish = async () => {
    if (!currentJob) return;
    try {
      const result = await publishVideo.mutateAsync(currentJob.id);
      toast.success(
        `Video published. ${result.reopenedLearnerCount} completed trainee${result.reopenedLearnerCount === 1 ? '' : 's'} must review and retake the quiz.`,
      );
      setConfirmPublish(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const updateScene = (sceneId: string, changes: Partial<VideoStoryboardScene>) => {
    if (!storyboard) return;
    const scenes = storyboard.scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, ...changes } : scene,
    );
    setEditedStoryboard({ ...storyboard, scenes, totalDurationSeconds: sumDuration(scenes) });
    setStoryboardDirty(true);
  };

  const moveScene = (index: number, direction: -1 | 1) => {
    if (!storyboard) return;
    const target = index + direction;
    if (target < 0 || target >= storyboard.scenes.length) return;
    const scenes = [...storyboard.scenes];
    const scene = scenes[index];
    const other = scenes[target];
    if (!scene || !other) return;
    scenes[index] = other;
    scenes[target] = scene;
    setEditedStoryboard({ ...storyboard, scenes });
    setStoryboardDirty(true);
  };

  return (
    <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> AI lesson video
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a fully narrated animated explainer from this lesson.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <Film className="mr-2 size-4" /> Generate Video
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Lesson Video Studio</DialogTitle>
            <DialogDescription>
              Your creative instructions lead the teaching style and emphasis. Lesson content keeps the result
              relevant, while AI can add simple explanations and illustrative examples.
            </DialogDescription>
          </DialogHeader>

          {jobs.length ? (
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Label className="shrink-0">Generation</Label>
              <Select
                value={currentJob?.id}
                onValueChange={(value) => {
                  setSelectedJobId(value);
                  setEditedStoryboard(undefined);
                  setStoryboardDirty(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {new Date(job.createdAt).toLocaleString()} — {job.status.replaceAll('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentJob ? <StatusBadge job={currentJob} /> : null}
            </div>
          ) : null}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sources">1. Sources & settings</TabsTrigger>
              <TabsTrigger value="storyboard">2. Storyboard</TabsTrigger>
              <TabsTrigger value="review">3. Render & review</TabsTrigger>
            </TabsList>

            <TabsContent value="sources" className="space-y-5 pt-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Lesson evidence</p>
                <p className="text-xs text-muted-foreground">
                  The lesson title is always included; its description is included automatically when
                  available.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {sourcesQuery.data?.sources.map((source) => (
                    <div key={source.id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                      <Checkbox
                        id={`video-source-${source.id}`}
                        checked={selectedResourceIds.includes(source.id)}
                        onCheckedChange={(checked) =>
                          setSelectedResourceIds((items) =>
                            checked ? [...items, source.id] : items.filter((id) => id !== source.id),
                          )
                        }
                      />
                      <Label htmlFor={`video-source-${source.id}`} className="cursor-pointer font-normal">
                        <span className="font-medium">{source.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {source.type}
                          {source.filename ? ` · ${source.filename}` : ''}
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              {sourcesQuery.data?.warnings.length ? (
                <Alert>
                  <AlertTitle>Source notes</AlertTitle>
                  <AlertDescription>{sourcesQuery.data.warnings.join(' ')}</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="video-instructions">Creative instructions</Label>
                <Textarea
                  id="video-instructions"
                  maxLength={2000}
                  rows={4}
                  value={creativeInstructions}
                  onChange={(event) => setCreativeInstructions(event.target.value)}
                  placeholder="Example: Use a friendly onboarding tone and emphasize the three safety steps."
                />
                <p className="text-right text-xs text-muted-foreground">{creativeInstructions.length}/2000</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="video-duration">Duration (seconds)</Label>
                  <Input
                    id="video-duration"
                    type="number"
                    min={60}
                    max={sourcesQuery.data?.defaults?.maxDurationSeconds ?? 480}
                    value={duration}
                    onChange={(event) => setDuration(Number(event.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="video-language">Language</Label>
                  <Input
                    id="video-language"
                    maxLength={50}
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Voice</Label>
                  <Select value={voice} onValueChange={setVoice}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Style</Label>
                  <Select value={style} onValueChange={(value) => setStyle(value as VideoStyle)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLEAN_CORPORATE">Clean Corporate</SelectItem>
                      <SelectItem value="VISUAL_EXPLAINER">Visual Explainer</SelectItem>
                      <SelectItem value="CODE_WALKTHROUGH">Code Walkthrough</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => void create()} disabled={createVideo.isPending}>
                  <Sparkles className="mr-2 size-4" />
                  {createVideo.isPending ? 'Starting…' : 'Generate storyboard'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="storyboard" className="space-y-4 pt-3">
              {!currentJob ? (
                <Alert>
                  <AlertDescription>Start a generation from Sources & settings.</AlertDescription>
                </Alert>
              ) : null}
              {currentJob && ACTIVE_STATUSES.has(currentJob.status) ? <JobProgress job={currentJob} /> : null}
              {currentJob?.error ? (
                <Alert variant="destructive">
                  <AlertTitle>{currentJob.status.replaceAll('_', ' ')}</AlertTitle>
                  <AlertDescription>{currentJob.error.message}</AlertDescription>
                </Alert>
              ) : null}
              {storyboard ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{storyboard.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {storyboard.scenes.length} scenes · {formatDuration(storyboard.totalDurationSeconds)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void regenerateScenes()}
                      disabled={regenerate.isPending}
                    >
                      <RefreshCw className="mr-2 size-4" />
                      {selectedSceneIds.length
                        ? `Regenerate ${selectedSceneIds.length} selected`
                        : 'Regenerate all'}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {storyboard.scenes.map((scene, index) => (
                      <div key={scene.id} className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedSceneIds.includes(scene.id)}
                            onCheckedChange={(checked) =>
                              setSelectedSceneIds((items) =>
                                checked ? [...items, scene.id] : items.filter((id) => id !== scene.id),
                              )
                            }
                          />
                          <Badge variant="outline">Scene {index + 1}</Badge>
                          <Select
                            value={scene.type}
                            onValueChange={(value) =>
                              updateScene(scene.id, { type: value as VideoSceneType })
                            }
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SCENE_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type.replaceAll('_', ' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="ml-auto flex">
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={index === 0}
                              onClick={() => moveScene(index, -1)}
                            >
                              <ArrowUp className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={index === storyboard.scenes.length - 1}
                              onClick={() => moveScene(index, 1)}
                            >
                              <ArrowDown className="size-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                          <div className="space-y-1">
                            <Label>Heading</Label>
                            <Input
                              value={scene.heading}
                              maxLength={140}
                              onChange={(event) => updateScene(scene.id, { heading: event.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Planned seconds</Label>
                            <Input
                              type="number"
                              min={1}
                              max={120}
                              step={0.1}
                              value={scene.durationSeconds}
                              onChange={(event) =>
                                updateScene(scene.id, { durationSeconds: Number(event.target.value) })
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>Narration</Label>
                          <Textarea
                            rows={4}
                            maxLength={4096}
                            value={scene.narration}
                            onChange={(event) => updateScene(scene.id, { narration: event.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>On-screen bullets (one per line)</Label>
                          <Textarea
                            rows={3}
                            value={scene.bullets.join('\n')}
                            onChange={(event) =>
                              updateScene(scene.id, {
                                bullets: event.target.value
                                  .split('\n')
                                  .map((item) => item.trim())
                                  .filter(Boolean)
                                  .slice(0, 8),
                              })
                            }
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Evidence: {scene.sourceRefs.join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void save()}
                      disabled={saveStoryboard.isPending || !storyboardDirty}
                    >
                      Save storyboard
                    </Button>
                    <Button
                      onClick={() => void approveAndRender()}
                      disabled={saveStoryboard.isPending || renderVideo.isPending}
                    >
                      Approve & render video
                    </Button>
                  </div>
                </>
              ) : null}
            </TabsContent>

            <TabsContent value="review" className="space-y-4 pt-3">
              {currentJob && ACTIVE_STATUSES.has(currentJob.status) ? <JobProgress job={currentJob} /> : null}
              {currentJob?.status === 'READY' || currentJob?.status === 'PUBLISHED' ? (
                <>
                  {previewUrl ? (
                    // Captions are burned into the MP4 only when word-level timing succeeds.
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video className="aspect-video w-full rounded-lg bg-black" controls src={previewUrl} />
                  ) : (
                    <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
                      Loading authenticated preview…
                    </div>
                  )}
                  <Alert>
                    <AlertTitle>Review before publishing</AlertTitle>
                    <AlertDescription>
                      Publishing adds this as a normal lesson video. Every completed trainee will see new
                      content, must review the lesson again, and must pass a new current-version quiz.
                    </AlertDescription>
                  </Alert>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTab('storyboard');
                        setStoryboardDirty(false);
                      }}
                    >
                      Edit storyboard
                    </Button>
                    {currentJob.status === 'READY' ? (
                      <Button onClick={() => setConfirmPublish(true)}>Publish video</Button>
                    ) : (
                      <Badge>Published</Badge>
                    )}
                  </div>
                </>
              ) : currentJob?.error ? (
                <div className="space-y-3">
                  <Alert variant={currentJob.error.code === 'RETRYING_RENDER' ? 'default' : 'destructive'}>
                    <AlertTitle>
                      {currentJob.error.code === 'RETRYING_RENDER'
                        ? 'Rendering retry in progress'
                        : 'Generation failed'}
                    </AlertTitle>
                    <AlertDescription>{currentJob.error.message}</AlertDescription>
                  </Alert>
                  {currentJob.status === 'FAILED' && currentJob.storyboard ? (
                    <div className="flex justify-end">
                      <Button onClick={() => void retryRender()} disabled={renderVideo.isPending}>
                        <RefreshCw className="mr-2 size-4" />
                        Retry render
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    Approve the storyboard to start voice synthesis and rendering.
                  </AlertDescription>
                </Alert>
              )}
              {currentJob && currentJob.status !== 'PUBLISHED' && currentJob.status !== 'CANCELLED' ? (
                <div className="border-t pt-4">
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => void cancel()}
                    disabled={cancelVideo.isPending}
                  >
                    <XCircle className="mr-2 size-4" />
                    Cancel generation
                  </Button>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="Publish AI lesson video?"
        description="This changes the lesson content version. Completed trainees will be reopened, must review the lesson, and must retake its quiz."
        confirmLabel="Publish video"
        onConfirm={() => void publish()}
      />
    </div>
  );
}

function StatusBadge({ job }: { job: VideoGenerationJob }) {
  return (
    <Badge variant={job.status === 'FAILED' || job.status === 'STALE' ? 'destructive' : 'secondary'}>
      {job.status.replaceAll('_', ' ')}
    </Badge>
  );
}

function JobProgress({ job }: { job: VideoGenerationJob }) {
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex justify-between text-sm">
        <span>{job.status.replaceAll('_', ' ')}</span>
        <span>{job.progress}%</span>
      </div>
      <Progress value={job.progress} />
      <p className="text-xs text-muted-foreground">
        This runs in the background; no page request waits for AI or rendering.
      </p>
    </div>
  );
}

function sumDuration(scenes: VideoStoryboardScene[]): number {
  return scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
}

function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}
