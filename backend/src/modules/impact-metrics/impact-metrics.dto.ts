export interface DateRangeQueryDto {
  from?: string;
  to?: string;
}

export interface PilotDashboardQueryDto {
  groupId: string;
  from?: string;
  to?: string;
}

export interface ImpactReportQueryDto {
  from?: string;
  to?: string;
  groupId?: string;
}
