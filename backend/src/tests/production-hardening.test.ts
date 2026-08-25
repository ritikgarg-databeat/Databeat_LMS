import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';

import JSZip from 'jszip';

import { LESSON_QUIZ_PASS_PERCENTAGE } from '@/constants/lesson-quiz';
import { promptManager } from '@/modules/ai/prompt-manager';
import { hashAudioInput } from '@/modules/video-generation/video-generation.service';
import {
  createVideoPromptCacheKey,
  createWebVttCaptions,
  synchronizeStoryboardToAudio,
  validateStoryboardForSources,
} from '@/modules/video-generation/video-generation.utils';
import {
  frameConcurrencyForAttempt,
  isRetryableRenderFailure,
} from '@/modules/video-generation/video-generation.worker';
import { buildVideoSourceSnapshot } from '@/modules/video-generation/video-source-context';
import { activeGroupMembershipWhere, activeGroupScope } from '@/policies/group-access.policy';
import { trainerAssessmentScope, trainerCourseScope } from '@/policies/trainer-scope.policy';
import { LocalStorageProvider } from '@/storage/local-storage.provider';
import {
  getAssessmentAttemptElapsedSeconds,
  getAssessmentAttemptExpiresAt,
  isAssessmentAttemptExpired,
} from '@/utils/assessment-attempt-time.util';
import { extractTextSegmentsFromResourceFile } from '@/utils/document-text-extractor';
import { redactSensitiveText } from '@/utils/pii-redaction.util';
import { assertUploadMatchesDeclaredType } from '@/utils/upload-safety.util';

test('active group policy overrides conflicting lifecycle filters', () => {
  assert.deepEqual(activeGroupScope({ status: 'ARCHIVED', name: 'Cohort' }), {
    status: 'ACTIVE',
    name: 'Cohort',
    deletedAt: null,
  });
  assert.deepEqual(activeGroupMembershipWhere('user-1'), {
    userId: 'user-1',
    group: { status: 'ACTIVE', deletedAt: null },
  });
});

test('video source fingerprints change with lesson content versions and keep stable resource references', async () => {
  const resource = {
    id: '11111111-1111-4111-8111-111111111111',
    lessonId: '22222222-2222-4222-8222-222222222222',
    type: 'MARKDOWN' as const,
    title: 'Safety steps',
    relativePath: null,
    originalFilename: null,
    mimeType: null,
    fileSizeBytes: null,
    content: 'Always verify the source before publishing.',
    order: 0,
    createdById: null,
    createdAt: new Date('2026-08-24T12:00:00.000Z'),
    updatedAt: new Date('2026-08-24T12:00:00.000Z'),
  };
  const lesson = {
    id: resource.lessonId,
    title: 'Safe publishing',
    description: 'How to publish a lesson safely.',
    contentVersion: 1,
    resources: [resource],
  };
  const first = await buildVideoSourceSnapshot(lesson, [resource.id]);
  const second = await buildVideoSourceSnapshot({ ...lesson, contentVersion: 2 }, [resource.id]);
  assert.equal(first.sources[0]?.id, 'lesson-title');
  assert.equal(
    first.sources.find((source) => source.resourceId === resource.id)?.id,
    `resource-${resource.id}`,
  );
  assert.notEqual(first.fingerprint, second.fingerprint);
});

test('video document extraction preserves stable PowerPoint slide identifiers', async () => {
  const archive = new JSZip();
  archive.file('ppt/slides/slide2.xml', '<a:t>Second slide</a:t>');
  archive.file('ppt/slides/slide1.xml', '<a:t>First slide</a:t>');
  const segments = await extractTextSegmentsFromResourceFile(
    Readable.from(await archive.generateAsync({ type: 'nodebuffer' })),
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  );
  assert.deepEqual(segments, [
    { locator: 'slide-1', text: 'First slide' },
    { locator: 'slide-2', text: 'Second slide' },
  ]);
});

test('video storyboards enforce lesson source references, duration, captions, and audio cache keys', () => {
  const storyboard = {
    version: 1 as const,
    title: 'Safe publishing',
    language: 'English',
    totalDurationSeconds: 60,
    scenes: [
      {
        id: 'scene-1',
        type: 'TITLE' as const,
        heading: 'Safe publishing',
        narration: 'Start with the approved lesson evidence.',
        bullets: ['Use approved evidence'],
        visualDirection: 'Title card',
        visualPreset: 'FADE_UP' as const,
        durationSeconds: 30,
        sourceRefs: ['lesson-description'],
      },
      {
        id: 'scene-2',
        type: 'SUMMARY' as const,
        heading: 'Review',
        narration: 'Review the source before publishing.',
        bullets: ['Review', 'Publish'],
        visualDirection: 'Checklist',
        visualPreset: 'STAGGERED_CARDS' as const,
        durationSeconds: 30,
        sourceRefs: ['lesson-description'],
      },
    ],
  };
  assert.equal(validateStoryboardForSources(storyboard, ['lesson-description']).totalDurationSeconds, 60);
  assert.throws(
    () =>
      validateStoryboardForSources(
        {
          ...storyboard,
          scenes: [{ ...storyboard.scenes[0], sourceRefs: ['outside-source'] }, storyboard.scenes[1]],
        },
        ['lesson-description'],
      ),
    /outside the lesson/,
  );
  assert.throws(
    () =>
      validateStoryboardForSources(
        {
          ...storyboard,
          scenes: storyboard.scenes.map((scene) => ({ ...scene, sourceRefs: ['resource-image'] })),
        },
        ['lesson-description', 'resource-image'],
        false,
        ['lesson-description'],
      ),
    /not grounded in factual lesson evidence/,
  );
  const captions = createWebVttCaptions(storyboard);
  assert.match(captions, /^WEBVTT/);
  assert.match(captions, /00:00:30\.000 --> 00:01:00\.000/);
  assert.equal(
    hashAudioInput('Narration', 'coral', 'English'),
    hashAudioInput('Narration', 'coral', 'English'),
  );
  assert.notEqual(
    hashAudioInput('Narration', 'coral', 'English'),
    hashAudioInput('Narration', 'sage', 'English'),
  );
  assert.equal(createVideoPromptCacheKey('a'.repeat(77)), 'a'.repeat(64));
  const synchronized = synchronizeStoryboardToAudio(storyboard, [
    { sceneId: 'scene-1', hash: 'one', relativePath: 'one.mp3', durationSeconds: 29.21 },
    { sceneId: 'scene-2', hash: 'two', relativePath: 'two.mp3', durationSeconds: 31.02 },
  ]);
  assert.equal(synchronized.scenes[0]?.durationSeconds, 877 / 30);
  assert.equal(synchronized.scenes[1]?.durationSeconds, 931 / 30);
  assert.match(createWebVttCaptions(synchronized), /00:00:29\.233 --> 00:01:00\.267/);
});

test('video rendering retries transient crashes but fails fast for deterministic asset errors', () => {
  assert.equal(isRetryableRenderFailure(new Error('Renderer process crashed unexpectedly.')), true);
  assert.equal(
    isRetryableRenderFailure(new Error('Received a status code of 404 while downloading narration.')),
    false,
  );
  assert.equal(isRetryableRenderFailure(new Error('Video rendering cancelled.')), false);
  assert.equal(frameConcurrencyForAttempt(0, 3), 3);
  assert.equal(frameConcurrencyForAttempt(1, 3), 2);
  assert.equal(frameConcurrencyForAttempt(2, 3), 1);
  assert.equal(frameConcurrencyForAttempt(1, '50%'), '25%');
});

test('attempt expiry uses the earlier of duration and due date', () => {
  const startedAt = new Date('2026-08-21T10:00:00.000Z');
  const dueDate = new Date('2026-08-21T10:20:00.000Z');
  const window = { startedAt, durationMinutes: 60, dueDate };
  assert.equal(getAssessmentAttemptExpiresAt(window).toISOString(), dueDate.toISOString());
  assert.equal(isAssessmentAttemptExpired(window, dueDate), true);
  assert.equal(getAssessmentAttemptElapsedSeconds(window, new Date('2026-08-21T11:00:00.000Z')), 1200);
});

test('lesson quiz has an explicit passing rule', () => {
  assert.equal(LESSON_QUIZ_PASS_PERCENTAGE, 70);
});

test('trainer content policies include creator and active assigned-group ownership', () => {
  const courseScope = trainerCourseScope('trainer-1');
  const assessmentScope = trainerAssessmentScope('trainer-1');

  assert.deepEqual(courseScope.OR?.[0], { createdById: 'trainer-1' });
  assert.deepEqual(assessmentScope.OR?.[0], { createdById: 'trainer-1' });
  assert.match(JSON.stringify(courseScope), /trainer-1/);
  assert.match(JSON.stringify(assessmentScope), /deletedAt/);
});

test('lesson AI fails closed when evidence is missing or invented', () => {
  const lessonContext = {
    lessonId: 'lesson-1',
    lessonTitle: 'Introduction to Adtech',
    courseName: 'Adtech Foundations',
    moduleName: 'Introduction',
    resources: [],
    groundingSources: [
      { id: 'lesson-description', label: 'Lesson description', content: 'Adtech automates advertising.' },
    ],
  };
  const input = { feature: 'CHAT' as const, lessonContext };

  assert.equal(
    promptManager.parseGuardedResponse(
      JSON.stringify({
        decision: 'ANSWER',
        answer: 'The capital is New Delhi.',
        evidence: ['world-knowledge'],
      }),
      input,
    ).accepted,
    false,
  );
  assert.equal(
    promptManager.parseGuardedResponse(
      JSON.stringify({
        decision: 'ANSWER',
        answer: 'Adtech automates advertising.',
        evidence: ['lesson-description'],
      }),
      input,
    ).accepted,
    true,
  );
});

test('main tutor prompt explicitly refuses unrelated trivia', () => {
  const prompt = promptManager.buildSystemPrompt({ feature: 'CHAT', learningScopeContext: { courses: [] } });
  assert.match(prompt, /capital of India/i);
  const response = promptManager.parseGuardedResponse(
    JSON.stringify({ decision: 'REFUSE', answer: '', evidence: [] }),
    { feature: 'CHAT', learningScopeContext: { courses: [] } },
  );
  assert.match(response.content, /outside your LMS learning scope/i);
});

test('AI provider input redaction removes identifiers and secrets without altering ordinary lesson text', () => {
  const redacted = redactSensitiveText(
    'Adtech lesson. Contact alex@example.com or +1 (212) 555-0199. ' +
      'SSN 123-45-6789, IP 192.168.1.10, api_key=super-secret.',
  );

  assert.match(redacted, /^Adtech lesson\./);
  assert.doesNotMatch(redacted, /alex@example\.com|212|123-45-6789|192\.168\.1\.10|super-secret/);
  assert.match(
    redacted,
    /\[redacted-email\]|\[redacted-phone\]|\[redacted-id\]|\[redacted-ip\]|\[redacted-secret\]/,
  );
});

function mockUpload(buffer: Buffer): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'lesson.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: buffer.length,
    stream: Readable.from(buffer),
    destination: '',
    filename: '',
    path: '',
    buffer,
  };
}

test('upload safety rejects a forged PDF MIME type', async () => {
  const file = mockUpload(Buffer.from('not a pdf'));
  await assert.rejects(() => assertUploadMatchesDeclaredType(file), /contents do not match/i);
});

test('upload safety accepts a real PDF signature', async () => {
  const file = mockUpload(Buffer.from('%PDF-1.7\n'));
  await assert.doesNotReject(() => assertUploadMatchesDeclaredType(file));
});

test('storage copy creates an independent file pointer', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'databeat-storage-test-'));
  try {
    const provider = new LocalStorageProvider(root);
    const source = await provider.save({
      buffer: Buffer.from('course resource'),
      originalName: 'source.txt',
      entityType: 'lesson-resources',
    });
    const copied = await provider.copy(source, 'copy.txt', 'lesson-resources');
    assert.notEqual(copied.relativePath, source.relativePath);

    const chunks: Buffer[] = [];
    for await (const chunk of await provider.getReadStream(copied)) chunks.push(Buffer.from(chunk));
    assert.equal(Buffer.concat(chunks).toString(), 'course resource');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
