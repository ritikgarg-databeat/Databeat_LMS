import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';

import { LESSON_QUIZ_PASS_PERCENTAGE } from '@/constants/lesson-quiz';
import { promptManager } from '@/modules/ai/prompt-manager';
import { activeGroupMembershipWhere, activeGroupScope } from '@/policies/group-access.policy';
import { trainerAssessmentScope, trainerCourseScope } from '@/policies/trainer-scope.policy';
import { LocalStorageProvider } from '@/storage/local-storage.provider';
import {
  getAssessmentAttemptElapsedSeconds,
  getAssessmentAttemptExpiresAt,
  isAssessmentAttemptExpired,
} from '@/utils/assessment-attempt-time.util';
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
      JSON.stringify({ decision: 'ANSWER', answer: 'The capital is New Delhi.', evidence: ['world-knowledge'] }),
      input,
    ).accepted,
    false,
  );
  assert.equal(
    promptManager.parseGuardedResponse(
      JSON.stringify({ decision: 'ANSWER', answer: 'Adtech automates advertising.', evidence: ['lesson-description'] }),
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
  assert.match(redacted, /\[redacted-email\]|\[redacted-phone\]|\[redacted-id\]|\[redacted-ip\]|\[redacted-secret\]/);
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
