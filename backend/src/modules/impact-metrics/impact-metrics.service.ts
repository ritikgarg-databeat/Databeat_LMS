import { LOW_SAMPLE_THRESHOLD, classifyConfidence } from '@/constants/impact-report';
import { TimingObservationsService } from '@/modules/timing-observations/timing-observations.service';
import { BaseService } from '@/services/base.service';
import { ForbiddenError, NotFoundError } from '@/utils/app-error';

import { ImpactMetricsRepository, type UsageLatencySample } from './impact-metrics.repository';
import type {
  Actor,
  DateRangeQuery,
  GradingTurnaroundReport,
  ImpactReport,
  ImpactReportQuery,
  ImpactReportSection,
  PilotDashboardQuery,
  PilotDashboardReport,
  UsageMetricReport,
} from './impact-metrics.types';

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
    : (sorted[mid] as number);
}

/** Number of distinct calendar dates (UTC) a set of timestamps spans — a proxy for "how many
 * separate days was this actually observed on", not just "how many rows exist". */
function spanDays(occurredAt: Date[]): number {
  const days = new Set(occurredAt.map((date) => date.toISOString().slice(0, 10)));
  return days.size;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Business logic for the impact-metrics module — the read-only reporting layer over real usage
 * logs (Measurable Early Impact instrumentation, Tasks 2-4). Every report here is computed live
 * from whatever data currently exists; none of it is cached, projected, or backfilled with a
 * guess. `generateImpactReport` is the only place that decides whether a number has earned the
 * word "validated" — it always defers to `classifyConfidence` (constants/impact-report.ts)
 * rather than checking counts itself.
 */
export class ImpactMetricsService extends BaseService {
  constructor(
    protected readonly repository: ImpactMetricsRepository = new ImpactMetricsRepository(),
    protected readonly timingObservationsService: TimingObservationsService = new TimingObservationsService(),
  ) {
    super();
  }

  async getAutoGradingLatencyReport(query: DateRangeQuery): Promise<UsageMetricReport> {
    const samples = await this.repository.findAutoGradedLatencies(query.from, query.to);
    return this.summarize(samples, query);
  }

  async getAiQuizGenLatencyReport(query: DateRangeQuery): Promise<UsageMetricReport> {
    const samples = await this.repository.findAiQuizGenLatencies(query.from, query.to);
    return this.summarize(samples, query);
  }

  async getCsvImportSpeedReport(query: DateRangeQuery): Promise<UsageMetricReport> {
    const samples = await this.repository.findCsvImportDurations(query.from, query.to);
    return this.summarize(samples, query);
  }

  async getPilotDashboard(query: PilotDashboardQuery, actor: Actor): Promise<PilotDashboardReport> {
    const group = await this.repository.findGroupById(query.groupId);
    if (!group) throw new NotFoundError('Group not found.');
    this.assertGroupAccessible(group, actor);

    const rangeEnd = query.to ? new Date(query.to) : new Date();
    const memberUserIds = await this.repository.findGroupMemberUserIds(query.groupId, rangeEnd);

    const [completions, quizPercentages, manualGradingDurations, activeUserIds] = await Promise.all([
      this.repository.findCompletionsWithQuizStatus(memberUserIds, query.from, query.to),
      this.repository.findSubmittedQuizPercentages(memberUserIds, query.from, query.to),
      this.repository.findManualGradingTurnaround(memberUserIds, query.from, query.to),
      this.repository.findActiveUserIdsInWindow(
        memberUserIds,
        new Date(rangeEnd.getTime() - 7 * 24 * 60 * 60 * 1000),
        rangeEnd,
      ),
    ]);

    const withRequirement = completions.filter((completion) => completion.quizStatus !== null);
    const exceptions = withRequirement.filter((completion) => completion.quizStatus !== 'SUBMITTED');
    const compliantCount = withRequirement.length - exceptions.length;

    return {
      groupId: group.id,
      groupName: group.name,
      dateRangeFrom: query.from ?? null,
      dateRangeTo: query.to ?? null,
      gateCompliance: {
        n: withRequirement.length,
        percentGated: withRequirement.length > 0 ? (compliantCount / withRequirement.length) * 100 : null,
        distinctTrainees: new Set(withRequirement.map((completion) => completion.userId)).size,
        spanDays: spanDays(withRequirement.map((completion) => completion.completedAt)),
        exceptions: exceptions.map((exception) => ({
          lessonId: exception.lessonId,
          lessonTitle: exception.lessonTitle,
          userId: exception.userId,
        })),
      },
      quizPerformance: {
        n: quizPercentages.length,
        averagePercentage: mean(quizPercentages),
        minPercentage: quizPercentages.length ? Math.min(...quizPercentages) : null,
        maxPercentage: quizPercentages.length ? Math.max(...quizPercentages) : null,
      },
      manualGradingTurnaround: this.summarizeDurations(manualGradingDurations),
      weeklyActive: {
        activeCount: activeUserIds.size,
        totalMembers: memberUserIds.length,
        percent: memberUserIds.length > 0 ? (activeUserIds.size / memberUserIds.length) * 100 : null,
      },
    };
  }

  async generateImpactReport(query: ImpactReportQuery, actor: Actor): Promise<ImpactReport> {
    const dateRange = { from: query.from, to: query.to };

    const [timingStats, autoGrading, aiQuizGen, csvImport] = await Promise.all([
      this.timingObservationsService.stats({ createdAtFrom: query.from, createdAtTo: query.to }, actor),
      this.repository.findAutoGradedLatencies(query.from, query.to),
      this.repository.findAiQuizGenLatencies(query.from, query.to),
      this.repository.findCsvImportDurations(query.from, query.to),
    ]);

    const pilotDashboard = query.groupId
      ? await this.getPilotDashboard({ groupId: query.groupId, ...dateRange }, actor)
      : null;

    const sections: ImpactReportSection[] = [];

    const timingConfidence = classifyConfidence(
      timingStats.n,
      timingStats.distinctTrainers,
      // Timing observations have no per-row timestamp span computed yet at this layer — the
      // stats method doesn't return individual createdAt values, so days-observed can't be
      // derived here without a second query; treat every non-zero n as at least 1 day observed
      // (the true value can only be higher, never lower, so this never over-credits "validated").
      timingStats.n > 0 ? 1 : 0,
    );
    sections.push({
      key: 'manual_vs_ai_quiz_time',
      label: 'Manual quiz-writing vs. AI-assisted review (trainer-timed)',
      confidence: timingConfidence,
      n: timingStats.n,
      summary:
        timingStats.n === 0
          ? 'insufficient data — not yet measured'
          : `Saved ${formatDuration((timingStats.saved.mean ?? 0) * 1000)} on average per lesson ` +
            `(manual mean ${formatDuration((timingStats.manual.mean ?? 0) * 1000)}, AI-assisted mean ` +
            `${formatDuration((timingStats.aiAssisted.mean ?? 0) * 1000)}), n=${timingStats.n} observation(s) ` +
            `across ${timingStats.distinctTrainers} trainer(s), ${timingStats.distinctLessons} lesson(s).`,
    });

    sections.push(
      this.usageSection('auto_grading_latency', 'Auto-grading turnaround', autoGrading, dateRange),
    );
    sections.push(
      this.usageSection('ai_quiz_gen_latency', 'AI quiz generation latency', aiQuizGen, dateRange),
    );
    sections.push(this.usageSection('csv_import_speed', 'Bulk CSV import speed', csvImport, dateRange));

    if (pilotDashboard) {
      const gateConfidence = classifyConfidence(
        pilotDashboard.gateCompliance.n,
        pilotDashboard.gateCompliance.distinctTrainees,
        pilotDashboard.gateCompliance.spanDays,
      );
      sections.push({
        key: 'pilot_gate_compliance',
        label: `Pilot cohort "${pilotDashboard.groupName}" — quiz-gate compliance`,
        confidence: gateConfidence,
        n: pilotDashboard.gateCompliance.n,
        summary:
          pilotDashboard.gateCompliance.n === 0
            ? 'insufficient data — not yet measured'
            : `${pilotDashboard.gateCompliance.percentGated?.toFixed(1)}% of gated completions had a submitted quiz ` +
              `(n=${pilotDashboard.gateCompliance.n})` +
              (pilotDashboard.gateCompliance.exceptions.length > 0
                ? ` — ${pilotDashboard.gateCompliance.exceptions.length} exception(s) flagged, see dashboard.`
                : '.'),
      });
    }

    const markdown = this.renderMarkdown(sections, dateRange);
    return { dateRangeFrom: dateRange.from ?? null, dateRangeTo: dateRange.to ?? null, sections, markdown };
  }

  private usageSection(
    key: string,
    label: string,
    samples: UsageLatencySample[],
    dateRange: DateRangeQuery,
  ): ImpactReportSection {
    const report = this.summarize(samples, dateRange);
    const distinctActors = new Set(samples.map((sample) => sample.actorId)).size;
    const confidence = classifyConfidence(
      report.n,
      distinctActors,
      spanDays(samples.map((sample) => sample.occurredAt)),
    );

    return {
      key,
      label,
      confidence,
      n: report.n,
      summary:
        report.n === 0
          ? 'insufficient data — not yet measured'
          : `Mean ${formatDuration(report.meanMs ?? 0)}, median ${formatDuration(report.medianMs ?? 0)} ` +
            `(range ${formatDuration(report.minMs ?? 0)}–${formatDuration(report.maxMs ?? 0)}), n=${report.n}` +
            (report.dateRangeFrom && report.dateRangeTo
              ? `, ${report.dateRangeFrom.slice(0, 10)} to ${report.dateRangeTo.slice(0, 10)}`
              : '') +
            (report.lowSampleWarning ? ' — low sample size.' : '.'),
    };
  }

  private summarize(samples: UsageLatencySample[], query: DateRangeQuery): UsageMetricReport {
    const durations = samples.map((sample) => sample.durationMs);
    const occurredDates = samples.map((sample) => sample.occurredAt);

    const effectiveFrom =
      query.from ??
      (occurredDates.length
        ? new Date(Math.min(...occurredDates.map((d) => d.getTime()))).toISOString()
        : null);
    const effectiveTo =
      query.to ??
      (occurredDates.length
        ? new Date(Math.max(...occurredDates.map((d) => d.getTime()))).toISOString()
        : null);

    return {
      n: durations.length,
      dateRangeFrom: effectiveFrom,
      dateRangeTo: effectiveTo,
      meanMs: mean(durations),
      medianMs: median(durations),
      minMs: durations.length ? Math.min(...durations) : null,
      maxMs: durations.length ? Math.max(...durations) : null,
      lowSampleWarning: durations.length < LOW_SAMPLE_THRESHOLD,
    };
  }

  /** Mirrors reports.service.ts#resolveScopedGroupIds / analytics.service.ts's group-ownership check
   * (Prompt 8 § SECURITY) — a TRAINER may only view pilot-dashboard/impact-report data for groups
   * they own; a SUPER_ADMIN may view any group. Without this, any authenticated TRAINER could pull
   * another trainer's cohort data (including per-trainee userId/lessonId gate-compliance exceptions)
   * by guessing/enumerating a groupId. */
  private assertGroupAccessible(group: { trainerId: string | null }, actor: Actor): void {
    if (actor.role === 'SUPER_ADMIN') return;
    if (group.trainerId !== actor.id) {
      throw new ForbiddenError("You don't have permission to view this group's pilot dashboard.");
    }
  }

  private summarizeDurations(durations: number[]): GradingTurnaroundReport {
    return {
      n: durations.length,
      meanMs: mean(durations),
      medianMs: median(durations),
      minMs: durations.length ? Math.min(...durations) : null,
      maxMs: durations.length ? Math.max(...durations) : null,
      lowSampleWarning: durations.length < LOW_SAMPLE_THRESHOLD,
    };
  }

  private renderMarkdown(sections: ImpactReportSection[], dateRange: DateRangeQuery): string {
    const header = `# Impact Report\n\nGenerated from live application data${
      dateRange.from || dateRange.to
        ? ` for the range ${dateRange.from ?? 'the beginning'} to ${dateRange.to ?? 'now'}`
        : ' (all time)'
    }.\n\nEvery figure below is labeled by how much confidence it has actually earned — **validated** only once enough\nreal, independent observations exist; **measured** when it's real but not yet broad enough; **insufficient data**\nwhen nothing has been observed yet. No figure here is a projection.\n`;

    const body = sections
      .map(
        (section) =>
          `\n## ${section.label}\n\n**Confidence: ${section.confidence.toUpperCase()}** (n=${section.n})\n\n${section.summary}\n`,
      )
      .join('\n');

    return header + body;
  }
}
