import { AssessmentAttemptsService } from '@/modules/assessment-attempts/assessment-attempts.service';
import { logger } from '@/utils/logger';

const assessmentAttemptsService = new AssessmentAttemptsService();

/** Finalizes saved answers for attempts whose server-authoritative timer has expired. */
export async function runExpiredAssessmentAttemptsJob(): Promise<void> {
  try {
    const result = await assessmentAttemptsService.finalizeExpiredAttempts();
    if (result.found > 0) logger.info('Expired assessment attempts job completed', result);
  } catch (error) {
    logger.error('Expired assessment attempts job failed', { error });
  }
}
