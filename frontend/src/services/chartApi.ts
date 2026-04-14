import type { AxiosInstance } from 'axios';
import type {
  ChartRangePreset,
  ChartSeriesPayload,
} from '../types/chartOverview';

async function chartGet<T>(
  axiosInstance: AxiosInstance,
  path: string,
  params: { languageCode: string; timezone: string; range: ChartRangePreset }
): Promise<T> {
  const { data } = await axiosInstance.get<T>(path, {
    params: {
      languageCode: params.languageCode,
      timezone: params.timezone,
      range: params.range,
    },
  });
  return data;
}

export function fetchDailyScoreChart(
  axiosInstance: AxiosInstance,
  params: { languageCode: string; timezone: string; range: ChartRangePreset }
): Promise<ChartSeriesPayload> {
  return chartGet<ChartSeriesPayload>(
    axiosInstance,
    '/api/charts/daily-score',
    params
  );
}

export function fetchCumulativeScoreChart(
  axiosInstance: AxiosInstance,
  params: { languageCode: string; timezone: string; range: ChartRangePreset }
): Promise<ChartSeriesPayload> {
  return chartGet<ChartSeriesPayload>(
    axiosInstance,
    '/api/charts/cumulative-score',
    params
  );
}

export function fetchLearnedWordsChart(
  axiosInstance: AxiosInstance,
  params: { languageCode: string; timezone: string; range: ChartRangePreset }
): Promise<ChartSeriesPayload & { totalLearnedWords: number }> {
  return chartGet<ChartSeriesPayload & { totalLearnedWords: number }>(
    axiosInstance,
    '/api/charts/learned-words',
    params
  );
}

export function fetchLearnedPerDayChart(
  axiosInstance: AxiosInstance,
  params: { languageCode: string; timezone: string; range: ChartRangePreset }
): Promise<ChartSeriesPayload> {
  return chartGet<ChartSeriesPayload>(
    axiosInstance,
    '/api/charts/learned-per-day',
    params
  );
}

export function fetchReadWordsPerDayChart(
  axiosInstance: AxiosInstance,
  params: { languageCode: string; timezone: string; range: ChartRangePreset }
): Promise<ChartSeriesPayload> {
  return chartGet<ChartSeriesPayload>(
    axiosInstance,
    '/api/charts/read-words-per-day',
    params
  );
}
