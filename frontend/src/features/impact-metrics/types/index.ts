export interface DateRangeFilters {
  from?: string;
  to?: string;
}

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

export interface PilotDashboardParams {
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

export interface ImpactReportParams {
  from?: string;
  to?: string;
  groupId?: string;
}

export type ImpactConfidence = 'validated' | 'measured' | 'insufficient';

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
