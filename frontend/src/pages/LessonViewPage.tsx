import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Flex,
  Heading,
  Text,
  Box,
  Card,
  Badge,
  Separator,
} from '@radix-ui/themes';
import MyButton from '../components/MyButton';

import { useAuth } from '../contexts/AuthContext';
import { useWordMark } from '../contexts/WordMarkContext';
import WordSidebar from '../components/WordSidebar';
import Pagination from '../components/Pagination';
import LessonEditDialog from '../components/LessonEditDialog';
import SentenceAudioPlayer from '../components/SentenceAudioPlayer';
import SentenceReconstructor from '../components/SentenceReconstructor';
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
  lessonType?: string;
  sentences: Sentence[];
  totalSentences: number;
  audioUrl?: string;
  userProgress?: {
    status: string;
    readTillSentenceId: number;
    shouldNavigateToPage: number;
  } | null;
}

// Lesson interface for the edit dialog (simpler structure)
interface EditableLesson {
  id: number;
  title: string;
  languageCode: string;
  imageUrl?: string;
  fileUrl?: string;
  audioUrl?: string;
  createdAt: string;
}

const SENTENCES_PER_PAGE = 5;

const LessonViewPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();

  const navigate = useNavigate();
  const { axiosInstance, isAuthenticated, isLoading: authLoading } = useAuth();
  const { addWords } = useWordMark();
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
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isFinishingLesson, setIsFinishingLesson] = useState(false);

  // Redirect manga lessons to manga view page
  useEffect(() => {
    if (lesson && lesson.lessonType === 'manga') {
      navigate(`/lessons/${lessonId}/manga`);
    }
  }, [lesson, navigate, lessonId]);

  // First useEffect: Load progress and determine initial page
  useEffect(() => {
    const loadInitialProgress = async () => {
      if (!lessonId || !isAuthenticated || !isInitialLoad) return;

      try {
        const progressResponse = await axiosInstance.get(
          `/api/lessons/${lessonId}/progress`,
          {
            params: {
              sentencesPerPage: SENTENCES_PER_PAGE,
            },
          }
        );

        if (progressResponse.data.success && progressResponse.data.progress) {
          const targetPage = progressResponse.data.shouldNavigateToPage || 1;
          if (targetPage !== currentPage) {
            setCurrentPage(targetPage);
          }
        }
      } catch (error) {
        console.error('Error loading initial progress:', error);
        // Continue with page 1 if progress loading fails
      } finally {
        setProgressLoaded(true);
        setIsInitialLoad(false);
      }
    };

    loadInitialProgress();
  }, [lessonId, isAuthenticated, isInitialLoad, axiosInstance]);

  // Second useEffect: Load sentences after progress is determined
  useEffect(() => {
    const fetchLesson = async () => {
      if (!lessonId || !isAuthenticated || !progressLoaded) return;

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
          const lessonData = response.data.lesson;
          setLesson(lessonData);

          // Collect all unique words from the lesson sentences
          const allWords = new Set<string>();
          lessonData.sentences.forEach((sentence: Sentence) => {
            if (sentence.split_text) {
              sentence.split_text.forEach((word: string) => allWords.add(word));
            }
          });

          // Add words to context - it will automatically fetch marks for unfetched words
          if (allWords.size > 0 && lessonData.languageCode) {
            await addWords(Array.from(allWords), lessonData.languageCode);
          }
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
  }, [lessonId, currentPage, isAuthenticated, axiosInstance, progressLoaded]);

  // Track progress when page changes (but not on initial load)
  useEffect(() => {
    const updateProgress = async () => {
      if (
        !lessonId ||
        !isAuthenticated ||
        isInitialLoad ||
        !progressLoaded ||
        !currentPage
      )
        return;

      try {
        await axiosInstance.post(`/api/lessons/${lessonId}/progress`, {
          currentPage,
          sentencesPerPage: SENTENCES_PER_PAGE,
        });
      } catch (error) {
        console.error('Error updating progress:', error);
        // Don't show error to user for progress tracking failures
      }
    };

    updateProgress();
  }, [
    currentPage,
    lessonId,
    isAuthenticated,
    isInitialLoad,
    progressLoaded,
    axiosInstance,
  ]);

  const totalPages = lesson
    ? Math.ceil(lesson.totalSentences / SENTENCES_PER_PAGE)
    : 0;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleWordClick = (word: string) => {
    setSelectedWord(word);
    setIsSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
    setSelectedWord(null);
  };

  const handleLessonUpdated = (updatedLesson?: Partial<EditableLesson>) => {
    // Update the lesson title in the current state without reloading sentences
    if (lesson && updatedLesson) {
      setLesson(prevLesson => ({
        ...prevLesson!,
        ...updatedLesson,
      }));
    }
    setIsEditDialogOpen(false);
  };

  const handleFinishLesson = async () => {
    if (!lessonId || !isAuthenticated || isFinishingLesson) return;

    try {
      setIsFinishingLesson(true);

      await axiosInstance.post(`/api/lessons/${lessonId}/progress`, {
        currentPage,
        sentencesPerPage: SENTENCES_PER_PAGE,
        finishLesson: true,
      });

      // Update the lesson state to reflect completion
      if (lesson) {
        setLesson(prevLesson => ({
          ...prevLesson!,
          userProgress: {
            ...prevLesson!.userProgress!,
            status: 'finished',
          },
        }));
      }
    } catch (error) {
      console.error('Error finishing lesson:', error);
      // Could add error handling/notification here
    } finally {
      setIsFinishingLesson(false);
    }
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
          <MyButton variant="ghost" onClick={() => navigate('/lessons')}>
            ← Back to Lessons
          </MyButton>
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
        <MyButton variant="ghost" onClick={() => navigate('/lessons')}>
          ← Back to Lessons
        </MyButton>
        <Flex align="center" gap="3" justify="between">
          <Flex align="center" gap="3">
            <Heading size="6">{lesson.title}</Heading>
            <Badge variant="soft">{lesson.languageCode.toUpperCase()}</Badge>
          </Flex>
          <Flex gap="3">
            {lesson?.lessonType !== 'manga' && (
              <MyButton
                variant="soft"
                onClick={() => navigate(`/lessons/${lessonId}/video`)}
              >
                Video View
              </MyButton>
            )}
            {lesson?.lessonType === 'manga' && (
              <MyButton
                variant="soft"
                onClick={() => navigate(`/lessons/${lessonId}/manga`)}
              >
                Manga View
              </MyButton>
            )}
            <MyButton variant="soft" onClick={() => setIsEditDialogOpen(true)}>
              Edit Lesson
            </MyButton>
          </Flex>
        </Flex>
        <Flex direction="column" gap="1">
          <Text size="3" color="gray">
            {lesson.totalSentences} sentences total
          </Text>
          {lesson.userProgress && (
            <Text
              size="2"
              color={
                lesson.userProgress.status === 'finished' ? 'green' : 'blue'
              }
            >
              Status:{' '}
              {lesson.userProgress.status === 'reading'
                ? 'In Progress'
                : 'Completed'}
              {lesson.userProgress.status === 'reading' &&
                ` • Last read: Page ${lesson.userProgress.shouldNavigateToPage}`}
              {lesson.userProgress.status === 'finished' && ' 🎉'}
            </Text>
          )}
        </Flex>
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
                  {sentence.start_time &&
                    sentence.end_time &&
                    lesson.audioUrl && (
                      <SentenceAudioPlayer
                        audioUrl={lesson.audioUrl}
                        startTime={sentence.start_time}
                        endTime={sentence.end_time}
                      />
                    )}
                </Flex>

                <Box
                  style={{ lineHeight: '1.6', fontSize: 'var(--font-size-4)' }}
                >
                  {sentence.split_text && sentence.split_text.length > 0 ? (
                    <SentenceReconstructor
                      sentence={sentence}
                      fontSize="18px"
                      onWordClick={handleWordClick}
                      fallbackToOriginalText={false}
                      className="word-badge"
                    />
                  ) : (
                    <Text size="4" style={{ lineHeight: '1.6' }}>
                      {sentence.original_text}
                    </Text>
                  )}
                </Box>

                {/* Translation Section */}
                <Box>
                  <MyButton
                    variant="soft"
                    size="2"
                    onClick={() => toggleTranslation(sentence.id)}
                    disabled={loadingTranslations[sentence.id]}
                    style={{}}
                  >
                    {loadingTranslations[sentence.id]
                      ? 'Loading translation...'
                      : translations[sentence.id]
                        ? 'Hide translation'
                        : 'Show translation'}
                  </MyButton>

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
                        style={{
                          fontStyle: 'italic',
                          marginLeft: 10,
                          whiteSpace: 'pre-line',
                        }}
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
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        disabled={loading}
      />

      {/* Finish Lesson Button - Show only on last page if lesson is not finished */}
      {currentPage === totalPages &&
        lesson?.userProgress?.status !== 'finished' && (
          <Flex justify="center" mt="6">
            <MyButton
              size="3"
              variant="solid"
              color="green"
              onClick={handleFinishLesson}
              disabled={isFinishingLesson}
              style={{}}
            >
              {isFinishingLesson ? 'Finishing Lesson...' : 'Finish Lesson'}
            </MyButton>
          </Flex>
        )}

      {/* Word Translation Sidebar */}
      <WordSidebar
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        selectedWord={selectedWord}
        languageCode={lesson?.languageCode}
        targetLanguage="en"
      />

      {/* Lesson Edit Dialog */}
      {lesson && (
        <LessonEditDialog
          lesson={{
            id: lesson.id,
            title: lesson.title,
            languageCode: lesson.languageCode,
            createdAt: new Date().toISOString(), // Placeholder
          }}
          onLessonUpdated={handleLessonUpdated}
          trigger={null} // We'll control the dialog open state externally
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        />
      )}
    </Container>
  );
};

export default LessonViewPage;
