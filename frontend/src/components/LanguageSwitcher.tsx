import React, { useState, useEffect } from 'react';
import { Select, Text, Flex } from '@radix-ui/themes';
import { useAuth } from '../contexts/AuthContext';

interface Language {
  code: string;
  name: string;
  localName?: string;
  tag: string;
  enabled: boolean;
}

interface LanguageSwitcherProps {
  selectedLanguage: string;
  onLanguageChange: (languageCode: string) => void;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  selectedLanguage,
  onLanguageChange,
}) => {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { axiosInstance, isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get('/api/config/languages');

        if (response.data.success) {
          setLanguages(response.data.languages);
          setError(null);
        } else {
          setError('Failed to load languages');
        }
      } catch (err) {
        console.error('Error fetching languages:', err);
        setError('Failed to load languages');
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchLanguages();
    }
  }, [isAuthenticated]);

  if (loading) {
    return (
      <Flex align="center" gap="2">
        <Text size="2" color="gray">
          Loading languages...
        </Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex align="center" gap="2">
        <Text size="2" color="red">
          {error}
        </Text>
      </Flex>
    );
  }

  if (languages.length === 0) {
    return (
      <Flex align="center" gap="2">
        <Text size="2" color="gray">
          No languages available
        </Text>
      </Flex>
    );
  }

  return (
    <Flex align="center" gap="2">
      <Text size="2" weight="medium">
        Language:
      </Text>
      <Select.Root value={selectedLanguage} onValueChange={onLanguageChange}>
        <Select.Trigger placeholder="Select language" />
        <Select.Content>
          <Select.Group>
            {languages.map(language => (
              <Select.Item key={language.code} value={language.code}>
                <Flex align="center" gap="2">
                  <Text>
                    {language.localName && language.localName !== language.name
                      ? `${language.localName} (${language.name})`
                      : language.name}
                  </Text>
                </Flex>
              </Select.Item>
            ))}
          </Select.Group>
        </Select.Content>
      </Select.Root>
    </Flex>
  );
};

export default LanguageSwitcher;
