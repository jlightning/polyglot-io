import React from 'react';
import { Select, Text, Flex, Button } from '@radix-ui/themes';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
  const { selectedLanguage, setSelectedLanguage, languages, loading, error } =
    useLanguage();

  if (loading) {
    return (
      <Flex direction="column" gap="2">
        <Text size="2" color="gray">
          Loading languages...
        </Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex direction="column" gap="2">
        <Text size="2" color="red">
          {error}
        </Text>
      </Flex>
    );
  }

  if (languages.length === 0) {
    return (
      <Flex direction="column" gap="2">
        <Text size="2" color="gray">
          No languages available
        </Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="2">
      <Select.Root value={selectedLanguage} onValueChange={setSelectedLanguage}>
        <Select.Trigger placeholder="Select language" />
        <Select.Content>
          <Select.Group>
            <Select.Item value="all">
              <Text>All Languages</Text>
            </Select.Item>
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

      {selectedLanguage !== 'all' && (
        <Button
          variant="soft"
          size="1"
          onClick={() => setSelectedLanguage('all')}
        >
          Show All Languages
        </Button>
      )}
    </Flex>
  );
};

export default LanguageSwitcher;
