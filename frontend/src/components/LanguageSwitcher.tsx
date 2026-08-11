import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Select, Text, Flex } from '@radix-ui/themes';
import { useLanguage } from '../contexts/LanguageContext';
import { useI18n } from '../contexts/I18nContext';

const LanguageSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const { selectedLanguage, setSelectedLanguage, languages, loading, error } =
    useLanguage();
  const { t } = useI18n();

  const handleLanguageChange = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    navigate('/lessons');
  };

  if (loading) {
    return (
      <Flex direction="column" gap="2">
        <Text size="2" color="gray">
          {t('language.loading')}
        </Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex direction="column" gap="2">
        <Text size="2" color="red">
          {t('language.error')}
        </Text>
      </Flex>
    );
  }

  if (languages.length === 0) {
    return (
      <Flex direction="column" gap="2">
        <Text size="2" color="gray">
          {t('language.empty')}
        </Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="2">
      <Select.Root
        value={selectedLanguage}
        onValueChange={handleLanguageChange}
      >
        <Select.Trigger placeholder={t('language.select')} />
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
