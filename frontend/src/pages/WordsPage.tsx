import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  Badge,
  TextField,
  Separator,
  Table,
  Select,
  Container,
  Heading,
  Card,
  Link,
} from '@radix-ui/themes';
import { MagnifyingGlassIcon, ReloadIcon } from '@radix-ui/react-icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Pagination from '../components/Pagination';

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

const getMarkColor = (mark: number) => {
  switch (mark) {
    case 0:
      return 'gray' as const;
    case 1:
      return 'red' as const;
    case 2:
      return 'orange' as const;
    case 3:
      return 'yellow' as const;
    case 4:
      return 'green' as const;
    case 5:
      return 'blue' as const;
    default:
      return 'gray' as const;
  }
};

const getMarkLabel = (mark: number): string => {
  switch (mark) {
    case 0:
      return 'Ignore';
    case 1:
      return "Don't Remember";
    case 2:
      return 'Hard to Remember';
    case 3:
      return 'Remembered';
    case 4:
      return 'Easy to Remember';
    case 5:
      return 'No Problem';
    default:
      return 'Unknown';
  }
};

const DIFFICULTY_OPTIONS = [
  { value: 'all', label: 'All Difficulties' },
  { value: '0', label: 'Ignore' },
  { value: '1', label: "Don't Remember" },
  { value: '2', label: 'Hard to Remember' },
  { value: '3', label: 'Remembered' },
  { value: '4', label: 'Easy to Remember' },
  { value: '5', label: 'No Problem' },
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
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  const fetchWords = async (
    page: number = 1,
    search: string = '',
    difficulty: string = ''
  ) => {
    if (!axiosInstance) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });

      if (difficulty && difficulty !== 'all') {
        params.append('mark', difficulty);
      }

      const response = await axiosInstance.get<WordsResponse>(
        `/api/words/marks/details?${params}`
      );

      if (response.data.success) {
        let filteredWords = response.data.data.wordUserMarks;

        // Filter by language if selected
        if (selectedLanguage && selectedLanguage !== 'all') {
          filteredWords = filteredWords.filter(
            wordMark => wordMark.word.language_code === selectedLanguage
          );
        }

        // Filter by search term
        if (search) {
          filteredWords = filteredWords.filter(
            wordMark =>
              wordMark.word.word.toLowerCase().includes(search.toLowerCase()) ||
              wordMark.note.toLowerCase().includes(search.toLowerCase())
          );
        }

        setWords(filteredWords);
        setPagination(response.data.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching words:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWords(currentPage, searchTerm, difficultyFilter);
  }, [axiosInstance, selectedLanguage, currentPage, difficultyFilter]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchWords(1, searchTerm, difficultyFilter);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRefresh = () => {
    fetchWords(currentPage, searchTerm, difficultyFilter);
  };

  const handleDifficultyChange = (value: string) => {
    setDifficultyFilter(value);
    setCurrentPage(1);
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <Container size="4" p="4">
      {/* Header */}
      <Flex direction="column" gap="4" mb="6">
        <Flex align="center" justify="between">
          <Heading size="6">My Words</Heading>
          <Button variant="ghost" onClick={handleRefresh} disabled={loading}>
            <ReloadIcon />
            Refresh
          </Button>
        </Flex>

        <Text size="3" color="gray">
          {selectedLanguage && selectedLanguage !== 'all'
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
          <Button onClick={handleSearch} disabled={loading}>
            Search
          </Button>
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
                  <Table.ColumnHeaderCell style={{ width: '15%' }}>
                    Word
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: '10%' }}>
                    Difficulty
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: '8%' }}>
                    Language
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: '35%' }}>
                    Example Sentences
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: '20%' }}>
                    Related Lessons
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: '12%' }}>
                    Last Updated
                  </Table.ColumnHeaderCell>
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
                        color={getMarkColor(wordMark.mark)}
                        variant="solid"
                      >
                        {getMarkLabel(wordMark.mark)}
                      </Badge>
                    </Table.Cell>

                    {/* Language */}
                    <Table.Cell>
                      <Badge color="blue" variant="soft">
                        {wordMark.word.language_code.toUpperCase()}
                      </Badge>
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
    </Container>
  );
};

export default WordsPage;
