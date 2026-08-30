import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Flex,
  Text,
  Badge,
  TextField,
  Separator,
  Table,
  Heading,
  Card,
  Link,
  Dialog,
  Tabs,
  Popover,
  Callout,
  Checkbox,
} from '@radix-ui/themes';
import MyButton from '../components/MyButton';
import {
  MagnifyingGlassIcon,
  ReloadIcon,
  DownloadIcon,
  CrossCircledIcon,
  CaretUpIcon,
  CaretDownIcon,
  ChevronDownIcon,
} from '@radix-ui/react-icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Pagination from '../components/Pagination';
import { useWordSidebar } from '../contexts/WordSidebarContext';
import { useWordMark } from '../contexts/WordMarkContext';
import SentenceReConstructor from '../components/SentenceReConstructor';
import {
  getDifficultyLabel,
  getDifficultyColor,
} from '../constants/difficultyColors';
import axios from 'axios';

interface Word {
  id: number;
  word: string;
  language_code: string;
  sentences: Array<{
    id: number;
    original_text: string;
    split_text: string[] | null;
    lesson: {
      id: number;
      title: string;
      language_code: string;
    };
  }>;
  totalSentenceCount: number;
  lessons: Array<{
    id: number;
    title: string;
    language_code: string;
  }>;
  translations: WordTranslation[];
  pronunciations: WordPronunciation[];
}

interface WordTranslation {
  word: string;
  translation: string;
}

interface WordPronunciation {
  word: string;
  pronunciation: string;
  pronunciationType: string;
}

interface WordUserMark {
  id: number;
  user_id: number;
  word_id: number;
  note: string;
  mark: number;
  created_at: string;
  updated_at: string;
  word: Word;
}

interface WordsResponse {
  success: boolean;
  data: {
    wordUserMarks: WordUserMark[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

const ALL_DIFFICULTY_MARKS = [0, 1, 2, 3, 4, 5] as const;
const DIFFICULTY_OPTIONS = ALL_DIFFICULTY_MARKS.map(mark => ({
  value: mark,
  label: `${mark}. ${getDifficultyLabel(mark)}`,
}));
const UNMARKED_OPTION = {
  value: -1,
  label: `-1. ${getDifficultyLabel(-1)}`,
};

const WordsPage: React.FC = () => {
  const { axiosInstance } = useAuth();
  const { selectedLanguage } = useLanguage();
  const { openWordSidebar } = useWordSidebar();
  const { addWords, seedWordMarks } = useWordMark();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [words, setWords] = useState<WordUserMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(
    () => searchParams.get('search') || ''
  );
  const [appliedSearch, setAppliedSearch] = useState(
    () => searchParams.get('search') || ''
  );
  const [difficultyFilter, setDifficultyFilter] = useState<number[]>(() => {
    const hasLesson = !!searchParams.get('lessonId');
    const defaultMarks = hasLesson
      ? [-1, ...ALL_DIFFICULTY_MARKS]
      : [...ALL_DIFFICULTY_MARKS];
    if (!searchParams.has('mark')) {
      return defaultMarks;
    }
    const mark = searchParams.get('mark') || '';
    const parsed = mark
      .split(',')
      .map(part => part.trim())
      .filter(part => part !== '')
      .map(part => parseInt(part, 10))
      .filter(
        n => !Number.isNaN(n) && ((n >= 0 && n <= 5) || (n === -1 && hasLesson))
      );
    if (parsed.length === 0) {
      return defaultMarks;
    }
    return [...new Set(parsed)].sort((a, b) => a - b);
  });
  const [difficultyPickerOpen, setDifficultyPickerOpen] = useState(false);
  const [lessonId, setLessonId] = useState<number | null>(() => {
    const raw = searchParams.get('lessonId');
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) || parsed < 1 ? null : parsed;
  });
  const [selectedLessonTitle, setSelectedLessonTitle] = useState<string | null>(
    null
  );
  const [lessonFilterError, setLessonFilterError] = useState('');
  const [lessonPickerOpen, setLessonPickerOpen] = useState(false);
  const [lessonSearch, setLessonSearch] = useState('');
  const [debouncedLessonSearch, setDebouncedLessonSearch] = useState('');
  const [lessonOptions, setLessonOptions] = useState<
    Array<{ id: number; title: string }>
  >([]);
  const [lessonOptionsLoading, setLessonOptionsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState(() => {
    const sortBy = searchParams.get('sortBy');
    if (
      sortBy &&
      ['word', 'mark', 'sentence_count', 'updated_at'].includes(sortBy)
    ) {
      return sortBy;
    }
    return 'updated_at';
  });
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    const sortOrder = searchParams.get('sortOrder');
    if (sortOrder === 'asc' || sortOrder === 'desc') {
      return sortOrder;
    }
    return 'desc';
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const prevLanguageRef = useRef(selectedLanguage);

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [lingqApiKey, setLingqApiKey] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  const fetchWords = async (
    page: number = 1,
    search: string = '',
    difficulties: number[] = [...ALL_DIFFICULTY_MARKS],
    sort: string = 'updated_at',
    direction: 'asc' | 'desc' = 'desc',
    filterLessonId: number | null = null
  ) => {
    if (!axiosInstance || !selectedLanguage) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        sortBy: sort,
        sortOrder: direction,
        language: selectedLanguage,
      });

      const allSelected =
        difficulties.length === 0 ||
        (filterLessonId !== null
          ? difficulties.length === ALL_DIFFICULTY_MARKS.length + 1 &&
            ALL_DIFFICULTY_MARKS.every(mark => difficulties.includes(mark)) &&
            difficulties.includes(-1)
          : difficulties.length === ALL_DIFFICULTY_MARKS.length &&
            ALL_DIFFICULTY_MARKS.every(mark => difficulties.includes(mark)));
      if (!allSelected) {
        params.append(
          'mark',
          difficulties
            .slice()
            .sort((a, b) => a - b)
            .join(',')
        );
      }

      if (search) {
        params.append('search', search);
      }

      if (filterLessonId !== null) {
        params.append('lessonId', filterLessonId.toString());
      }

      const response = await axiosInstance.get<WordsResponse>(
        `/api/words/marks/details?${params}`
      );

      if (response.data.success) {
        const wordUserMarks = response.data.data.wordUserMarks;
        setWords(wordUserMarks);
        setPagination(response.data.data.pagination);
        seedWordMarks(
          wordUserMarks.map(wm => ({ word: wm.word.word, mark: wm.mark }))
        );
        void addWords(
          [
            ...new Set(
              wordUserMarks.flatMap(wm =>
                wm.word.sentences.flatMap(s => s.split_text ?? [])
              )
            ),
          ],
          selectedLanguage
        );
      }
    } catch (error) {
      console.error('Error fetching words:', error);
      const message = axios.isAxiosError(error)
        ? String(error.response?.data?.message || '')
        : '';
      // Only clear lesson filter on lesson-specific failures — not e.g. missing language
      if (
        axios.isAxiosError(error) &&
        filterLessonId !== null &&
        (error.response?.status === 404 ||
          (error.response?.status === 400 && /lesson/i.test(message)))
      ) {
        setLessonId(null);
        setSelectedLessonTitle(null);
        setLessonFilterError(
          message ||
            'Lesson filter cleared: lesson not found or language mismatch'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const next = new URLSearchParams();
    if (lessonId !== null) {
      next.set('lessonId', lessonId.toString());
    }
    const allDifficultiesSelected =
      difficultyFilter.length === 0 ||
      (lessonId !== null
        ? difficultyFilter.length === ALL_DIFFICULTY_MARKS.length + 1 &&
          ALL_DIFFICULTY_MARKS.every(mark => difficultyFilter.includes(mark)) &&
          difficultyFilter.includes(-1)
        : difficultyFilter.length === ALL_DIFFICULTY_MARKS.length &&
          ALL_DIFFICULTY_MARKS.every(mark => difficultyFilter.includes(mark)));
    if (!allDifficultiesSelected) {
      next.set(
        'mark',
        difficultyFilter
          .slice()
          .sort((a, b) => a - b)
          .join(',')
      );
    }
    if (appliedSearch) {
      next.set('search', appliedSearch);
    }
    if (sortField !== 'updated_at' || sortDirection !== 'desc') {
      next.set('sortBy', sortField);
      next.set('sortOrder', sortDirection);
    }
    setSearchParams(next, { replace: true });
  }, [
    lessonId,
    difficultyFilter,
    appliedSearch,
    sortField,
    sortDirection,
    setSearchParams,
  ]);

  useEffect(() => {
    if (
      prevLanguageRef.current &&
      selectedLanguage &&
      prevLanguageRef.current !== selectedLanguage
    ) {
      setLessonId(null);
      setSelectedLessonTitle(null);
      setCurrentPage(1);
    }
    prevLanguageRef.current = selectedLanguage;
  }, [selectedLanguage]);

  useEffect(() => {
    if (!axiosInstance || lessonId === null) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await axiosInstance.get(`/api/lessons/${lessonId}`);
        if (cancelled) return;
        if (!response.data.success || !response.data.lesson) {
          setLessonId(null);
          setSelectedLessonTitle(null);
          setLessonFilterError(
            'Lesson filter cleared: lesson not found or access denied'
          );
          return;
        }
        if (
          selectedLanguage &&
          response.data.lesson.languageCode !== selectedLanguage
        ) {
          setLessonId(null);
          setSelectedLessonTitle(null);
          setLessonFilterError(
            'Lesson filter cleared: lesson language does not match'
          );
          return;
        }
        setSelectedLessonTitle(response.data.lesson.title);
        setLessonFilterError('');
      } catch {
        if (cancelled) return;
        setLessonId(null);
        setSelectedLessonTitle(null);
        setLessonFilterError(
          'Lesson filter cleared: lesson not found or access denied'
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [axiosInstance, lessonId, selectedLanguage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLessonSearch(lessonSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [lessonSearch]);

  useEffect(() => {
    if (!lessonPickerOpen || !axiosInstance || !selectedLanguage) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLessonOptionsLoading(true);
        const params = new URLSearchParams();
        if (debouncedLessonSearch) {
          params.append('search', debouncedLessonSearch);
        }
        const query = params.toString();
        const response = await axiosInstance.get(
          `/api/lessons/language/${selectedLanguage}${query ? `?${query}` : ''}`
        );
        if (cancelled) return;
        if (response.data.success) {
          setLessonOptions(
            (response.data.lessons || []).map(
              (lesson: { id: number; title: string }) => ({
                id: lesson.id,
                title: lesson.title,
              })
            )
          );
        }
      } catch (error) {
        console.error('Error fetching lessons for filter:', error);
      } finally {
        if (!cancelled) {
          setLessonOptionsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    lessonPickerOpen,
    debouncedLessonSearch,
    axiosInstance,
    selectedLanguage,
  ]);

  useEffect(() => {
    fetchWords(
      currentPage,
      appliedSearch,
      difficultyFilter,
      sortField,
      sortDirection,
      lessonId
    );
  }, [
    axiosInstance,
    selectedLanguage,
    currentPage,
    difficultyFilter,
    sortField,
    sortDirection,
    appliedSearch,
    lessonId,
  ]);

  const handleSearch = () => {
    setCurrentPage(1);
    setAppliedSearch(searchTerm);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRefresh = () => {
    fetchWords(
      currentPage,
      appliedSearch,
      difficultyFilter,
      sortField,
      sortDirection,
      lessonId
    );
  };

  const handleDifficultyToggle = (mark: number, checked: boolean) => {
    setDifficultyFilter(prev => {
      if (checked) {
        return prev.includes(mark)
          ? prev
          : [...prev, mark].sort((a, b) => a - b);
      }
      const next = prev.filter(value => value !== mark);
      return next.length === 0 ? [...ALL_DIFFICULTY_MARKS] : next;
    });
    setCurrentPage(1);
  };

  // -1 (Unmarked) only valid with a lesson; drop it when lesson cleared
  useEffect(() => {
    if (lessonId !== null) return;
    setDifficultyFilter(prev => {
      if (!prev.includes(-1)) return prev;
      const next = prev.filter(m => m !== -1);
      return next.length === 0 ? [...ALL_DIFFICULTY_MARKS] : next;
    });
  }, [lessonId]);

  const visibleDifficultyOptions =
    lessonId !== null
      ? [UNMARKED_OPTION, ...DIFFICULTY_OPTIONS]
      : DIFFICULTY_OPTIONS;

  const allDifficultiesSelected =
    difficultyFilter.length === 0 ||
    (lessonId !== null
      ? difficultyFilter.length === ALL_DIFFICULTY_MARKS.length + 1 &&
        ALL_DIFFICULTY_MARKS.every(mark => difficultyFilter.includes(mark)) &&
        difficultyFilter.includes(-1)
      : difficultyFilter.length === ALL_DIFFICULTY_MARKS.length &&
        ALL_DIFFICULTY_MARKS.every(mark => difficultyFilter.includes(mark)) &&
        !difficultyFilter.includes(-1));
  const difficultyTriggerLabel = allDifficultiesSelected
    ? 'Difficulties'
    : difficultyFilter.join(', ');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const renderSortableHeader = (
    label: string,
    field: string,
    width: string
  ) => (
    <Table.ColumnHeaderCell
      style={{ width, cursor: 'pointer' }}
      onClick={() => handleSort(field)}
    >
      <Flex align="center" gap="1">
        <Text>{label}</Text>
        {sortField === field &&
          (sortDirection === 'asc' ? <CaretUpIcon /> : <CaretDownIcon />)}
      </Flex>
    </Table.ColumnHeaderCell>
  );

  const handleLingqImport = async () => {
    if (!lingqApiKey.trim()) {
      setImportError('Please enter your LingQ API key');
      return;
    }

    if (!selectedLanguage) {
      setImportError('Please select a language first');
      return;
    }

    try {
      setImportLoading(true);
      setImportError('');
      setImportSuccess('');

      // Call our backend endpoint which will handle the LingQ API calls
      const importResponse = await axiosInstance.post('/api/import/lingq', {
        apiKey: lingqApiKey,
        languageCode: selectedLanguage,
      });

      if (importResponse.data.success) {
        const { data } = importResponse.data;
        let message = importResponse.data.message;

        if (data && data.totalProcessed > 0) {
          message = `Successfully processed ${data.totalProcessed} words: ${data.imported} imported, ${data.updated} updated`;
          if (data.errors > 0) {
            message += `, ${data.errors} errors`;
          }
        }

        setImportSuccess(message);
        fetchWords(
          currentPage,
          appliedSearch,
          difficultyFilter,
          sortField,
          sortDirection,
          lessonId
        );
      } else {
        throw new Error(
          importResponse.data.message || 'Failed to import words'
        );
      }
    } catch (error) {
      console.error('LingQ import error:', error);
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.message ||
          error.message ||
          'Failed to import from LingQ. Please check your API key and try again.'
        : error instanceof Error
          ? error.message
          : 'Failed to import from LingQ. Please check your API key and try again.';
      setImportError(errorMessage);
    } finally {
      setImportLoading(false);
    }
  };

  const resetImportDialog = () => {
    setLingqApiKey('');
    setImportError('');
    setImportSuccess('');
    setImportLoading(false);
  };

  const handleImportDialogClose = () => {
    setImportDialogOpen(false);
    resetImportDialog();
  };

  const handleWordClick = (wordMark: WordUserMark) => {
    openWordSidebar(wordMark.word.word, wordMark.word.language_code);
  };

  return (
    <Box
      p="4"
      style={{
        width: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <Flex direction="column" gap="4" mb="6">
        <Flex align="center" justify="between">
          <Heading size="6">My Words</Heading>
          <Flex gap="2">
            <MyButton
              variant="soft"
              onClick={() => setImportDialogOpen(true)}
              disabled={loading}
            >
              <DownloadIcon />
              Import
            </MyButton>
            <MyButton variant="soft" onClick={handleRefresh} disabled={loading}>
              <ReloadIcon />
              Refresh
            </MyButton>
          </Flex>
        </Flex>

        <Text size="3" color="gray">
          {selectedLanguage
            ? `Words you've marked while learning ${selectedLanguage.toUpperCase()}`
            : "All words you've marked across all languages"}
        </Text>
      </Flex>

      <Separator size="4" mb="6" />

      {lessonFilterError && (
        <Callout.Root color="orange" mb="4">
          <Callout.Text>{lessonFilterError}</Callout.Text>
        </Callout.Root>
      )}

      {/* Filters */}
      <Flex gap="4" mb="6" wrap="wrap">
        {/* Search */}
        <Flex gap="2" style={{ flex: 1, minWidth: '300px' }}>
          <TextField.Root
            placeholder="Search words or notes..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1 }}
          >
            <TextField.Slot>
              <MagnifyingGlassIcon height="16" width="16" />
            </TextField.Slot>
          </TextField.Root>
          <MyButton onClick={handleSearch} disabled={loading}>
            Search
          </MyButton>
        </Flex>

        {/* Difficulty Filter */}
        <Popover.Root
          open={difficultyPickerOpen}
          onOpenChange={setDifficultyPickerOpen}
        >
          <Popover.Trigger>
            <MyButton
              variant="surface"
              color="gray"
              style={{
                minWidth: '200px',
                justifyContent: 'space-between',
                fontWeight: 'var(--font-weight-regular)',
              }}
            >
              <Text truncate style={{ maxWidth: '160px' }}>
                {difficultyTriggerLabel}
              </Text>
              <ChevronDownIcon width="12" height="12" />
            </MyButton>
          </Popover.Trigger>
          <Popover.Content
            align="start"
            style={{ width: '260px', padding: 'var(--space-2)' }}
          >
            <Flex direction="column" gap="2">
              {visibleDifficultyOptions.map(option => {
                const checked = difficultyFilter.includes(option.value);
                const checkboxId = `difficulty-mark-${option.value}`;
                return (
                  <Flex key={option.value} align="center" gap="2">
                    <Checkbox
                      id={checkboxId}
                      checked={checked}
                      onCheckedChange={value =>
                        handleDifficultyToggle(option.value, value === true)
                      }
                    />
                    <Text
                      size="2"
                      as="label"
                      htmlFor={checkboxId}
                      style={{ cursor: 'pointer' }}
                    >
                      {option.label}
                    </Text>
                  </Flex>
                );
              })}
            </Flex>
          </Popover.Content>
        </Popover.Root>

        {/* Lesson Filter — Popover styled like Select.Trigger */}
        <Popover.Root
          open={lessonPickerOpen}
          onOpenChange={open => {
            setLessonPickerOpen(open);
            if (open) {
              setLessonSearch('');
              setDebouncedLessonSearch('');
            }
          }}
        >
          <Popover.Trigger>
            <MyButton
              variant="surface"
              color="gray"
              style={{
                minWidth: '200px',
                justifyContent: 'space-between',
                fontWeight: 'var(--font-weight-regular)',
              }}
            >
              <Text truncate style={{ maxWidth: '160px' }}>
                {selectedLessonTitle || 'All lessons'}
              </Text>
              <ChevronDownIcon width="12" height="12" />
            </MyButton>
          </Popover.Trigger>
          <Popover.Content
            align="start"
            style={{ width: '280px', padding: 'var(--space-2)' }}
          >
            <Flex direction="column" gap="2">
              <TextField.Root
                size="2"
                placeholder="Search lessons..."
                value={lessonSearch}
                onChange={e => setLessonSearch(e.target.value)}
                autoFocus
              >
                <TextField.Slot>
                  <MagnifyingGlassIcon height="16" width="16" />
                </TextField.Slot>
              </TextField.Root>
              <Box style={{ maxHeight: '240px', overflowY: 'auto' }}>
                <Flex direction="column">
                  <Box
                    onClick={() => {
                      setLessonId(null);
                      setSelectedLessonTitle(null);
                      setLessonFilterError('');
                      setCurrentPage(1);
                      setLessonPickerOpen(false);
                    }}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 'var(--radius-2)',
                      cursor: 'pointer',
                      background:
                        lessonId === null ? 'var(--accent-a3)' : 'transparent',
                    }}
                  >
                    <Text
                      size="2"
                      weight={lessonId === null ? 'medium' : 'regular'}
                    >
                      All lessons
                    </Text>
                  </Box>
                  {lessonOptionsLoading && (
                    <Text size="2" color="gray" style={{ padding: '6px 8px' }}>
                      Loading...
                    </Text>
                  )}
                  {!lessonOptionsLoading &&
                    lessonOptions.map(lesson => (
                      <Box
                        key={lesson.id}
                        onClick={() => {
                          setLessonId(lesson.id);
                          setSelectedLessonTitle(lesson.title);
                          setLessonFilterError('');
                          setCurrentPage(1);
                          setLessonPickerOpen(false);
                        }}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-2)',
                          cursor: 'pointer',
                          background:
                            lessonId === lesson.id
                              ? 'var(--accent-a3)'
                              : 'transparent',
                        }}
                      >
                        <Text
                          size="2"
                          weight={lessonId === lesson.id ? 'medium' : 'regular'}
                          truncate
                          style={{ display: 'block', maxWidth: '260px' }}
                        >
                          {lesson.title}
                        </Text>
                      </Box>
                    ))}
                  {!lessonOptionsLoading && lessonOptions.length === 0 && (
                    <Text size="2" color="gray" style={{ padding: '6px 8px' }}>
                      No lessons found
                    </Text>
                  )}
                </Flex>
              </Box>
            </Flex>
          </Popover.Content>
        </Popover.Root>
      </Flex>

      {/* Loading State */}
      {loading && (
        <Flex
          direction="column"
          align="center"
          justify="center"
          style={{ minHeight: '300px' }}
        >
          <Text size="3" color="gray">
            Loading your words...
          </Text>
        </Flex>
      )}

      {/* Empty State */}
      {!loading && words.length === 0 && (
        <Flex
          direction="column"
          align="center"
          justify="center"
          style={{ minHeight: '300px' }}
        >
          <Text size="4" color="gray" mb="2">
            No words found
          </Text>
          <Text size="3" color="gray">
            {searchTerm || !allDifficultiesSelected
              ? 'Try adjusting your search or filter criteria'
              : 'Start marking words in lessons to see them here'}
          </Text>
        </Flex>
      )}

      {/* Words Table */}
      {!loading && words.length > 0 && (
        <>
          <Card style={{ overflow: 'hidden' }}>
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  {renderSortableHeader('Word', 'word', '16%')}
                  {renderSortableHeader('Difficulty', 'mark', '10%')}
                  {renderSortableHeader('Sentences', 'sentence_count', '8%')}
                  <Table.ColumnHeaderCell style={{ width: '34%' }}>
                    Example Sentences
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: '22%' }}>
                    Related Lessons
                  </Table.ColumnHeaderCell>
                  {renderSortableHeader('Last Updated', 'updated_at', '10%')}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {words.map(wordMark => (
                  <Table.Row key={wordMark.id}>
                    {/* Word */}
                    <Table.Cell>
                      <Flex direction="column" gap="1">
                        <Text
                          size="3"
                          weight="bold"
                          style={{
                            cursor: 'pointer',
                            color: 'var(--blue-9)',
                            textDecoration: 'underline',
                          }}
                          onClick={() => handleWordClick(wordMark)}
                        >
                          {wordMark.word.word}
                        </Text>
                        {wordMark.note && (
                          <Text
                            size="2"
                            color="gray"
                            style={{ fontStyle: 'italic' }}
                          >
                            "{truncateText(wordMark.note, 50)}"
                          </Text>
                        )}
                      </Flex>
                    </Table.Cell>

                    {/* Difficulty */}
                    <Table.Cell>
                      <Badge
                        color="gray"
                        variant="solid"
                        style={{
                          backgroundColor: getDifficultyColor(wordMark.mark),
                          color: 'white',
                          border:
                            wordMark.mark === 4 ? '1px dotted #FF9800' : 'none',
                        }}
                      >
                        {getDifficultyLabel(wordMark.mark)}
                      </Badge>
                    </Table.Cell>

                    {/* Sentence Count */}
                    <Table.Cell>
                      <Flex align="center" justify="center">
                        <Badge variant="soft" color="blue">
                          {wordMark.word.totalSentenceCount}
                        </Badge>
                      </Flex>
                    </Table.Cell>

                    {/* Example Sentences */}
                    <Table.Cell>
                      <Flex direction="column" gap="2">
                        {wordMark.word.sentences.length > 0 ? (
                          wordMark.word.sentences.map((sentence, index) => (
                            <Flex
                              key={sentence.id}
                              gap="1"
                              align="start"
                              wrap="wrap"
                            >
                              <Text size="2" color="gray">
                                {index + 1}.
                              </Text>
                              {sentence.split_text &&
                              sentence.split_text.length > 0 ? (
                                <Box style={{ lineHeight: 1.5 }}>
                                  <SentenceReConstructor
                                    sentence={sentence}
                                    fontSize="14px"
                                    onWordClick={word =>
                                      openWordSidebar(
                                        word,
                                        wordMark.word.language_code
                                      )
                                    }
                                  />
                                </Box>
                              ) : (
                                <Text size="2" color="gray">
                                  {truncateText(sentence.original_text, 80)}
                                </Text>
                              )}
                            </Flex>
                          ))
                        ) : (
                          <Text
                            size="2"
                            color="gray"
                            style={{ fontStyle: 'italic' }}
                          >
                            No sentences available
                          </Text>
                        )}
                      </Flex>
                    </Table.Cell>

                    {/* Related Lessons */}
                    <Table.Cell>
                      <Flex direction="column" gap="1">
                        {wordMark.word.lessons.length > 0 ? (
                          wordMark.word.lessons.map((lesson, index) => (
                            <Link
                              key={lesson.id}
                              onClick={() => navigate(`/lessons/${lesson.id}`)}
                              style={{ cursor: 'pointer' }}
                            >
                              <Text size="2" color="blue">
                                {index + 1}. {truncateText(lesson.title, 30)}
                              </Text>
                            </Link>
                          ))
                        ) : (
                          <Text
                            size="2"
                            color="gray"
                            style={{ fontStyle: 'italic' }}
                          >
                            No lessons found
                          </Text>
                        )}
                      </Flex>
                    </Table.Cell>

                    {/* Last Updated */}
                    <Table.Cell>
                      <Text size="2" color="gray">
                        {new Date(wordMark.updated_at).toLocaleDateString()}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card>

          {/* Pagination */}
          <Box mt="6">
            <Pagination
              currentPage={currentPage}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              disabled={loading}
            />
          </Box>

          {/* Stats */}
          <Flex align="center" justify="center" mt="4">
            <Text size="2" color="gray">
              Showing {words.length} of {pagination.total} words
            </Text>
          </Flex>
        </>
      )}

      {/* Import Dialog */}
      <Dialog.Root open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <Dialog.Content style={{ maxWidth: '600px' }}>
          <Dialog.Title>Import Words</Dialog.Title>
          <Dialog.Description>
            Import words from various sources to add to your vocabulary.
          </Dialog.Description>

          <Tabs.Root defaultValue="csv" style={{ marginTop: '20px' }}>
            <Tabs.List>
              <Tabs.Trigger value="csv">Upload CSV</Tabs.Trigger>
              <Tabs.Trigger value="lingq">Import from LingQ</Tabs.Trigger>
            </Tabs.List>

            <Box pt="4">
              {/* CSV Upload Tab */}
              <Tabs.Content value="csv">
                <Flex direction="column" gap="4">
                  <Text size="3" color="gray">
                    Upload a CSV file containing your words and their difficulty
                    marks.
                  </Text>

                  <Box
                    style={{
                      border: '2px dashed var(--gray-6)',
                      borderRadius: '8px',
                      padding: '40px',
                      textAlign: 'center',
                      backgroundColor: 'var(--gray-2)',
                    }}
                  >
                    <Text size="3" color="gray">
                      CSV upload functionality will be implemented soon.
                    </Text>
                    <Text
                      size="2"
                      color="gray"
                      style={{ display: 'block', marginTop: '8px' }}
                    >
                      Expected format: word, language_code, mark, note
                    </Text>
                  </Box>
                </Flex>
              </Tabs.Content>

              {/* LingQ Import Tab */}
              <Tabs.Content value="lingq">
                <Flex direction="column" gap="4">
                  <Text size="3" color="gray">
                    Import your LingQs from LingQ.com using your API key.
                  </Text>

                  {!selectedLanguage && (
                    <Box
                      style={{
                        padding: '12px',
                        backgroundColor: 'var(--amber-2)',
                        border: '1px solid var(--amber-6)',
                        borderRadius: '6px',
                      }}
                    >
                      <Text size="2" color="amber">
                        Please select a language first before importing from
                        LingQ.
                      </Text>
                    </Box>
                  )}

                  <Box>
                    <Text
                      size="2"
                      weight="bold"
                      mb="2"
                      style={{ display: 'block' }}
                    >
                      LingQ API Key
                    </Text>
                    <TextField.Root
                      placeholder="Enter your LingQ API key..."
                      value={lingqApiKey}
                      onChange={e => setLingqApiKey(e.target.value)}
                      disabled={importLoading}
                      type="password"
                    />
                    <Text
                      size="2"
                      color="gray"
                      style={{ display: 'block', marginTop: '4px' }}
                    >
                      You can find your API key in your LingQ account settings.
                      The key will not be stored and is only used for this
                      import.
                    </Text>
                  </Box>

                  {importError && (
                    <Box
                      style={{
                        padding: '12px',
                        backgroundColor: 'var(--red-2)',
                        border: '1px solid var(--red-6)',
                        borderRadius: '6px',
                      }}
                    >
                      <Flex align="center" gap="2">
                        <CrossCircledIcon color="var(--red-9)" />
                        <Text size="2" color="red">
                          {importError}
                        </Text>
                      </Flex>
                    </Box>
                  )}

                  {importSuccess && (
                    <Box
                      style={{
                        padding: '12px',
                        backgroundColor: 'var(--green-2)',
                        border: '1px solid var(--green-6)',
                        borderRadius: '6px',
                      }}
                    >
                      <Text size="2" color="green">
                        {importSuccess}
                      </Text>
                    </Box>
                  )}

                  <Flex gap="2" justify="end">
                    <MyButton
                      variant="soft"
                      onClick={resetImportDialog}
                      disabled={importLoading}
                    >
                      Reset
                    </MyButton>
                    <MyButton
                      onClick={handleLingqImport}
                      disabled={
                        importLoading ||
                        !selectedLanguage ||
                        !lingqApiKey.trim()
                      }
                      loading={importLoading}
                    >
                      {importLoading ? 'Importing...' : 'Import from LingQ'}
                    </MyButton>
                  </Flex>
                </Flex>
              </Tabs.Content>
            </Box>
          </Tabs.Root>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <MyButton
                variant="soft"
                color="gray"
                onClick={handleImportDialogClose}
              >
                Close
              </MyButton>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
};

export default WordsPage;
