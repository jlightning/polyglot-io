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
import LessonList from '../components/LessonList';
import LessonUpload from '../components/LessonUpload';

const LessonPage: React.FC = () => {
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
        <Heading size="6">Lessons</Heading>
        <Text size="3" color="gray">
          Manage and view your language learning lessons
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
                  const displayName =
                    language?.localName && language.localName !== language.name
                      ? `${language.localName} (${language.name})`
                      : language?.name || selectedLanguage.toUpperCase();
                  return `Showing lessons for: ${displayName}`;
                })()
              : 'Loading language...'}
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
            placeholder="Search lessons by title..."
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
            placeholder="Filter by status"
          />
          <Select.Content>
            <Select.Item value="all">All Status</Select.Item>
            <Select.Item value="finished">Completed</Select.Item>
            <Select.Item value="reading">In Progress</Select.Item>
          </Select.Content>
        </Select.Root>

        {/* Type Filter */}
        <Select.Root value={typeFilter} onValueChange={setTypeFilter}>
          <Select.Trigger
            style={{ minWidth: '180px' }}
            placeholder="Filter by type"
          />
          <Select.Content>
            <Select.Item value="all">All Types</Select.Item>
            <Select.Item value="text">Text</Select.Item>
            <Select.Item value="subtitle">Subtitle</Select.Item>
            <Select.Item value="manga">Manga</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      {/* Lessons Section */}
      <Box>
        <Flex align="center" justify="between" mb="4">
          <Heading size="4">Your Lessons</Heading>
          <Text size="2" color="gray">
            Refresh automatically after upload
          </Text>
        </Flex>

        {languageLoading || !selectedLanguage ? (
          <Box>
            <Text size="3" color="gray">
              Loading language...
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
              typeFilter: typeFilter as 'text' | 'subtitle' | 'manga',
            })}
          />
        )}
      </Box>
    </Container>
  );
};

export default LessonPage;
