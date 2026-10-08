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
import MyButton from '../components/MyButton';
import { useUserSettings } from '../contexts/UserSettingContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  ALLOWED_SCORE_TARGETS,
  getScoreTargetDifficulty,
} from '../constants/scoreConstants';

const SettingsPage: React.FC = () => {
  const { dailyScoreTarget, updateUserSetting } = useUserSettings();
  const { fetchUserStats } = useAuth();
  const { selectedLanguage } = useLanguage();
  const [selectedTarget, setSelectedTarget] =
    useState<number>(dailyScoreTarget);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    setSelectedTarget(dailyScoreTarget);
  }, [dailyScoreTarget]);

  const handleSave = async () => {
    setIsLoading(true);
    setMessage(null);

    const result = await updateUserSetting(
      'DAILY_SCORE_TARGET',
      selectedTarget.toString()
    );

    if (result.success) {
      setMessage({
        text: 'Settings saved successfully!',
        type: 'success',
      });
      if (selectedLanguage) {
        await fetchUserStats(selectedLanguage);
      }
    } else {
      setMessage({
        text: result.message || 'Failed to save settings',
        type: 'error',
      });
    }

    setIsLoading(false);
  };

  return (
    <Container
      size="2"
      p="4"
      style={{ flexGrow: 0, alignSelf: 'flex-start', width: '100%' }}
    >
      <Heading size="6" mb="4">
        Settings
      </Heading>

      <Card size="2" style={{ width: '100%' }}>
        <Flex direction="column" gap="4">
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

          <Box>
            <Text size="3" weight="bold" as="div">
              Daily score target
            </Text>
            <Text size="2" color="gray" mt="1" as="div">
              Daily word score goal for the current language.
            </Text>
          </Box>

          <Flex gap="3" align="center">
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Select.Root
                value={selectedTarget.toString()}
                onValueChange={value => setSelectedTarget(parseInt(value, 10))}
              >
                <Select.Trigger
                  style={{ width: '100%' }}
                  aria-label="Daily score target"
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
                          {getScoreTargetDifficulty(target)}
                        </Text>
                      </Flex>
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Box>
            <MyButton
              onClick={handleSave}
              disabled={
                isLoading ||
                selectedTarget === dailyScoreTarget ||
                !selectedLanguage
              }
              variant="solid"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </MyButton>
          </Flex>
        </Flex>
      </Card>
    </Container>
  );
};

export default SettingsPage;
