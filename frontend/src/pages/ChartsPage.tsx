import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Select,
  Text,
} from '@radix-ui/themes';
import dayjs from 'dayjs';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useUserSettings } from '../contexts/UserSettingContext';
import {
  fetchCumulativeScoreChart,
  fetchDailyScoreChart,
  fetchLearnedPerDayChart,
  fetchLearnedWordsChart,
  fetchReadWordsPerDayChart,
} from '../services/chartApi';
import type { ChartDayPoint, ChartRangePreset } from '../types/chartOverview';
import { useI18n, type MessagePath } from '../i18n';

const RANGE_OPTIONS: { value: ChartRangePreset; label: MessagePath }[] = [
  { value: '30d', label: 'charts.range1Month' },
  { value: '90d', label: 'charts.range3Months' },
  { value: '180d', label: 'charts.range6Months' },
  { value: '365d', label: 'charts.range1Year' },
  { value: 'all', label: 'charts.rangeAll' },
];

function ChartRangeSelect({
  value,
  onChange,
}: {
  value: ChartRangePreset;
  onChange: (v: ChartRangePreset) => void;
}) {
  const { t } = useI18n();
  return (
    <Select.Root
      value={value}
      onValueChange={v => onChange(v as ChartRangePreset)}
    >
      <Select.Trigger
        style={{ minWidth: '140px' }}
        aria-label={t('charts.rangeAria')}
      />
      <Select.Content position="popper">
        {RANGE_OPTIONS.map(opt => (
          <Select.Item key={opt.value} value={opt.value}>
            {t(opt.label)}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

function useTimezone() {
  return useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
}

function formatRangeLabel(startDate: string, endDate: string) {
  const a = dayjs(startDate).format('DD/MM/YYYY');
  const b = dayjs(endDate).format('DD/MM/YYYY');
  return `${a} – ${b}`;
}

const ChartsPage: React.FC = () => {
  const { axiosInstance } = useAuth();
  const { selectedLanguage } = useLanguage();
  const { dailyScoreTarget } = useUserSettings();
  const { t } = useI18n();
  const timezone = useTimezone();

  const [dailyRange, setDailyRange] = useState<ChartRangePreset>('30d');
  const [dailySeries, setDailySeries] = useState<ChartDayPoint[]>([]);
  const [dailyMeta, setDailyMeta] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);

  const [cumRange, setCumRange] = useState<ChartRangePreset>('180d');
  const [cumSeries, setCumSeries] = useState<ChartDayPoint[]>([]);
  const [cumMeta, setCumMeta] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
  const [cumLoading, setCumLoading] = useState(false);
  const [cumError, setCumError] = useState<string | null>(null);

  const [learnedRange, setLearnedRange] = useState<ChartRangePreset>('180d');
  const [learnedSeries, setLearnedSeries] = useState<ChartDayPoint[]>([]);
  const [totalLearnedWords, setTotalLearnedWords] = useState(0);
  const [learnedMeta, setLearnedMeta] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
  const [learnedLoading, setLearnedLoading] = useState(false);
  const [learnedError, setLearnedError] = useState<string | null>(null);

  const [perDayRange, setPerDayRange] = useState<ChartRangePreset>('30d');
  const [perDaySeries, setPerDaySeries] = useState<ChartDayPoint[]>([]);
  const [perDayMeta, setPerDayMeta] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
  const [perDayLoading, setPerDayLoading] = useState(false);
  const [perDayError, setPerDayError] = useState<string | null>(null);

  const [readRange, setReadRange] = useState<ChartRangePreset>('30d');
  const [readSeries, setReadSeries] = useState<ChartDayPoint[]>([]);
  const [readMeta, setReadMeta] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
  const [readLoading, setReadLoading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedLanguage?.trim()) {
      setDailySeries([]);
      setDailyMeta(null);
      return;
    }
    let cancelled = false;
    setDailyLoading(true);
    setDailyError(null);
    void fetchDailyScoreChart(axiosInstance, {
      languageCode: selectedLanguage,
      timezone,
      range: dailyRange,
    })
      .then(data => {
        if (cancelled) return;
        setDailySeries(data.series);
        setDailyMeta({
          startDate: data.range.startDate,
          endDate: data.range.endDate,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setDailyError(t('charts.loadFailed'));
          setDailySeries([]);
          setDailyMeta(null);
        }
      })
      .finally(() => {
        if (!cancelled) setDailyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [axiosInstance, selectedLanguage, timezone, dailyRange, t]);

  useEffect(() => {
    if (!selectedLanguage?.trim()) {
      setCumSeries([]);
      setCumMeta(null);
      return;
    }
    let cancelled = false;
    setCumLoading(true);
    setCumError(null);
    void fetchCumulativeScoreChart(axiosInstance, {
      languageCode: selectedLanguage,
      timezone,
      range: cumRange,
    })
      .then(data => {
        if (cancelled) return;
        setCumSeries(data.series);
        setCumMeta({
          startDate: data.range.startDate,
          endDate: data.range.endDate,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setCumError(t('charts.loadFailed'));
          setCumSeries([]);
          setCumMeta(null);
        }
      })
      .finally(() => {
        if (!cancelled) setCumLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [axiosInstance, selectedLanguage, timezone, cumRange, t]);

  useEffect(() => {
    if (!selectedLanguage?.trim()) {
      setLearnedSeries([]);
      setLearnedMeta(null);
      setTotalLearnedWords(0);
      return;
    }
    let cancelled = false;
    setLearnedLoading(true);
    setLearnedError(null);
    void fetchLearnedWordsChart(axiosInstance, {
      languageCode: selectedLanguage,
      timezone,
      range: learnedRange,
    })
      .then(data => {
        if (cancelled) return;
        setLearnedSeries(data.series);
        setTotalLearnedWords(data.totalLearnedWords);
        setLearnedMeta({
          startDate: data.range.startDate,
          endDate: data.range.endDate,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLearnedError(t('charts.loadFailed'));
          setLearnedSeries([]);
          setLearnedMeta(null);
          setTotalLearnedWords(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLearnedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [axiosInstance, selectedLanguage, timezone, learnedRange, t]);

  useEffect(() => {
    if (!selectedLanguage?.trim()) {
      setPerDaySeries([]);
      setPerDayMeta(null);
      return;
    }
    let cancelled = false;
    setPerDayLoading(true);
    setPerDayError(null);
    void fetchLearnedPerDayChart(axiosInstance, {
      languageCode: selectedLanguage,
      timezone,
      range: perDayRange,
    })
      .then(data => {
        if (cancelled) return;
        setPerDaySeries(data.series);
        setPerDayMeta({
          startDate: data.range.startDate,
          endDate: data.range.endDate,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setPerDayError(t('charts.loadFailed'));
          setPerDaySeries([]);
          setPerDayMeta(null);
        }
      })
      .finally(() => {
        if (!cancelled) setPerDayLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [axiosInstance, selectedLanguage, timezone, perDayRange, t]);

  useEffect(() => {
    if (!selectedLanguage?.trim()) {
      setReadSeries([]);
      setReadMeta(null);
      return;
    }
    let cancelled = false;
    setReadLoading(true);
    setReadError(null);
    void fetchReadWordsPerDayChart(axiosInstance, {
      languageCode: selectedLanguage,
      timezone,
      range: readRange,
    })
      .then(data => {
        if (cancelled) return;
        setReadSeries(data.series);
        setReadMeta({
          startDate: data.range.startDate,
          endDate: data.range.endDate,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setReadError(t('charts.loadFailed'));
          setReadSeries([]);
          setReadMeta(null);
        }
      })
      .finally(() => {
        if (!cancelled) setReadLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [axiosInstance, selectedLanguage, timezone, readRange, t]);

  const chartMargin = { top: 8, right: 16, left: 0, bottom: 0 };

  if (!selectedLanguage?.trim()) {
    return (
      <Container size="4" p="4">
        <Heading size="6" mb="4">
          {t('charts.title')}
        </Heading>
        <Text color="gray">{t('charts.needLanguage')}</Text>
      </Container>
    );
  }

  return (
    <Container size="4" p="4">
      <Heading size="6" mb="6">
        {t('charts.title')}
      </Heading>

      <Flex direction="column" gap="6">
        <Card size="3">
          <Flex justify="between" align="start" gap="4" wrap="wrap" mb="2">
            <Text size="3" weight="medium" as="div">
              {t('charts.dailyTitle')}
            </Text>
            <Flex align="center" gap="2">
              <Text size="2" color="gray" as="span">
                {t('charts.range')}
              </Text>
              <ChartRangeSelect value={dailyRange} onChange={setDailyRange} />
            </Flex>
          </Flex>
          {dailyMeta && (
            <Text size="1" color="gray" mb="2">
              {formatRangeLabel(dailyMeta.startDate, dailyMeta.endDate)}
            </Text>
          )}
          <Text size="2" color="gray" mb="3" as="div">
            {t('charts.dailyHelp')}
          </Text>
          {dailyError && (
            <Text color="red" size="2" mb="2">
              {dailyError}
            </Text>
          )}
          {dailyLoading && (
            <Text color="gray" size="2" mb="2">
              {t('common.loadingEllipsis')}
            </Text>
          )}
          <Box style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySeries} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-6)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--gray-11)' }}
                  minTickGap={28}
                  tickFormatter={v => dayjs(v).format('DD/MM/YYYY')}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--gray-11)' }}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-panel-solid)',
                    border: '1px solid var(--gray-6)',
                    borderRadius: 6,
                  }}
                  labelFormatter={v => dayjs(v as string).format('DD/MM/YYYY')}
                />
                <ReferenceLine
                  y={dailyScoreTarget}
                  stroke="var(--amber-9)"
                  strokeDasharray="4 4"
                  label={{
                    value: t('charts.target', { score: dailyScoreTarget }),
                    fill: 'var(--amber-11)',
                    fontSize: 11,
                  }}
                />
                <Bar
                  dataKey="value"
                  name={t('charts.score')}
                  fill="var(--blue-9)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Card>

        <Card size="3">
          <Flex justify="between" align="start" gap="4" wrap="wrap" mb="2">
            <Text size="3" weight="medium" as="div">
              {t('charts.cumulativeTitle')}
            </Text>
            <Flex align="center" gap="2">
              <Text size="2" color="gray" as="span">
                {t('charts.range')}
              </Text>
              <ChartRangeSelect value={cumRange} onChange={setCumRange} />
            </Flex>
          </Flex>
          {cumMeta && (
            <Text size="1" color="gray" mb="2">
              {formatRangeLabel(cumMeta.startDate, cumMeta.endDate)}
            </Text>
          )}
          <Text size="2" color="gray" mb="3" as="div">
            {t('charts.cumulativeHelp')}
          </Text>
          {cumError && (
            <Text color="red" size="2" mb="2">
              {cumError}
            </Text>
          )}
          {cumLoading && (
            <Text color="gray" size="2" mb="2">
              {t('common.loadingEllipsis')}
            </Text>
          )}
          <Box style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumSeries} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-6)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--gray-11)' }}
                  minTickGap={28}
                  tickFormatter={v => dayjs(v).format('DD/MM/YYYY')}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--gray-11)' }}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-panel-solid)',
                    border: '1px solid var(--gray-6)',
                    borderRadius: 6,
                  }}
                  labelFormatter={v => dayjs(v as string).format('DD/MM/YYYY')}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={t('charts.cumulativeName')}
                  stroke="var(--blue-9)"
                  fill="var(--blue-3)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Card>

        <Card size="3">
          <Flex justify="between" align="start" gap="4" wrap="wrap" mb="2">
            <Text size="3" weight="medium" as="div">
              {t('charts.learnedTitle')}
            </Text>
            <Flex align="center" gap="2">
              <Text size="2" color="gray" as="span">
                {t('charts.range')}
              </Text>
              <ChartRangeSelect
                value={learnedRange}
                onChange={setLearnedRange}
              />
            </Flex>
          </Flex>
          {learnedMeta && (
            <Text size="1" color="gray" mb="2">
              {formatRangeLabel(learnedMeta.startDate, learnedMeta.endDate)}
            </Text>
          )}
          <Text size="2" color="gray" mb="4" as="div">
            {t('charts.learnedHelp')}
          </Text>
          {learnedError && (
            <Text color="red" size="2" mb="2">
              {learnedError}
            </Text>
          )}
          {learnedLoading && (
            <Text color="gray" size="2" mb="2">
              {t('common.loadingEllipsis')}
            </Text>
          )}
          <Flex direction={{ initial: 'column', sm: 'row' }} gap="6">
            <Box style={{ minWidth: 140 }}>
              <Text size="2" color="gray" mb="1" as="div">
                {t('charts.totalKnown')}
              </Text>
              <Text size="8" weight="bold" style={{ color: 'var(--blue-11)' }}>
                {totalLearnedWords.toLocaleString()}
              </Text>
            </Box>
            <Box style={{ flex: 1, minHeight: 200 }}>
              <Text size="2" weight="medium" mb="2" as="div">
                {t('charts.knownOverTime')}
              </Text>
              <Box style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={learnedSeries} margin={chartMargin}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--gray-6)"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'var(--gray-11)' }}
                      minTickGap={28}
                      tickFormatter={v => dayjs(v).format('DD/MM/YYYY')}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--gray-11)' }}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-panel-solid)',
                        border: '1px solid var(--gray-6)',
                        borderRadius: 6,
                      }}
                      labelFormatter={v =>
                        dayjs(v as string).format('DD/MM/YYYY')
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      name={t('charts.cumulativeLearned')}
                      stroke="var(--green-9)"
                      fill="var(--green-3)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          </Flex>
        </Card>

        <Card size="3">
          <Flex justify="between" align="start" gap="4" wrap="wrap" mb="2">
            <Text size="3" weight="medium" as="div">
              {t('charts.perDayTitle')}
            </Text>
            <Flex align="center" gap="2">
              <Text size="2" color="gray" as="span">
                {t('charts.range')}
              </Text>
              <ChartRangeSelect value={perDayRange} onChange={setPerDayRange} />
            </Flex>
          </Flex>
          {perDayMeta && (
            <Text size="1" color="gray" mb="2">
              {formatRangeLabel(perDayMeta.startDate, perDayMeta.endDate)}
            </Text>
          )}
          <Text size="2" color="gray" mb="3" as="div">
            {t('charts.perDayHelp')}
          </Text>
          {perDayError && (
            <Text color="red" size="2" mb="2">
              {perDayError}
            </Text>
          )}
          {perDayLoading && (
            <Text color="gray" size="2" mb="2">
              {t('common.loadingEllipsis')}
            </Text>
          )}
          <Box style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perDaySeries} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-6)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--gray-11)' }}
                  minTickGap={28}
                  tickFormatter={v => dayjs(v).format('DD/MM/YYYY')}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--gray-11)' }}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-panel-solid)',
                    border: '1px solid var(--gray-6)',
                    borderRadius: 6,
                  }}
                  labelFormatter={v => dayjs(v as string).format('DD/MM/YYYY')}
                />
                <Bar
                  dataKey="value"
                  name={t('charts.learned')}
                  fill="var(--green-9)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Card>

        <Card size="3">
          <Flex justify="between" align="start" gap="4" wrap="wrap" mb="2">
            <Text size="3" weight="medium" as="div">
              {t('charts.readTitle')}
            </Text>
            <Flex align="center" gap="2">
              <Text size="2" color="gray" as="span">
                {t('charts.range')}
              </Text>
              <ChartRangeSelect value={readRange} onChange={setReadRange} />
            </Flex>
          </Flex>
          {readMeta && (
            <Text size="1" color="gray" mb="2">
              {formatRangeLabel(readMeta.startDate, readMeta.endDate)}
            </Text>
          )}
          <Text size="2" color="gray" mb="3" as="div">
            {t('charts.readHelp')}
          </Text>
          {readError && (
            <Text color="red" size="2" mb="2">
              {readError}
            </Text>
          )}
          {readLoading && (
            <Text color="gray" size="2" mb="2">
              {t('common.loadingEllipsis')}
            </Text>
          )}
          <Box style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={readSeries} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-6)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--gray-11)' }}
                  minTickGap={28}
                  tickFormatter={v => dayjs(v).format('DD/MM/YYYY')}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--gray-11)' }}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-panel-solid)',
                    border: '1px solid var(--gray-6)',
                    borderRadius: 6,
                  }}
                  labelFormatter={v => dayjs(v as string).format('DD/MM/YYYY')}
                />
                <Bar
                  dataKey="value"
                  name={t('charts.reads')}
                  fill="var(--violet-9)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Card>
      </Flex>
    </Container>
  );
};

export default ChartsPage;
