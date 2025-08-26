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
import axios from 'axios';

interface Sentence {
  id: number;
  original_text: string;
  split_text: string[] | null;
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

  useEffect(() => {
    const fetchLesson = async () => {
      if (!lessonId || !isAuthenticated) return;

      try {
        setLoading(true);
        setError(null);

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
                        <Badge key={wordIndex} variant="soft" size="2">
                          {word}
                        </Badge>
                      ))}
                    </Flex>
                  </Box>
                )}
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
    </Container>
  );
};

export default LessonViewPage;
