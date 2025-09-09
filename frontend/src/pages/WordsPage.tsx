import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  Badge,
  TextField,
  Separator,
  Table,
  Select,
  Container,
  Heading,
  Card,
  Link,
  Dialog,
  Tabs,
} from '@radix-ui/themes';
import MyButton from '../components/MyButton';
import {
  MagnifyingGlassIcon,
  ReloadIcon,
  DownloadIcon,
  CrossCircledIcon,
  CaretUpIcon,
  CaretDownIcon,
} from '@radix-ui/react-icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Pagination from '../components/Pagination';
import {
  getDifficultyLabel,
  getDifficultyColor,
} from '../constants/difficultyColors';

interface Word {
  id: number;
  word: string;
  language_code: string;
  sentences: Array<{
    id: number;
    original_text: string;
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

const DIFFICULTY_OPTIONS = [
  { value: 'all', label: 'All Difficulties' },
  { value: '0', label: getDifficultyLabel(0) },
  { value: '1', label: getDifficultyLabel(1) },
  { value: '2', label: getDifficultyLabel(2) },
  { value: '3', label: getDifficultyLabel(3) },
  { value: '4', label: getDifficultyLabel(4) },
  { value: '5', label: getDifficultyLabel(5) },
];

const WordsPage: React.FC = () => {
  const { axiosInstance } = useAuth();
  const { selectedLanguage } = useLanguage();
  const navigate = useNavigate();
  const [words, setWords] = useState<WordUserMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string>('updated_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [lingqApiKey, setLingqApiKey] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  const fetchWords = async (
    page: number = 1,
    search: string = '',
    difficulty: string = '',
    sort: string = 'updated_at',
    direction: 'asc' | 'desc' = 'desc'
  ) => {
    if (!axiosInstance) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        sortBy: sort,
        sortOrder: direction,
      });

      if (difficulty && difficulty !== 'all') {
        params.append('mark', difficulty);
      }

      // Add language filter to backend request
      if (selectedLanguage) {
        params.append('language', selectedLanguage);
      }

      // Add search filter to backend request
      if (search) {
        params.append('search', search);
      }

      const response = await axiosInstance.get<WordsResponse>(
        `/api/words/marks/details?${params}`
      );

      if (response.data.success) {
        // No more frontend filtering - backend handles it all
        setWords(response.data.data.wordUserMarks);
        setPagination(response.data.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching words:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWords(
      currentPage,
      searchTerm,
      difficultyFilter,
      sortField,
      sortDirection
    );
  }, [
    axiosInstance,
    selectedLanguage,
    currentPage,
    difficultyFilter,
    sortField,
    sortDirection,
  ]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchWords(1, searchTerm, difficultyFilter, sortField, sortDirection);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRefresh = () => {
    fetchWords(
      currentPage,
      searchTerm,
      difficultyFilter,
      sortField,
      sortDirection
    );
  };

  const handleDifficultyChange = (value: string) => {
    setDifficultyFilter(value);
    setCurrentPage(1);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
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
        // Refresh the words list
        fetchWords(
          currentPage,
          searchTerm,
          difficultyFilter,
          sortField,
          sortDirection
        );
      } else {
        throw new Error(
          importResponse.data.message || 'Failed to import words'
        );
      }
    } catch (error: any) {
      console.error('LingQ import error:', error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Failed to import from LingQ. Please check your API key and try again.';
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

  return (
    <Container size="4" p="4">
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
            <MyButton
              variant="ghost"
              onClick={handleRefresh}
              disabled={loading}
            >
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
        <Select.Root
          value={difficultyFilter}
          onValueChange={handleDifficultyChange}
        >
          <Select.Trigger
            style={{ minWidth: '200px' }}
            placeholder="Filter by difficulty"
          />
          <Select.Content>
            {DIFFICULTY_OPTIONS.map(option => (
              <Select.Item key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
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
            {searchTerm || (difficultyFilter && difficultyFilter !== 'all')
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
                        <Text size="3" weight="bold">
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
                            <Text key={sentence.id} size="2" color="gray">
                              {index + 1}.{' '}
                              {truncateText(sentence.original_text, 80)}
                            </Text>
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
    </Container>
  );
};

export default WordsPage;
