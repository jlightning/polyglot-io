import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Flex,
  Heading,
  Text,
  Box,
  Button,
  Card,
  Badge,
  Separator,
  IconButton,
} from '@radix-ui/themes';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { useAuth } from '../contexts/AuthContext';
import WordSidebar from '../components/WordSidebar';
import axios from 'axios';

interface WordTranslation {
  word: string;
  translation: string;
}

interface WordPronunciation {
  word: string;
  pronunciation: string;
  pronunciationType: string;
}

interface Sentence {
  id: number;
  original_text: string;
  split_text: string[] | null;
  word_translations?: WordTranslation[] | null;
  word_pronunciations?: WordPronunciation[] | null;
  start_time: number | null;
  end_time: number | null;
}

interface Lesson {
  id: number;
  title: string;
  languageCode: string;
  sentences: Sentence[];
  totalSentences: number;
}

const SENTENCES_PER_PAGE = 5;

const LessonViewPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { axiosInstance, isAuthenticated, isLoading: authLoading } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [translations, setTranslations] = useState<{ [key: number]: string }>(
    {}
  );
  const [loadingTranslations, setLoadingTranslations] = useState<{
    [key: number]: boolean;
  }>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [currentWordTranslations, setCurrentWordTranslations] = useState<
    WordTranslation[] | null
  >(null);
  const [currentWordPronunciations, setCurrentWordPronunciations] = useState<
    WordPronunciation[] | null
  >(null);

  useEffect(() => {
    const fetchLesson = async () => {
      if (!lessonId || !isAuthenticated) return;

      try {
        setLoading(true);
        setError(null);
        // Clear translations when changing pages
        setTranslations({});
        setLoadingTranslations({});

        const response = await axiosInstance.get(
          `/api/lessons/${lessonId}/sentences`,
          {
            params: {
              page: currentPage,
              limit: SENTENCES_PER_PAGE,
            },
          }
        );

        if (response.data.success) {
          setLesson(response.data.lesson);
        } else {
          setError(response.data.message || 'Failed to load lesson');
        }
      } catch (err) {
        console.error('Error fetching lesson:', err);
        if (axios.isAxiosError(err) && err.response?.data?.message) {
          setError(err.response.data.message);
        } else {
          setError('Failed to load lesson');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLesson();
  }, [lessonId, currentPage, isAuthenticated, axiosInstance]);

  const totalPages = lesson
    ? Math.ceil(lesson.totalSentences / SENTENCES_PER_PAGE)
    : 0;

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleWordClick = (
    word: string,
    sentenceTranslations: WordTranslation[] | null,
    sentencePronunciations: WordPronunciation[] | null
  ) => {
    setSelectedWord(word);
    setCurrentWordTranslations(sentenceTranslations);
    setCurrentWordPronunciations(sentencePronunciations);
    setIsSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
    setSelectedWord(null);
    setCurrentWordTranslations(null);
    setCurrentWordPronunciations(null);
  };

  const toggleTranslation = async (sentenceId: number) => {
    // If translation is already shown, hide it
    if (translations[sentenceId]) {
      setTranslations(prev => {
        const newTranslations = { ...prev };
        delete newTranslations[sentenceId];
        return newTranslations;
      });
      return;
    }

    // If already loading, do nothing
    if (loadingTranslations[sentenceId]) {
      return;
    }

    // Fetch translation
    try {
      setLoadingTranslations(prev => ({ ...prev, [sentenceId]: true }));

      const response = await axiosInstance.get(
        `/api/lessons/sentences/${sentenceId}/translation`
      );

      if (response.data.success) {
        setTranslations(prev => ({
          ...prev,
          [sentenceId]: response.data.translation,
        }));
      } else {
        console.error('Failed to fetch translation:', response.data.message);
      }
    } catch (err) {
      console.error('Error fetching translation:', err);
    } finally {
      setLoadingTranslations(prev => ({ ...prev, [sentenceId]: false }));
    }
  };

  if (authLoading || loading) {
    return (
      <Container size="4" p="4">
        <Flex
          direction="column"
          align="center"
          justify="center"
          style={{ minHeight: '50vh' }}
        >
          <Text size="3">Loading lesson...</Text>
        </Flex>
      </Container>
    );
  }

  if (!isAuthenticated) {
    return (
      <Container size="4" p="4">
        <Flex
          direction="column"
          align="center"
          justify="center"
          style={{ minHeight: '50vh' }}
        >
          <Text size="3" color="red">
            Please log in to view lessons
          </Text>
        </Flex>
      </Container>
    );
  }

  if (error || !lesson) {
    return (
      <Container size="4" p="4">
        <Flex direction="column" gap="4">
          <Button variant="ghost" onClick={() => navigate('/lessons')}>
            ← Back to Lessons
          </Button>
          <Flex
            direction="column"
            align="center"
            justify="center"
            style={{ minHeight: '50vh' }}
          >
            <Text size="3" color="red">
              {error || 'Lesson not found'}
            </Text>
          </Flex>
        </Flex>
      </Container>
    );
  }

  return (
    <Container size="4" p="4">
      {/* Header */}
      <Flex direction="column" gap="4" mb="6">
        <Button variant="ghost" onClick={() => navigate('/lessons')}>
          ← Back to Lessons
        </Button>
        <Flex align="center" gap="3">
          <Heading size="6">{lesson.title}</Heading>
          <Badge variant="soft">{lesson.languageCode.toUpperCase()}</Badge>
        </Flex>
        <Text size="3" color="gray">
          {lesson.totalSentences} sentences total
        </Text>
      </Flex>

      <Separator size="4" mb="4" />

      {/* Sentences */}
      <Box mb="6">
        <Flex direction="column" gap="4">
          {lesson.sentences.map((sentence, index) => (
            <Card key={sentence.id} style={{ padding: '16px' }}>
              <Flex direction="column" gap="3">
                <Flex align="center" justify="between">
                  <Text size="2" color="gray">
                    Sentence{' '}
                    {(currentPage - 1) * SENTENCES_PER_PAGE + index + 1}
                  </Text>
                  {sentence.start_time && sentence.end_time && (
                    <Text size="2" color="gray">
                      {sentence.start_time}s - {sentence.end_time}s
                    </Text>
                  )}
                </Flex>

                <Text size="4" style={{ lineHeight: '1.6' }}>
                  {sentence.original_text}
                </Text>

                {sentence.split_text && sentence.split_text.length > 0 && (
                  <Box>
                    <Text size="2" color="gray" mb="2">
                      Word breakdown:
                    </Text>
                    <Flex gap="2" wrap="wrap">
                      {sentence.split_text.map((word, wordIndex) => (
                        <Badge
                          key={wordIndex}
                          variant="soft"
                          size="2"
                          style={{
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                          className="word-badge"
                          onClick={() =>
                            handleWordClick(
                              word,
                              sentence.word_translations || null,
                              sentence.word_pronunciations || null
                            )
                          }
                        >
                          {word}
                        </Badge>
                      ))}
                    </Flex>
                  </Box>
                )}

                {/* Translation Section */}
                <Box>
                  <Button
                    variant="soft"
                    size="2"
                    onClick={() => toggleTranslation(sentence.id)}
                    disabled={loadingTranslations[sentence.id]}
                  >
                    {loadingTranslations[sentence.id]
                      ? 'Loading translation...'
                      : translations[sentence.id]
                        ? 'Hide translation'
                        : 'Show translation'}
                  </Button>

                  {translations[sentence.id] && (
                    <Box
                      mt="3"
                      p="3"
                      style={{
                        backgroundColor: 'var(--gray-2)',
                        borderRadius: '8px',
                      }}
                    >
                      <Text size="2" color="gray" mb="1">
                        Translation:
                      </Text>
                      <Text
                        size="3"
                        style={{ fontStyle: 'italic', marginLeft: 10 }}
                      >
                        {translations[sentence.id]}
                      </Text>
                    </Box>
                  )}
                </Box>
              </Flex>
            </Card>
          ))}
        </Flex>
      </Box>

      {/* Pagination */}
      {totalPages > 1 && (
        <Flex align="center" justify="center" gap="4">
          <IconButton
            variant="soft"
            disabled={currentPage === 1}
            onClick={handlePreviousPage}
          >
            <ChevronLeftIcon />
          </IconButton>

          <Text size="3">
            Page {currentPage} of {totalPages}
          </Text>

          <IconButton
            variant="soft"
            disabled={currentPage === totalPages}
            onClick={handleNextPage}
          >
            <ChevronRightIcon />
          </IconButton>
        </Flex>
      )}

      {/* Word Translation Sidebar */}
      <WordSidebar
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        selectedWord={selectedWord}
        wordTranslations={currentWordTranslations}
        wordPronunciations={currentWordPronunciations}
      />
    </Container>
  );
};

export default LessonViewPage;
