import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { UserActionType } from '@prisma/client';

import type { Context } from './index';

dayjs.extend(utc);
dayjs.extend(timezone);

export const CHART_RANGE_VALUES = [
  '30d',
  '90d',
  '180d',
  '365d',
  'all',
] as const;

export type ChartRangePreset = (typeof CHART_RANGE_VALUES)[number];

export interface ChartRangeMeta {
  startDate: string;
  endDate: string;
  preset: ChartRangePreset;
}

/** One point per day for all chart series (Recharts uses `value`). */
export interface ChartDayPoint {
  date: string;
  value: number;
}

export interface ChartSeriesPayload {
  series: ChartDayPoint[];
  range: ChartRangeMeta;
}

const MAX_ALL_TIME_YEARS = 10;

/** UTC bounds for DB filters + local calendar day keys (inclusive). */
type ChartWindow = {
  startUtc: Date;
  endUtc: Date;
  days: string[];
};

function parseChartRange(value: string | undefined): ChartRangePreset {
  if (
    value &&
    (CHART_RANGE_VALUES as readonly string[]).includes(
      value as ChartRangePreset
    )
  ) {
    return value as ChartRangePreset;
  }
  return '30d';
}

function safeTimezone(tz: string | undefined): string {
  if (!tz || tz.trim() === '') return 'UTC';
  if (!/^[A-Za-z0-9_/+-]+$/.test(tz)) return 'UTC';
  try {
    dayjs().tz(tz).format();
    return tz;
  } catch {
    return 'UTC';
  }
}

function dayBounds(days: string[]): { startDate: string; endDate: string } {
  if (days.length === 0) {
    const d = dayjs().format('YYYY-MM-DD');
    return { startDate: d, endDate: d };
  }
  return { startDate: days[0]!, endDate: days[days.length - 1]! };
}

function rangeMetaFromDays(
  days: string[],
  preset: ChartRangePreset
): ChartRangeMeta {
  const { startDate, endDate } = dayBounds(days);
  return { startDate, endDate, preset };
}

function seriesFromMap(
  daysList: string[],
  counts: Map<string, number>
): ChartDayPoint[] {
  return daysList.map(date => ({
    date,
    value: counts.get(date) || 0,
  }));
}

function aggregateWordMarkDeltaByDay(
  rows: { created_at: Date; action: unknown }[],
  tz: string
): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const action = row.action as { new_mark?: number; old_mark?: number };
    const newMark = Number(action?.new_mark);
    const oldMark = Number(action?.old_mark);
    if (Number.isNaN(newMark) || Number.isNaN(oldMark)) continue;
    const day = dayjs(row.created_at).tz(tz).format('YYYY-MM-DD');
    byDay.set(day, (byDay.get(day) || 0) + (newMark - oldMark));
  }
  return byDay;
}

async function resolveWindowBounds(
  ctx: Context,
  userId: number,
  languageCode: string,
  tz: string,
  range: ChartRangePreset
): Promise<ChartWindow> {
  const nowInTz = dayjs().tz(tz);
  let startInTz: dayjs.Dayjs;

  if (range === 'all') {
    const earliest = await ctx.prisma.userActionLog.findFirst({
      where: {
        user_id: userId,
        language_code: languageCode,
        type: UserActionType.word_mark,
      },
      orderBy: { created_at: 'asc' },
      select: { created_at: true },
    });
    const capStart = nowInTz
      .subtract(MAX_ALL_TIME_YEARS, 'year')
      .startOf('day');
    if (!earliest) {
      startInTz = nowInTz.startOf('day');
    } else {
      startInTz = dayjs(earliest.created_at).tz(tz).startOf('day');
      if (startInTz.isBefore(capStart)) startInTz = capStart;
    }
  } else {
    const spanDays =
      range === '30d'
        ? 30
        : range === '90d'
          ? 90
          : range === '180d'
            ? 180
            : 365;
    startInTz = nowInTz.subtract(spanDays - 1, 'day').startOf('day');
  }

  const days: string[] = [];
  for (
    let d = startInTz.clone();
    !d.isAfter(nowInTz, 'day');
    d = d.add(1, 'day')
  ) {
    days.push(d.format('YYYY-MM-DD'));
  }

  return {
    startUtc: startInTz.utc().toDate(),
    endUtc: nowInTz.endOf('day').utc().toDate(),
    days,
  };
}

async function queryFirstKnownTransitions(
  ctx: Context,
  userId: number,
  languageCode: string
) {
  return ctx.prisma.$queryRaw<{ word_id: bigint | number; first_at: Date }[]>`
    SELECT
      CAST(JSON_EXTRACT(action, '$.word_id') AS UNSIGNED) AS word_id,
      MIN(created_at) AS first_at
    FROM user_action_log
    WHERE user_id = ${userId}
      AND language_code = ${languageCode}
      AND type = ${UserActionType.word_mark}
      AND CAST(JSON_EXTRACT(action, '$.new_mark') AS SIGNED) >= 4
      AND CAST(JSON_EXTRACT(action, '$.old_mark') AS SIGNED) < 4
    GROUP BY CAST(JSON_EXTRACT(action, '$.word_id') AS UNSIGNED)
  `;
}

function learnedFirstByDayInWindow(
  transitionRows: { first_at: Date }[],
  tz: string,
  days: string[]
): Map<string, number> {
  const { startDate, endDate } = dayBounds(days);
  const byDay = new Map<string, number>();
  for (const row of transitionRows) {
    const day = dayjs(row.first_at).tz(tz).format('YYYY-MM-DD');
    if (day < startDate || day > endDate) continue;
    byDay.set(day, (byDay.get(day) || 0) + 1);
  }
  return byDay;
}

export class ChartService {
  async getDailyScoreChart(
    ctx: Context,
    userId: number,
    languageCode: string,
    userTimezone: string | undefined,
    rangeInput: string | undefined
  ): Promise<ChartSeriesPayload> {
    const range = parseChartRange(rangeInput);
    const tz = safeTimezone(userTimezone);
    const w = await resolveWindowBounds(ctx, userId, languageCode, tz, range);
    const markRows = await ctx.prisma.userActionLog.findMany({
      where: {
        user_id: userId,
        language_code: languageCode,
        type: UserActionType.word_mark,
        created_at: { gte: w.startUtc, lte: w.endUtc },
      },
      select: { created_at: true, action: true },
      orderBy: { created_at: 'asc' },
    });
    const byDay = aggregateWordMarkDeltaByDay(markRows, tz);
    return {
      series: seriesFromMap(w.days, byDay),
      range: rangeMetaFromDays(w.days, range),
    };
  }

  async getCumulativeScoreChart(
    ctx: Context,
    userId: number,
    languageCode: string,
    userTimezone: string | undefined,
    rangeInput: string | undefined
  ): Promise<ChartSeriesPayload> {
    const range = parseChartRange(rangeInput);
    const tz = safeTimezone(userTimezone);
    const w = await resolveWindowBounds(ctx, userId, languageCode, tz, range);
    const [markRows, scoreBeforeRows] = await Promise.all([
      ctx.prisma.userActionLog.findMany({
        where: {
          user_id: userId,
          language_code: languageCode,
          type: UserActionType.word_mark,
          created_at: { gte: w.startUtc, lte: w.endUtc },
        },
        select: { created_at: true, action: true },
        orderBy: { created_at: 'asc' },
      }),
      ctx.prisma.$queryRaw<{ total_score: number }[]>`
        SELECT COALESCE(SUM(
          CAST(JSON_EXTRACT(action, '$.new_mark') AS SIGNED) -
          CAST(JSON_EXTRACT(action, '$.old_mark') AS SIGNED)
        ), 0) AS total_score
        FROM user_action_log ual
        WHERE ual.user_id = ${userId}
          AND ual.language_code = ${languageCode}
          AND ual.type = ${UserActionType.word_mark}
          AND ual.created_at < ${w.startUtc}
      `,
    ]);
    const byDay = aggregateWordMarkDeltaByDay(markRows, tz);
    const baseline = Number(scoreBeforeRows[0]?.total_score ?? 0);
    let run = 0;
    const series: ChartDayPoint[] = w.days.map(date => {
      run += byDay.get(date) || 0;
      return { date, value: baseline + run };
    });
    return {
      series,
      range: rangeMetaFromDays(w.days, range),
    };
  }

  async getLearnedWordsChart(
    ctx: Context,
    userId: number,
    languageCode: string,
    userTimezone: string | undefined,
    rangeInput: string | undefined
  ): Promise<ChartSeriesPayload & { totalLearnedWords: number }> {
    const range = parseChartRange(rangeInput);
    const tz = safeTimezone(userTimezone);
    const w = await resolveWindowBounds(ctx, userId, languageCode, tz, range);
    const [totalLearnedWords, transitionRows] = await Promise.all([
      ctx.prisma.wordUserMark.count({
        where: {
          user_id: userId,
          mark: { in: [4, 5] },
          word: { language_code: languageCode },
        },
      }),
      queryFirstKnownTransitions(ctx, userId, languageCode),
    ]);
    const baselineLog = transitionRows.filter(
      r => r.first_at < w.startUtc
    ).length;
    const learnedByDay = learnedFirstByDayInWindow(transitionRows, tz, w.days);
    const sumWindow = w.days.reduce(
      (a, d) => a + (learnedByDay.get(d) || 0),
      0
    );
    const loggedThroughEnd = baselineLog + sumWindow;
    const extraBaseline = Math.max(0, totalLearnedWords - loggedThroughEnd);

    let run = 0;
    const series: ChartDayPoint[] = w.days.map(date => {
      run += learnedByDay.get(date) || 0;
      return {
        date,
        value: baselineLog + extraBaseline + run,
      };
    });
    return {
      totalLearnedWords,
      series,
      range: rangeMetaFromDays(w.days, range),
    };
  }

  async getLearnedPerDayChart(
    ctx: Context,
    userId: number,
    languageCode: string,
    userTimezone: string | undefined,
    rangeInput: string | undefined
  ): Promise<ChartSeriesPayload> {
    const range = parseChartRange(rangeInput);
    const tz = safeTimezone(userTimezone);
    const w = await resolveWindowBounds(ctx, userId, languageCode, tz, range);
    const transitionRows = await queryFirstKnownTransitions(
      ctx,
      userId,
      languageCode
    );
    const learnedByDay = learnedFirstByDayInWindow(transitionRows, tz, w.days);
    return {
      series: seriesFromMap(w.days, learnedByDay),
      range: rangeMetaFromDays(w.days, range),
    };
  }

  async getReadWordsPerDayChart(
    ctx: Context,
    userId: number,
    languageCode: string,
    userTimezone: string | undefined,
    rangeInput: string | undefined
  ): Promise<ChartSeriesPayload> {
    const range = parseChartRange(rangeInput);
    const tz = safeTimezone(userTimezone);
    const w = await resolveWindowBounds(ctx, userId, languageCode, tz, range);
    const readRows = await ctx.prisma.userActionLog.findMany({
      where: {
        user_id: userId,
        language_code: languageCode,
        type: UserActionType.read,
        created_at: { gte: w.startUtc, lte: w.endUtc },
      },
      select: { created_at: true },
      orderBy: { created_at: 'asc' },
    });
    const byDay = new Map<string, number>();
    for (const row of readRows) {
      const day = dayjs(row.created_at).tz(tz).format('YYYY-MM-DD');
      byDay.set(day, (byDay.get(day) || 0) + 1);
    }
    return {
      series: seriesFromMap(w.days, byDay),
      range: rangeMetaFromDays(w.days, range),
    };
  }
}
