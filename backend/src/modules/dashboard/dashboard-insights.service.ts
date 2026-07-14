import type { AnalyticsInsightSource } from '@prisma/client';

import { ANALYTICS_SNAPSHOT_TTL_MS } from '@/constants/analytics';
import {
  MAX_AI_INSIGHTS,
  MIN_WRONG_ANSWERS_FOR_WEAK_TOPIC,
  QUESTION_CATEGORY_LABELS,
} from '@/constants/dashboard-insights';
import { aiProvider } from '@/modules/ai';
import type { GroupAnalyticsDetail, UserAnalytics } from '@/modules/analytics';
import { BaseService } from '@/services/base.service';
import { logger } from '@/utils/logger';

import { DashboardRepository } from './dashboard.repository';
import type { AnalyticsInsight, AnalyticsInsights } from './dashboard.types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const AI_SYSTEM_PROMPT =
  'You are an insights generator embedded in an LMS dashboard. You will be given a compact ' +
  'summary of learning-performance data. Respond with 1 to 3 short, actionable tips derived ' +
  "ONLY from the data given — never invent specifics (e.g. a topic name) that isn't in the " +
  'summary. Plain text only: no markdown, no numbering, no preamble/closing remarks — exactly ' +
  'one tip per line and nothing else.';

/**
 * AI-generated (with graceful heuristic fallback) recommendations for the trainee dashboard
 * (`scopeType: 'USER'`) and trainer dashboard (`scopeType: 'GROUP'`), cached in the
 * `AnalyticsInsight` table with a TTL, same freshness pattern as the analytics module's
 * snapshot tables (`ANALYTICS_SNAPSHOT_TTL_MS`).
 *
 * KNOWN LIMITATION — weak-topic specificity: neither `UserAnalytics` nor `GroupAnalyticsDetail`
 * carries per-topic performance data, and `Question.category` (PYTHON, SQL, STATISTICS, ...) is
 * the finest-grained tag the schema has — there is no sub-topic tagging (e.g. no way to single
 * out "SQL joins" within "SQL"). Rather than fabricate that precision, `WEAK_TOPIC` insights
 * here are real but category-level: derived from the scope's own wrong `AssessmentAnswer` rows
 * joined to their bank `Question.category` (see dashboard.repository.ts#findWrongAnswerCategoriesForUsers),
 * surfaced only once a category crosses `MIN_WRONG_ANSWERS_FOR_WEAK_TOPIC` wrong answers so a
 * single unlucky question doesn't produce a misleadingly confident claim.
 */
export class DashboardInsightsService extends BaseService {
  constructor(protected readonly repository: DashboardRepository = new DashboardRepository()) {
    super();
  }

  /** Trainee-dashboard recommendations — cached per user (`scopeType: 'USER'`). */
  async getUserInsights(userId: string, userAnalytics: UserAnalytics): Promise<AnalyticsInsights> {
    const cached = await this.repository.findInsight('USER', userId);
    if (cached && this.isFresh(cached.generatedAt)) return this.toAnalyticsInsights(cached);

    const weakCategory = await this.findWeakCategory([userId]);
    const heuristics = this.buildUserHeuristics(userAnalytics, weakCategory);
    const result = await this.generateOrFallback(heuristics, this.buildUserPrompt(userAnalytics, weakCategory));

    await this.repository.upsertInsight('USER', userId, result);
    return { ...result, generatedAt: new Date() };
  }

  /** Trainer-dashboard recommendations — cached per group (`scopeType: 'GROUP'`). */
  async getGroupInsights(groupId: string, groupDetail: GroupAnalyticsDetail): Promise<AnalyticsInsights> {
    const cached = await this.repository.findInsight('GROUP', groupId);
    if (cached && this.isFresh(cached.generatedAt)) return this.toAnalyticsInsights(cached);

    const memberIds = groupDetail.members.map((member) => member.userId);
    const weakCategory = await this.findWeakCategory(memberIds);
    const heuristics = this.buildGroupHeuristics(groupDetail, weakCategory);
    const result = await this.generateOrFallback(heuristics, this.buildGroupPrompt(groupDetail, weakCategory));

    await this.repository.upsertInsight('GROUP', groupId, result);
    return { ...result, generatedAt: new Date() };
  }

  // --- Cache freshness -------------------------------------------------------------------------

  private isFresh(generatedAt: Date): boolean {
    return Date.now() - generatedAt.getTime() < ANALYTICS_SNAPSHOT_TTL_MS;
  }

  private toAnalyticsInsights(row: { insights: unknown; source: AnalyticsInsightSource; generatedAt: Date }): AnalyticsInsights {
    return {
      source: row.source,
      generatedAt: row.generatedAt,
      insights: row.insights as unknown as AnalyticsInsight[],
    };
  }

  // --- AI generation, with graceful heuristic fallback ------------------------------------------

  /**
   * Tries the AI provider; on ANY failure (503 when unconfigured — this environment has no
   * ANTHROPIC_API_KEY set — timeout, empty/unparseable response, anything) falls back to the
   * already-computed heuristic insights. Never throws.
   */
  private async generateOrFallback(
    heuristics: AnalyticsInsight[],
    userMessage: string,
  ): Promise<{ insights: AnalyticsInsight[]; source: AnalyticsInsightSource }> {
    try {
      const output = await aiProvider.chat({ systemPrompt: AI_SYSTEM_PROMPT, history: [], userMessage });
      const lines = output.content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, MAX_AI_INSIGHTS);
      if (lines.length === 0) throw new Error('AI insights response had no usable lines.');

      const insights: AnalyticsInsight[] = lines.map((text) => ({ kind: 'GENERAL', text }));
      return { insights, source: 'AI' };
    } catch (error) {
      logger.warn('AI insight generation unavailable, falling back to heuristic insights.', { error });
      return { insights: heuristics, source: 'HEURISTIC' };
    }
  }

  // --- Weak-topic signal (real, category-level — see class doc comment) ------------------------

  private async findWeakCategory(userIds: string[]): Promise<{ label: string; count: number } | null> {
    const rows = await this.repository.findWrongAnswerCategoriesForUsers(userIds);
    if (!rows.length) return null;

    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = row.category ?? 'UNKNOWN';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    let topKey: string | null = null;
    let topCount = 0;
    for (const [key, count] of [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (count > topCount) {
        topKey = key;
        topCount = count;
      }
    }

    if (topKey === null || topCount < MIN_WRONG_ANSWERS_FOR_WEAK_TOPIC) return null;
    const label = QUESTION_CATEGORY_LABELS[topKey as keyof typeof QUESTION_CATEGORY_LABELS] ?? topKey;
    return { label, count: topCount };
  }

  // --- Heuristic insights (also the AI-unavailable fallback) -------------------------------------

  /**
   * Every claim here is directly derivable from `UserAnalytics` (already computed by the
   * analytics module) plus the real weak-category signal above — no fabricated specifics.
   */
  private buildUserHeuristics(
    userAnalytics: UserAnalytics,
    weakCategory: { label: string; count: number } | null,
  ): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];
    const { performance, streakDays, recentAttempts } = userAnalytics;

    if (weakCategory) {
      insights.push({
        kind: 'WEAK_TOPIC',
        text: `You've gotten ${weakCategory.count} ${weakCategory.label} questions wrong recently — worth revisiting before your next assessment.`,
      });
    }

    if (performance.averageScore !== null && performance.averageScore < performance.completionPercentage - 15) {
      insights.push({
        kind: 'GENERAL',
        text: `Your average assessment score (${performance.averageScore}%) is well below your course completion (${performance.completionPercentage}%) — consider revisiting recent lessons before your next attempt.`,
      });
    }

    const lastAttempt = recentAttempts[0];
    const daysSinceLastAttempt = lastAttempt?.submittedAt
      ? Math.floor((Date.now() - lastAttempt.submittedAt.getTime()) / MS_PER_DAY)
      : null;
    if (daysSinceLastAttempt === null || daysSinceLastAttempt >= 14) {
      insights.push({
        kind: 'SUGGESTED_ASSESSMENT',
        text: "You haven't taken an assessment in over two weeks — take one soon to keep your skills sharp.",
      });
    }

    if (streakDays >= 5) {
      insights.push({ kind: 'GENERAL', text: `You're on a ${streakDays}-day learning streak — keep it going!` });
    }

    if (insights.length === 0) {
      insights.push({
        kind: 'GENERAL',
        text:
          performance.completionPercentage >= 80
            ? "Great progress — you're on track. Keep up the consistent effort."
            : 'Keep going — steady, regular study sessions add up over time.',
      });
    }

    return insights.slice(0, MAX_AI_INSIGHTS);
  }

  /** Same honesty rule as `buildUserHeuristics`, over `GroupAnalyticsDetail` instead. */
  private buildGroupHeuristics(
    groupDetail: GroupAnalyticsDetail,
    weakCategory: { label: string; count: number } | null,
  ): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];
    const { group, summary } = groupDetail;

    if (weakCategory) {
      insights.push({
        kind: 'WEAK_TOPIC',
        text: `${group.name} is struggling with ${weakCategory.label} — ${weakCategory.count} wrong answers across the group recently. Consider a refresher session.`,
      });
    }

    if (summary.completionPercentage < 50) {
      insights.push({
        kind: 'GENERAL',
        text: `${group.name}'s completion rate is ${summary.completionPercentage}%, below the 50% target — check in with trainees who have stalled.`,
      });
    }

    if (summary.averageScore !== null && summary.averageScore < 60) {
      insights.push({
        kind: 'GENERAL',
        text: `${group.name}'s average assessment score is ${summary.averageScore}%, below the 60% target.`,
      });
    }

    const activeRatio = summary.traineeCount === 0 ? 1 : summary.activeUsers7d / summary.traineeCount;
    if (activeRatio < 0.5) {
      insights.push({
        kind: 'GENERAL',
        text: `Only ${summary.activeUsers7d} of ${summary.traineeCount} trainees in ${group.name} were active in the last 7 days.`,
      });
    }

    if (insights.length === 0) {
      insights.push({
        kind: 'GENERAL',
        text: `${group.name} is performing well — completion ${summary.completionPercentage}%, average score ${summary.averageScore ?? 'N/A'}.`,
      });
    }

    return insights.slice(0, MAX_AI_INSIGHTS);
  }

  // --- AI prompts (compact data summaries only — no history, no persisted conversation) --------

  private buildUserPrompt(userAnalytics: UserAnalytics, weakCategory: { label: string; count: number } | null): string {
    const { performance, streakDays, recentAttempts } = userAnalytics;
    const recentScores = recentAttempts
      .slice(0, 5)
      .map((attempt) => attempt.percentage)
      .filter((value): value is number => value !== null);

    const lines = [
      `Course completion: ${performance.completionPercentage}%`,
      `Average assessment score: ${performance.averageScore ?? 'no attempts yet'}`,
      `Assessments taken: ${performance.assessmentsTaken}, passed: ${performance.assessmentsPassed}`,
      `Recent attempt scores (newest first): ${recentScores.length ? recentScores.join(', ') : 'none'}`,
      `Current learning streak: ${streakDays} day(s)`,
      weakCategory
        ? `Most frequent wrong-answer category: ${weakCategory.label} (${weakCategory.count} wrong answers)`
        : 'No standout wrong-answer category yet.',
    ];
    return lines.join('\n');
  }

  private buildGroupPrompt(
    groupDetail: GroupAnalyticsDetail,
    weakCategory: { label: string; count: number } | null,
  ): string {
    const { group, summary } = groupDetail;
    const lines = [
      `Group: ${group.name}`,
      `Trainee count: ${summary.traineeCount}`,
      `Average completion: ${summary.completionPercentage}%`,
      `Average assessment score: ${summary.averageScore ?? 'no attempts yet'}`,
      `Active in last 7 days: ${summary.activeUsers7d} of ${summary.traineeCount}`,
      weakCategory
        ? `Most frequent wrong-answer category across the group: ${weakCategory.label} (${weakCategory.count} wrong answers)`
        : 'No standout wrong-answer category yet.',
    ];
    return lines.join('\n');
  }
}

export const dashboardInsightsService = new DashboardInsightsService();
