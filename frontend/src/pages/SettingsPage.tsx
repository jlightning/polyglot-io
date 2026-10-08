import React, { useState, useEffect } from 'react';
import {
  Container,
  Card,
  Heading,
  Text,
  Flex,
  Box,
  Select,
} from '@radix-ui/themes';
import { useUserSettings } from '../contexts/UserSettingContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ALLOWED_SCORE_TARGETS } from '../constants/scoreConstants';
import { isUiLanguage, useI18n, type MessagePath } from '../i18n';

const scoreDifficultyPath: Record<
  (typeof ALLOWED_SCORE_TARGETS)[number],
  MessagePath
> = {
  50: 'scoreDifficulty.50',
  100: 'scoreDifficulty.100',
  200: 'scoreDifficulty.200',
  250: 'scoreDifficulty.250',
  300: 'scoreDifficulty.300',
  400: 'scoreDifficulty.400',
  600: 'scoreDifficulty.600',
  1000: 'scoreDifficulty.1000',
  2000: 'scoreDifficulty.2000',
};

const SettingsPage: React.FC = () => {
  const { dailyScoreTarget, updateUserSetting } = useUserSettings();
  const { fetchUserStats } = useAuth();
  const { selectedLanguage } = useLanguage();
  const { t, uiLanguage, setUiLanguage } = useI18n();
  const [selectedTarget, setSelectedTarget] =
    useState<number>(dailyScoreTarget);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [savingScore, setSavingScore] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    setSelectedTarget(dailyScoreTarget);
  }, [dailyScoreTarget]);

  const handleLanguageChange = async (value: string) => {
    if (!isUiLanguage(value)) return;
    const previous = uiLanguage;
    setUiLanguage(value);
    setSavingLanguage(true);
    setMessage(null);
    const result = await updateUserSetting('UI_LANGUAGE', value);
    setSavingLanguage(false);
    if (!result.success) {
      setUiLanguage(previous);
      setMessage({ text: t('settings.saveFailed'), type: 'error' });
    }
  };

  const handleScoreChange = async (value: string) => {
    const next = parseInt(value, 10);
    if (!selectedLanguage || Number.isNaN(next) || next === dailyScoreTarget) {
      return;
    }
    const previous = selectedTarget;
    setSelectedTarget(next);
    setSavingScore(true);
    setMessage(null);
    const result = await updateUserSetting('DAILY_SCORE_TARGET', value);
    setSavingScore(false);
    if (result.success) {
      await fetchUserStats(selectedLanguage);
    } else {
      setSelectedTarget(previous);
      setMessage({ text: t('settings.saveFailed'), type: 'error' });
    }
  };

  return (
    <Container
      size="3"
      p="4"
      style={{ flexGrow: 0, alignSelf: 'flex-start', width: '100%' }}
    >
      <Heading size="6" mb="4">
        {t('settings.title')}
      </Heading>

      <Card size="2" style={{ width: '100%' }}>
        <Flex direction="column" gap="5">
          {message && (
            <Box
              p="3"
              style={{
                borderRadius: '6px',
                border: `1px solid ${
                  message.type === 'success' ? 'var(--green-9)' : 'var(--red-9)'
                }`,
                backgroundColor:
                  message.type === 'success'
                    ? 'var(--green-2)'
                    : 'var(--red-2)',
                color:
                  message.type === 'success'
                    ? 'var(--green-11)'
                    : 'var(--red-11)',
              }}
            >
              <Text size="2">{message.text}</Text>
            </Box>
          )}

          <Flex align="center" justify="between" gap="4">
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="3" weight="bold" as="div">
                {t('settings.siteLanguage')}
              </Text>
              <Text size="2" color="gray" mt="1" as="div">
                {t('settings.siteLanguageHelp')}
              </Text>
            </Box>
            <Box style={{ width: '280px', flexShrink: 0 }}>
              <Select.Root
                value={uiLanguage}
                onValueChange={handleLanguageChange}
                disabled={savingLanguage}
              >
                <Select.Trigger
                  style={{ width: '100%' }}
                  aria-label={t('settings.siteLanguage')}
                />
                <Select.Content
                  position="popper"
                  style={{ width: 'var(--radix-select-trigger-width)' }}
                >
                  <Select.Item value="en">{t('settings.english')}</Select.Item>
                  <Select.Item value="vi">
                    {t('settings.vietnamese')}
                  </Select.Item>
                  <Select.Item value="zh">{t('settings.chinese')}</Select.Item>
                </Select.Content>
              </Select.Root>
            </Box>
          </Flex>

          <Flex align="center" justify="between" gap="4">
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="3" weight="bold" as="div">
                {t('settings.scoreTarget')}
              </Text>
              <Text size="2" color="gray" mt="1" as="div">
                {t('settings.scoreHelp')}
              </Text>
            </Box>
            <Box style={{ width: '280px', flexShrink: 0 }}>
              <Select.Root
                value={selectedTarget.toString()}
                onValueChange={handleScoreChange}
                disabled={savingScore || !selectedLanguage}
              >
                <Select.Trigger
                  style={{ width: '100%' }}
                  aria-label={t('settings.scoreAria')}
                />
                <Select.Content
                  position="popper"
                  style={{ width: 'var(--radix-select-trigger-width)' }}
                >
                  {ALLOWED_SCORE_TARGETS.map(target => (
                    <Select.Item key={target} value={target.toString()}>
                      <Flex align="center" justify="between" gap="4">
                        <Text>{target}</Text>
                        <Text size="1" color="gray">
                          {t(scoreDifficultyPath[target])}
                        </Text>
                      </Flex>
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Box>
          </Flex>
        </Flex>
      </Card>
    </Container>
  );
};

export default SettingsPage;
