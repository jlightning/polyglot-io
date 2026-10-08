import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Select, Text, Flex } from '@radix-ui/themes';
import { useLanguage } from '../contexts/LanguageContext';
import { useI18n } from '../i18n';

const LanguageSwitcher: React.FC = () => {
  const { t, uiLanguage } = useI18n();
  const navigate = useNavigate();
  const { selectedLanguage, setSelectedLanguage, languages, loading, error } =
    useLanguage();

  const handleLanguageChange = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    navigate('/lessons');
  };

  if (loading) {
    return (
      <Flex direction="column" gap="2">
        <Text size="2" color="gray">
          {t('languageSwitcher.loading')}
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
          {t('languageSwitcher.empty')}
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
        <Select.Trigger placeholder={t('languageSwitcher.placeholder')} />
        <Select.Content>
          <Select.Group>
            {languages.map(language => {
              const original = language.localName || language.name;
              const localized =
                new Intl.DisplayNames([uiLanguage], { type: 'language' }).of(
                  language.code
                ) || language.name;
              return (
                <Select.Item key={language.code} value={language.code}>
                  <Flex align="center" gap="2">
                    <Text>
                      {original === localized
                        ? original
                        : `${original} (${localized})`}
                    </Text>
                  </Flex>
                </Select.Item>
              );
            })}
          </Select.Group>
        </Select.Content>
      </Select.Root>
    </Flex>
  );
};

export default LanguageSwitcher;
