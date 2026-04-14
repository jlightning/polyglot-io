export type ChartRangePreset = '30d' | '90d' | '180d' | '365d' | 'all';

export interface ChartRangeMeta {
  startDate: string;
  endDate: string;
  preset: ChartRangePreset;
}

export interface ChartDayPoint {
  date: string;
  value: number;
}

export interface ChartSeriesPayload {
  series: ChartDayPoint[];
  range: ChartRangeMeta;
}
