import React, { useState, useEffect } from 'react';
import {
  Container,
  Flex,
  Heading,
  Text,
  Box,
  Separator,
  TextField,
  Select,
} from '@radix-ui/themes';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useI18n } from '../i18n';
import LessonList from '../components/LessonList';
import LessonUpload from '../components/LessonUpload';

const LessonPage: React.FC = () => {
  const { t, uiLanguage } = useI18n();
  const {
    selectedLanguage,
    languages,
    loading: languageLoading,
  } = useLanguage();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay

    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm]);

  const handleLessonUploaded = () => {
    // Trigger refresh of lesson list
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <Container size="4" p="4">
      {/* Header */}
      <Flex direction="column" gap="4" mb="6">
        <Heading size="6">{t('lessons.title')}</Heading>
        <Text size="3" color="gray">
          {t('lessons.subtitle')}
        </Text>
      </Flex>

      {/* Language Controls */}
      <Flex justify="between" align="center" mb="4">
        <Box>
          <Text size="2" color="gray">
            {selectedLanguage
              ? (() => {
                  const language = languages.find(
                    lang => lang.code === selectedLanguage
                  );
                  const original =
                    language?.localName ||
                    language?.name ||
                    selectedLanguage.toUpperCase();
                  const localized = language
                    ? new Intl.DisplayNames([uiLanguage], {
                        type: 'language',
                      }).of(language.code) || language.name
                    : original;
                  const displayName =
                    original === localized
                      ? original
                      : `${original} (${localized})`;
                  return t('lessons.showing', { name: displayName });
                })()
              : t('lessons.loadingLanguage')}
          </Text>
        </Box>
        <LessonUpload onLessonUploaded={handleLessonUploaded} />
      </Flex>

      <Separator size="4" mb="4" />

      {/* Search and Filters */}
      <Flex gap="4" mb="4" wrap="wrap">
        {/* Search */}
        <Flex gap="2" style={{ flex: 1, minWidth: '300px' }}>
          <TextField.Root
            placeholder={t('lessons.searchPlaceholder')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ flex: 1 }}
          >
            <TextField.Slot>
              <MagnifyingGlassIcon height="16" width="16" />
            </TextField.Slot>
          </TextField.Root>
        </Flex>

        {/* Status Filter */}
        <Select.Root value={statusFilter} onValueChange={setStatusFilter}>
          <Select.Trigger
            style={{ minWidth: '180px' }}
            placeholder={t('lessons.filterStatus')}
          />
          <Select.Content>
            <Select.Item value="all">{t('lessons.allStatus')}</Select.Item>
            <Select.Item value="finished">{t('lessons.completed')}</Select.Item>
            <Select.Item value="reading">{t('lessons.inProgress')}</Select.Item>
          </Select.Content>
        </Select.Root>

        {/* Type Filter */}
        <Select.Root value={typeFilter} onValueChange={setTypeFilter}>
          <Select.Trigger
            style={{ minWidth: '180px' }}
            placeholder={t('lessons.filterType')}
          />
          <Select.Content>
            <Select.Item value="all">{t('lessons.allTypes')}</Select.Item>
            <Select.Item value="text">{t('lessonType.text')}</Select.Item>
            <Select.Item value="subtitle">
              {t('lessonType.subtitle')}
            </Select.Item>
            <Select.Item value="manga">{t('lessonType.manga')}</Select.Item>
            <Select.Item value="manual">{t('lessonType.manual')}</Select.Item>
            <Select.Item value="generated">
              {t('lessonType.generated')}
            </Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      {/* Lessons Section */}
      <Box>
        <Flex align="center" justify="between" mb="4">
          <Heading size="4">{t('lessons.yourLessons')}</Heading>
          <Text size="2" color="gray">
            {t('lessons.refreshHint')}
          </Text>
        </Flex>

        {languageLoading || !selectedLanguage ? (
          <Box>
            <Text size="3" color="gray">
              {t('lessons.loadingLanguage')}
            </Text>
          </Box>
        ) : (
          <LessonList
            selectedLanguage={selectedLanguage}
            refreshTrigger={refreshTrigger}
            {...(debouncedSearchTerm && { search: debouncedSearchTerm })}
            {...(statusFilter !== 'all' && {
              statusFilter: statusFilter as 'reading' | 'finished',
            })}
            {...(typeFilter !== 'all' && {
              typeFilter: typeFilter as
                | 'text'
                | 'subtitle'
                | 'manga'
                | 'manual'
                | 'generated',
            })}
          />
        )}
      </Box>
    </Container>
  );
};

export default LessonPage;
