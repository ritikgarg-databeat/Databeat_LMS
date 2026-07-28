import type { Role } from '@prisma/client';

import type { ImpactConfidence } from '@/constants/impact-report';

/** The authenticated caller (`req.user`). Routes gate on TRAINER/SUPER_ADMIN before any service
 * method runs; group-scoped methods additionally restrict a TRAINER to their own groups (see
 * ImpactMetricsService#assertGroupAccessible), mirroring reports.service.ts's resolveScopedGroupIds. */
export interface Actor {
  id: string;
  role: Role;
}

export interface DateRangeQuery {
  from?: string;
  to?: string;
}

/** Every usage-log-derived report (auto-grading latency, AI quiz-gen latency, CSV import speed)
 * shares this exact shape — n and the date range actually used are always rendered alongside the
 * mean, never just the number alone. Explicit `null`s when `n` is 0, never a placeholder. */
export interface UsageMetricReport {
  n: number;
  dateRangeFrom: string | null;
  dateRangeTo: string | null;
  meanMs: number | null;
  medianMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  lowSampleWarning: boolean;
}

export interface PilotDashboardQuery {
  groupId: string;
  from?: string;
  to?: string;
}

export interface GateComplianceException {
  lessonId: string;
  lessonTitle: string;
  userId: string;
}

export interface GateComplianceReport {
  /** Completions whose lesson actually had a generated quiz to gate on. */
  n: number;
  percentGated: number | null;
  distinctTrainees: number;
  spanDays: number;
  exceptions: GateComplianceException[];
}

export interface LessonQuizPerformanceReport {
  n: number;
  averagePercentage: number | null;
  minPercentage: number | null;
  maxPercentage: number | null;
}

export interface GradingTurnaroundReport {
  n: number;
  meanMs: number | null;
  medianMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  lowSampleWarning: boolean;
}

export interface WeeklyActiveReport {
  activeCount: number;
  totalMembers: number;
  percent: number | null;
}

export interface PilotDashboardReport {
  groupId: string;
  groupName: string;
  dateRangeFrom: string | null;
  dateRangeTo: string | null;
  gateCompliance: GateComplianceReport;
  quizPerformance: LessonQuizPerformanceReport;
  manualGradingTurnaround: GradingTurnaroundReport;
  weeklyActive: WeeklyActiveReport;
}

export interface ImpactReportQuery {
  from?: string;
  to?: string;
  groupId?: string;
}

export interface ImpactReportSection {
  key: string;
  label: string;
  confidence: ImpactConfidence;
  n: number;
  summary: string;
}

export interface ImpactReport {
  dateRangeFrom: string | null;
  dateRangeTo: string | null;
  sections: ImpactReportSection[];
  markdown: string;
}
