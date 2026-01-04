import React, { useState, useEffect } from 'react';
import { Container, Card, Heading, Text, Flex, Box } from '@radix-ui/themes';
import * as RadioGroup from '@radix-ui/react-radio-group';
import MyButton from '../components/MyButton';
import { useUserSettings } from '../contexts/UserSettingContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const ALLOWED_SCORE_TARGETS = [50, 100, 200, 250, 300];

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
      // Refetch user stats to reflect the new target
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
    <Container size="4" p="4">
      <Heading size="8" mb="4">
        Settings
      </Heading>

      <Card style={{ padding: '24px', maxWidth: '600px' }}>
        {message && (
          <Box
            mb="4"
            p="3"
            style={{
              borderRadius: '6px',
              border: `1px solid ${
                message.type === 'success' ? 'var(--green-9)' : 'var(--red-9)'
              }`,
              backgroundColor:
                message.type === 'success' ? 'var(--green-2)' : 'var(--red-2)',
              color:
                message.type === 'success'
                  ? 'var(--green-11)'
                  : 'var(--red-11)',
            }}
          >
            <Text size="2">{message.text}</Text>
          </Box>
        )}

        <Box mb="6">
          <Text size="4" weight="bold" mb="2" as="div">
            Daily Score Target
          </Text>
          <Text size="2" color="gray" mb="4" as="div">
            Set your daily goal for word learning score
          </Text>

          <RadioGroup.Root
            value={selectedTarget.toString()}
            onValueChange={value => setSelectedTarget(parseInt(value, 10))}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            {ALLOWED_SCORE_TARGETS.map(target => (
              <Flex
                key={target}
                align="center"
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--gray-6)',
                  cursor: 'pointer',
                  backgroundColor:
                    selectedTarget === target ? 'var(--blue-2)' : 'transparent',
                }}
                onClick={() => setSelectedTarget(target)}
              >
                <RadioGroup.Item
                  value={target.toString()}
                  id={`target-${target}`}
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: '2px solid var(--gray-9)',
                    marginRight: '12px',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <RadioGroup.Indicator
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%',
                      position: 'relative',
                    }}
                  >
                    <Box
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--blue-9)',
                      }}
                    />
                  </RadioGroup.Indicator>
                </RadioGroup.Item>
                <Text size="3" as="label" htmlFor={`target-${target}`}>
                  {target} points
                </Text>
              </Flex>
            ))}
          </RadioGroup.Root>
        </Box>

        <Flex gap="3" justify="end">
          <MyButton
            onClick={handleSave}
            disabled={isLoading || selectedTarget === dailyScoreTarget}
            variant="solid"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </MyButton>
        </Flex>
      </Card>
    </Container>
  );
};

export default SettingsPage;
