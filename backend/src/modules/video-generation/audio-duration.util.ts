export async function measureMp3DurationSeconds(audio: Uint8Array): Promise<number> {
  const { parseBuffer } = await import('music-metadata');
  const metadata = await parseBuffer(audio, 'audio/mpeg', { duration: true });
  const duration = metadata.format.duration;
  if (!duration || !Number.isFinite(duration) || duration <= 0) {
    throw new Error('The generated narration audio duration could not be measured.');
  }
  return duration;
}
