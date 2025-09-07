import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Flex,
  Heading,
  Text,
  Box,
  Button,
  Card,
  Badge,
} from '@radix-ui/themes';

import { useAuth } from '../contexts/AuthContext';
import { useWordMark } from '../contexts/WordMarkContext';
import WordSidebar from '../components/WordSidebar';
import { getDifficultyStyles } from '../constants/difficultyColors';
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

interface LessonFile {
  id: number;
  fileS3Key: string;
  imageUrl?: string;
}

interface Lesson {
  id: number;
  title: string;
  languageCode: string;
  lessonType: string;
  sentences: Sentence[];
  totalSentences: number;
  lessonFiles: LessonFile[];
  userProgress?: {
    status: string;
    readTillSentenceId: number;
    shouldNavigateToPage: number;
    sentenceInfo?: {
      id: number;
      originalText: string;
      startTime: number | null;
      endTime: number | null;
    };
  } | null;
}

const SENTENCES_PER_PAGE = 100;

const LessonMangaViewPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { axiosInstance, isAuthenticated, isLoading: authLoading } = useAuth();
  const { getWordMark, addWords } = useWordMark();

  // Use a ref to store the current addWords function to avoid callback recreations
  const addWordsRef = useRef(addWords);
  addWordsRef.current = addWords;

  // Manga page state
  const [currentMangaPageIndex, setCurrentMangaPageIndex] = useState(0);

  // Lesson progress state
  const [isFinishingLesson, setIsFinishingLesson] = useState(false);
  const [lessonCompleted, setLessonCompleted] = useState(false);

  // Lesson and sentence state
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sentence display tracking
  const [displaySentences, setDisplaySentences] = useState<Sentence[]>([]);
  const [loadingSentences, setLoadingSentences] = useState(false);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);

  // Translation state
  const [translations, setTranslations] = useState<{ [key: number]: string }>(
    {}
  );
  const [loadingTranslations, setLoadingTranslations] = useState<{
    [key: number]: boolean;
  }>({});

  // Word sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [currentWordTranslations, setCurrentWordTranslations] = useState<
    WordTranslation[] | null
  >(null);
  const [currentWordPronunciations, setCurrentWordPronunciations] = useState<
    WordPronunciation[] | null
  >(null);

  // OCR selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const imageRef = useRef<HTMLImageElement>(null);

  // Load basic lesson info and first page of sentences
  useEffect(() => {
    const fetchLessonInfo = async () => {
      if (!lessonId || !isAuthenticated) return;

      try {
        setLoading(true);
        setError(null);

        // Get lesson metadata first (without sentences)
        const lessonResponse = await axiosInstance.get(
          `/api/lessons/${lessonId}`
        );

        // Also fetch the current progress
        const progressResponse = await axiosInstance.get(
          `/api/lessons/${lessonId}/progress`,
          {
            params: {
              sentencesPerPage: SENTENCES_PER_PAGE,
            },
          }
        );

        if (lessonResponse.data.success) {
          const lessonData = lessonResponse.data.lesson;

          // Check if this is actually a manga lesson
          if (lessonData.lessonType !== 'manga') {
            setError('This lesson is not a manga lesson');
            return;
          }

          const lesson = {
            id: lessonData.id,
            title: lessonData.title,
            languageCode: lessonData.languageCode,
            lessonType: lessonData.lessonType,
            sentences: [],
            totalSentences: lessonData.totalSentences || 0,
            lessonFiles: lessonData.lessonFiles || [],
            userProgress: progressResponse.data.success
              ? progressResponse.data.progress
              : null,
          };

          setLesson(lesson);

          // Restore user progress by finding the correct manga page
          if (
            progressResponse.data.success &&
            progressResponse.data.progress?.readTillSentenceId
          ) {
            await restoreUserProgress(
              lesson,
              progressResponse.data.progress.readTillSentenceId
            );
          } else {
            // No previous progress, start from first page
            setHasRestoredProgress(true);
          }

          // Sentences will be loaded separately for each manga page

          // Words will be added when sentences are loaded for each manga page
        } else {
          setError(lessonResponse.data.message || 'Failed to load lesson');
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

    fetchLessonInfo();
  }, [lessonId, isAuthenticated, axiosInstance]);

  // Load sentences for the current manga page
  const loadSentencesForMangaPage = useCallback(
    async (mangaPageIndex: number) => {
      if (!lessonId || !isAuthenticated || !lesson?.lessonFiles) {
        return;
      }

      const currentFile = lesson.lessonFiles[mangaPageIndex];
      if (!currentFile) {
        return;
      }

      try {
        setLoadingSentences(true);
        setDisplaySentences([]);

        const response = await axiosInstance.get(
          `/api/lessons/${lessonId}/sentences`,
          {
            params: {
              lesson_file_id: currentFile.id,
              page: 1,
              limit: 100,
            },
          }
        );

        if (response.data.success) {
          const sentences = response.data.lesson.sentences;
          setDisplaySentences(sentences);

          // Collect all unique words and add them to word context asynchronously
          if (lesson?.languageCode) {
            setTimeout(async () => {
              const allWords = new Set<string>();
              sentences.forEach((sentence: Sentence) => {
                if (sentence.split_text) {
                  sentence.split_text.forEach((word: string) =>
                    allWords.add(word)
                  );
                }
              });

              if (allWords.size > 0) {
                try {
                  await addWordsRef.current(
                    Array.from(allWords),
                    lesson.languageCode
                  );
                } catch (err) {
                  console.error('Error adding words to context:', err);
                }
              }
            }, 0);
          }
        }
      } catch (err) {
        console.error('Error loading sentences for manga page:', err);
      } finally {
        setLoadingSentences(false);
      }
    },
    [
      lessonId,
      isAuthenticated,
      axiosInstance,
      lesson?.lessonFiles,
      lesson?.languageCode,
    ]
  );

  // Restore user progress by finding which manga page contains the target sentence
  const restoreUserProgress = useCallback(
    async (lessonData: Lesson, targetSentenceId: number) => {
      if (!lessonId || !isAuthenticated || !lessonData.lessonFiles) {
        return;
      }

      try {
        // Check each manga page to find which one contains the target sentence
        for (
          let pageIndex = 0;
          pageIndex < lessonData.lessonFiles.length;
          pageIndex++
        ) {
          const file = lessonData.lessonFiles[pageIndex];

          if (!file) continue;

          const response = await axiosInstance.get(
            `/api/lessons/${lessonId}/sentences`,
            {
              params: {
                lesson_file_id: file.id,
                page: 1,
                limit: 100,
              },
            }
          );

          if (response.data.success) {
            const sentences = response.data.lesson.sentences;
            const foundSentence = sentences.find(
              (s: Sentence) => s.id === targetSentenceId
            );

            if (foundSentence) {
              // Found the target sentence on this manga page
              setCurrentMangaPageIndex(pageIndex);
              setHasRestoredProgress(true);
              return;
            }
          }
        }

        // If not found in any page, stay on first page
        setHasRestoredProgress(true);
      } catch (err) {
        console.error('Error restoring user progress:', err);
        setHasRestoredProgress(true);
      }
    },
    [lessonId, isAuthenticated, axiosInstance]
  );

  // Update lesson progress with debouncing
  const updateLessonProgress = useCallback(
    async (sentenceId: number) => {
      if (!lessonId || !isAuthenticated) return;

      try {
        await axiosInstance.post(`/api/lessons/${lessonId}/progress/sentence`, {
          sentenceId: sentenceId,
        });
      } catch (error) {
        console.error('Error updating lesson progress:', error);
      }
    },
    [lessonId, isAuthenticated, axiosInstance]
  );

  // Load sentences when manga page changes or lesson is first loaded
  useEffect(() => {
    if (
      lesson?.lessonFiles &&
      lesson.lessonFiles.length > 0 &&
      hasRestoredProgress
    ) {
      loadSentencesForMangaPage(currentMangaPageIndex);
    }
  }, [
    currentMangaPageIndex,
    lesson?.lessonFiles,
    loadSentencesForMangaPage,
    hasRestoredProgress,
  ]);

  // Update progress when manga page changes (after restoration)
  useEffect(() => {
    if (hasRestoredProgress && displaySentences.length > 0 && lesson) {
      // Update progress to the first sentence of the current page
      const firstSentence = displaySentences[0];
      if (firstSentence) {
        updateLessonProgress(firstSentence.id);
      }
    }
  }, [currentMangaPageIndex, displaySentences, hasRestoredProgress, lesson]);

  // Manga page navigation
  const navigateToNextMangaPage = () => {
    if (loadingSentences) return; // Prevent navigation while loading
    if (lesson && currentMangaPageIndex < lesson.lessonFiles.length - 1) {
      setCurrentMangaPageIndex(currentMangaPageIndex + 1);
    }
  };

  const navigateToPreviousMangaPage = () => {
    if (loadingSentences) return; // Prevent navigation while loading
    if (currentMangaPageIndex > 0) {
      setCurrentMangaPageIndex(currentMangaPageIndex - 1);
    }
  };

  // Sentence reconstruction with clickable words
  const reconstructSentenceWithWords = (
    sentence: Sentence,
    fontSize = '16px'
  ) => {
    const {
      original_text: originalText,
      split_text: splitWords,
      word_translations,
      word_pronunciations,
    } = sentence;

    if (!splitWords || splitWords.length === 0) {
      return originalText;
    }

    const createWordBadge = (word: string, index: number) => {
      const wordMark = getWordMark(word);
      return (
        <Badge
          key={index}
          variant="soft"
          size="2"
          style={{
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            color: 'white',
            margin: '0',
            padding: '2px 0',
            fontSize,
            ...(wordMark !== undefined
              ? getDifficultyStyles(wordMark)
              : { border: '1px solid transparent' }),
          }}
          onClick={() =>
            handleWordClick(
              word,
              word_translations || null,
              word_pronunciations || null
            )
          }
        >
          {word}
        </Badge>
      );
    };

    const elements: (string | JSX.Element)[] = [];
    let currentIndex = 0;
    let wordIndex = 0;

    for (const word of splitWords) {
      const wordStartIndex = originalText.indexOf(word, currentIndex);

      if (wordStartIndex !== -1) {
        if (wordStartIndex > currentIndex) {
          const beforeWord = originalText.slice(currentIndex, wordStartIndex);
          elements.push(beforeWord);
        }
        currentIndex = wordStartIndex + word.length;
      }

      elements.push(createWordBadge(word, wordIndex));
      wordIndex++;
    }

    if (currentIndex < originalText.length) {
      elements.push(originalText.slice(currentIndex));
    }

    return elements;
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

  const handleFinishLesson = async () => {
    if (!lessonId || !isAuthenticated || isFinishingLesson) return;

    try {
      setIsFinishingLesson(true);

      // Mark lesson as finished
      await axiosInstance.post(`/api/lessons/${lessonId}/progress`, {
        currentPage: 1,
        sentencesPerPage: 1,
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

      setLessonCompleted(true);
    } catch (error) {
      console.error('Error finishing lesson:', error);
    } finally {
      setIsFinishingLesson(false);
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelection(null);
    setIsSelecting(false);
    setStartPoint(null);
  };

  const getRelativeCoordinates = useCallback(
    (clientX: number, clientY: number) => {
      if (!imageRef.current) return { x: 0, y: 0 };

      const imageRect = imageRef.current.getBoundingClientRect();

      // Calculate relative coordinates within the actual image bounds
      const x = (clientX - imageRect.left) / imageRect.width;
      const y = (clientY - imageRect.top) / imageRect.height;

      return {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      };
    },
    []
  );

  const getImageDisplayInfo = useCallback(() => {
    if (!imageRef.current) return null;

    const imageElement = imageRef.current;
    const container = imageElement.parentElement;
    if (!container) return null;

    const imageRect = imageElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calculate where the image is positioned within the container
    const leftOffset = imageRect.left - containerRect.left;
    const topOffset = imageRect.top - containerRect.top;

    return {
      leftOffset,
      topOffset,
      imageWidth: imageRect.width,
      imageHeight: imageRect.height,
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
    };
  }, []);

  const handleImageMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isSelectionMode || isProcessingOCR) return;

      e.preventDefault();
      const coords = getRelativeCoordinates(e.clientX, e.clientY);
      setStartPoint(coords);
      setIsSelecting(true);
      setSelection(null);
    },
    [isSelectionMode, getRelativeCoordinates, isProcessingOCR]
  );

  const handleImageMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isSelecting || !startPoint || !isSelectionMode || isProcessingOCR)
        return;

      e.preventDefault();
      const coords = getRelativeCoordinates(e.clientX, e.clientY);

      const newSelection = {
        x: Math.min(startPoint.x, coords.x),
        y: Math.min(startPoint.y, coords.y),
        width: Math.abs(coords.x - startPoint.x),
        height: Math.abs(coords.y - startPoint.y),
      };

      setSelection(newSelection);
    },
    [
      isSelecting,
      startPoint,
      isSelectionMode,
      getRelativeCoordinates,
      isProcessingOCR,
    ]
  );

  const handleImageMouseUp = useCallback(() => {
    if (!isSelectionMode || isProcessingOCR) return;
    setIsSelecting(false);
    setStartPoint(null);
  }, [isSelectionMode, isProcessingOCR]);

  const handleClearSelection = () => {
    setSelection(null);
    setIsSelecting(false);
    setStartPoint(null);
  };

  const handleConfirmSelection = async () => {
    if (!selection || !lessonId || !lesson?.lessonFiles || !isAuthenticated)
      return;

    const currentFile = lesson.lessonFiles[currentMangaPageIndex];
    if (!currentFile) return;

    try {
      setIsProcessingOCR(true);

      const response = await axiosInstance.post(
        `/api/lessons/${lessonId}/ocr-region`,
        {
          lessonFileId: currentFile.id,
          selection: selection,
        }
      );

      if (response.data.success) {
        // Reload sentences for the current page to show the new sentences
        await loadSentencesForMangaPage(currentMangaPageIndex);

        // Clear selection and exit selection mode
        setSelection(null);
        setIsSelectionMode(false);

        // Show success message (optional)
        console.log('OCR completed successfully:', response.data.message);
      } else {
        console.error('OCR failed:', response.data.message);
        // You could show an error toast here
      }
    } catch (error) {
      console.error('Error processing OCR:', error);
      // You could show an error toast here
    } finally {
      setIsProcessingOCR(false);
    }
  };

  // Check if user is on the last manga page (for finish button display)
  const isOnLastMangaPage = useMemo(() => {
    if (!lesson?.lessonFiles) return false;
    return currentMangaPageIndex === lesson.lessonFiles.length - 1;
  }, [lesson?.lessonFiles, currentMangaPageIndex]);

  // Keyboard controls for manga page navigation
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      // Only handle keys if no input is focused
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (event.target as HTMLElement)?.tagName
        )
      ) {
        return;
      }

      // Don't handle navigation if sentences are loading or in selection mode
      if (loadingSentences || isSelectionMode) return;

      switch (event.code) {
        case 'ArrowLeft':
          event.preventDefault();
          navigateToPreviousMangaPage();
          break;
        case 'ArrowRight':
          event.preventDefault();
          navigateToNextMangaPage();
          break;
        case 'Escape':
          if (isSelectionMode) {
            event.preventDefault();
            setIsSelectionMode(false);
            setSelection(null);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [currentMangaPageIndex, lesson, loadingSentences, isSelectionMode]);

  if (authLoading || loading) {
    return (
      <Flex
        direction="column"
        style={{ width: '100%', minHeight: '100vh', position: 'relative' }}
      >
        <Box style={{ padding: '16px 24px' }}>
          <Flex
            direction="column"
            align="center"
            justify="center"
            style={{ minHeight: '50vh' }}
          >
            <Text size="3">Loading lesson...</Text>
          </Flex>
        </Box>
      </Flex>
    );
  }

  if (!isAuthenticated) {
    return (
      <Flex
        direction="column"
        style={{ width: '100%', minHeight: '100vh', position: 'relative' }}
      >
        <Box style={{ padding: '16px 24px' }}>
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
        </Box>
      </Flex>
    );
  }

  if (error || !lesson) {
    return (
      <Flex
        direction="column"
        style={{ width: '100%', minHeight: '100vh', position: 'relative' }}
      >
        <Box style={{ padding: '16px 24px' }}>
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
        </Box>
      </Flex>
    );
  }

  const currentMangaPage = lesson.lessonFiles[currentMangaPageIndex];

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <Flex
        direction="column"
        style={{
          width: '100%',
          height: '100vh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box style={{ padding: '12px 24px', flexShrink: 0 }}>
          <Flex direction="column" gap="2">
            <Flex align="center" justify="between">
              <Button
                variant="ghost"
                size="2"
                onClick={() => navigate('/lessons')}
              >
                ← Back to Lessons
              </Button>
            </Flex>
            <Flex align="center" gap="2">
              <Heading size="5">{lesson.title} - Manga View</Heading>
              <Badge variant="soft" size="1">
                {lesson.languageCode.toUpperCase()}
              </Badge>
            </Flex>
          </Flex>
        </Box>

        {/* Main Content - 50-50 Layout */}
        <Box
          style={{
            flex: 1,
            marginRight: '350px', // Space for word sidebar
            padding: '0 24px 24px 24px',
            overflow: 'hidden',
            minHeight: 0, // Important for flex child to shrink
            height: 'calc(100vh - 120px)', // Fixed height to prevent overflow
          }}
        >
          <Flex style={{ height: '100%' }} gap="4">
            {/* Left Side - Manga Page */}
            <Box style={{ flex: 1, minHeight: 0 }}>
              <Card
                style={{
                  padding: '16px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Flex direction="column" gap="3" style={{ height: '100%' }}>
                  <Flex align="center" justify="between">
                    <Heading size="4">Manga Page</Heading>
                    <Flex align="center" gap="2">
                      <Button
                        variant={isSelectionMode ? 'solid' : 'soft'}
                        {...(isSelectionMode && { color: 'blue' })}
                        size="1"
                        onClick={toggleSelectionMode}
                        disabled={
                          loadingSentences ||
                          !currentMangaPage ||
                          isProcessingOCR
                        }
                      >
                        {isSelectionMode
                          ? '✅ Selection Mode'
                          : '📝 Select Text'}
                      </Button>
                      <Text size="2" color="gray">
                        Page {currentMangaPageIndex + 1} of{' '}
                        {lesson.lessonFiles.length}
                      </Text>
                    </Flex>
                  </Flex>

                  {/* Manga Image */}
                  <Box
                    style={{
                      position: 'relative',
                      height: 'calc(100% - 160px)', // Reserve space for selection controls and navigation buttons
                      minHeight: '200px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {currentMangaPage ? (
                      <Box
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: '100%',
                        }}
                      >
                        <img
                          ref={imageRef}
                          src={
                            currentMangaPage.imageUrl ||
                            `/api/files/${currentMangaPage.fileS3Key}`
                          }
                          alt={`Manga page ${currentMangaPageIndex + 1}`}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            objectPosition: 'center',
                            borderRadius: '8px',
                            border: `2px solid ${isSelectionMode ? 'var(--blue-8)' : 'var(--gray-6)'}`,
                            cursor: isSelectionMode ? 'crosshair' : 'default',
                            userSelect: 'none',
                            display: 'block',
                            margin: '0 auto',
                          }}
                          onMouseDown={handleImageMouseDown}
                          onMouseMove={handleImageMouseMove}
                          onMouseUp={handleImageMouseUp}
                          onMouseLeave={handleImageMouseUp}
                          draggable={false}
                        />

                        {selection &&
                          isSelectionMode &&
                          (() => {
                            const imageInfo = getImageDisplayInfo();
                            if (!imageInfo) return null;

                            return (
                              <Box
                                style={{
                                  position: 'absolute',
                                  left: `${imageInfo.leftOffset + selection.x * imageInfo.imageWidth}px`,
                                  top: `${imageInfo.topOffset + selection.y * imageInfo.imageHeight}px`,
                                  width: `${selection.width * imageInfo.imageWidth}px`,
                                  height: `${selection.height * imageInfo.imageHeight}px`,
                                  border: '2px solid var(--blue-9)',
                                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                  pointerEvents: 'none',
                                  borderRadius: '2px',
                                }}
                              />
                            );
                          })()}

                        {isProcessingOCR && (
                          <Box
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              backgroundColor: 'rgba(255, 255, 255, 0.9)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '8px',
                            }}
                          >
                            <Flex direction="column" align="center" gap="3">
                              <div
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  border: '3px solid var(--gray-6)',
                                  borderTop: '3px solid var(--blue-9)',
                                  borderRadius: '50%',
                                  animation: 'spin 1s linear infinite',
                                }}
                              />
                              <Text size="3" weight="medium">
                                Processing OCR...
                              </Text>
                            </Flex>
                          </Box>
                        )}
                      </Box>
                    ) : (
                      <Flex
                        align="center"
                        justify="center"
                        style={{
                          height: '100%',
                          backgroundColor: 'var(--gray-2)',
                          borderRadius: '8px',
                          border: '1px solid var(--gray-6)',
                        }}
                      >
                        <Text size="3" color="gray">
                          No manga page available
                        </Text>
                      </Flex>
                    )}
                  </Box>

                  {/* Selection Controls */}
                  {isSelectionMode && (
                    <Box
                      style={{
                        padding: '12px',
                        backgroundColor: 'var(--blue-2)',
                        borderRadius: '6px',
                        border: '1px solid var(--blue-6)',
                      }}
                    >
                      <Flex direction="column">
                        <Flex gap="2">
                          <Button
                            size="1"
                            onClick={handleConfirmSelection}
                            disabled={
                              isProcessingOCR &&
                              !(
                                selection &&
                                selection.width > 0.01 &&
                                selection.height > 0.01
                              )
                            }
                          >
                            {isProcessingOCR ? 'Processing...' : 'Extract Text'}
                          </Button>
                          <Button
                            size="1"
                            variant="soft"
                            color="gray"
                            onClick={handleClearSelection}
                            disabled={
                              isProcessingOCR &&
                              !(
                                selection &&
                                selection.width > 0.01 &&
                                selection.height > 0.01
                              )
                            }
                          >
                            Clear Selection
                          </Button>
                        </Flex>
                      </Flex>
                    </Box>
                  )}

                  {/* Manga Navigation */}
                  <Flex align="center" justify="between">
                    <Button
                      variant="soft"
                      onClick={navigateToPreviousMangaPage}
                      disabled={
                        currentMangaPageIndex === 0 ||
                        loadingSentences ||
                        isSelectionMode
                      }
                    >
                      ← Previous Page
                    </Button>
                    <Text size="2" color="gray">
                      {isSelectionMode
                        ? 'Navigation disabled in selection mode'
                        : 'Use ←→ arrow keys'}
                    </Text>
                    <Button
                      variant="soft"
                      onClick={navigateToNextMangaPage}
                      disabled={
                        currentMangaPageIndex >=
                          lesson.lessonFiles.length - 1 ||
                        loadingSentences ||
                        isSelectionMode
                      }
                    >
                      Next Page →
                    </Button>
                  </Flex>
                </Flex>
              </Card>
            </Box>

            {/* Right Side - Sentences */}
            <Box style={{ flex: 1, minHeight: 0 }}>
              <Card
                style={{
                  padding: '16px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Flex direction="column" gap="3" style={{ height: '100%' }}>
                  <Flex align="center" justify="between">
                    <Heading size="4">Sentences</Heading>
                    <Text size="2" color="gray">
                      Page {currentMangaPageIndex + 1} sentences
                    </Text>
                  </Flex>

                  {/* Sentences Content */}
                  <Flex
                    direction="column"
                    gap="3"
                    style={{ flex: 1, overflowY: 'auto' }}
                  >
                    {loadingSentences ? (
                      // Loading State
                      <Flex
                        align="center"
                        justify="center"
                        style={{
                          height: '100%',
                          minHeight: '200px',
                        }}
                      >
                        <Flex direction="column" align="center" gap="3">
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              border: '3px solid var(--gray-6)',
                              borderTop: '3px solid var(--accent-9)',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite',
                            }}
                          />
                          <Text size="3" color="gray">
                            Loading sentences...
                          </Text>
                        </Flex>
                      </Flex>
                    ) : (
                      // All Sentences with Word Highlighting
                      <>
                        {displaySentences.map(sentence => (
                          <Box key={sentence.id}>
                            <Box
                              style={{
                                padding: '12px 16px',
                                backgroundColor: 'var(--gray-2)',
                                borderRadius: '8px',
                                border: '1px solid var(--gray-6)',
                              }}
                            >
                              <Flex direction="column" gap="2">
                                {/* Sentence Text with Word Highlighting */}
                                <Box>
                                  <Box
                                    style={{
                                      lineHeight: '1.6',
                                      fontSize: 'var(--font-size-3)',
                                    }}
                                  >
                                    {sentence.split_text &&
                                    sentence.split_text.length > 0 ? (
                                      reconstructSentenceWithWords(sentence)
                                    ) : (
                                      <Text
                                        size="3"
                                        style={{ lineHeight: '1.6' }}
                                      >
                                        {sentence.original_text}
                                      </Text>
                                    )}
                                  </Box>
                                </Box>

                                {/* Translation Section */}
                                <Box>
                                  <Button
                                    variant="soft"
                                    size="1"
                                    onClick={() =>
                                      toggleTranslation(sentence.id)
                                    }
                                    disabled={loadingTranslations[sentence.id]}
                                    style={{
                                      cursor: loadingTranslations[sentence.id]
                                        ? 'not-allowed'
                                        : 'pointer',
                                    }}
                                  >
                                    {loadingTranslations[sentence.id]
                                      ? 'Loading...'
                                      : translations[sentence.id]
                                        ? 'Hide translation'
                                        : 'Show translation'}
                                  </Button>

                                  {translations[sentence.id] && (
                                    <Box
                                      mt="2"
                                      p="2"
                                      style={{
                                        backgroundColor: 'var(--gray-3)',
                                        borderRadius: '4px',
                                      }}
                                    >
                                      <Text size="1" color="gray" mb="1">
                                        Translation:
                                      </Text>
                                      <Text
                                        size="2"
                                        style={{
                                          fontStyle: 'italic',
                                          whiteSpace: 'pre-line',
                                        }}
                                      >
                                        {translations[sentence.id]}
                                      </Text>
                                    </Box>
                                  )}
                                </Box>
                              </Flex>
                            </Box>
                          </Box>
                        ))}

                        {/* Finish Lesson Button */}
                        {isOnLastMangaPage &&
                          lesson?.userProgress?.status !== 'finished' &&
                          !lessonCompleted && (
                            <Box mt="4">
                              <Flex direction="column" gap="3" align="center">
                                <Heading size="3">🎉 Congratulations!</Heading>
                                <Text
                                  size="2"
                                  color="gray"
                                  style={{ textAlign: 'center' }}
                                >
                                  You've reached the last page of this manga
                                  lesson.
                                </Text>
                                <Button
                                  size="2"
                                  variant="solid"
                                  color="green"
                                  onClick={handleFinishLesson}
                                  disabled={isFinishingLesson}
                                  style={{
                                    cursor: isFinishingLesson
                                      ? 'not-allowed'
                                      : 'pointer',
                                  }}
                                >
                                  {isFinishingLesson
                                    ? 'Finishing...'
                                    : 'Finish Lesson'}
                                </Button>
                              </Flex>
                            </Box>
                          )}

                        {/* Lesson Completed Message */}
                        {lessonCompleted && (
                          <Box mt="4">
                            <Flex direction="column" gap="3" align="center">
                              <Heading size="3">✅ Lesson Completed!</Heading>
                              <Text
                                size="2"
                                color="green"
                                style={{ textAlign: 'center' }}
                              >
                                Great job! You have successfully completed this
                                lesson. 🎉
                              </Text>
                              <Button
                                size="2"
                                variant="soft"
                                onClick={() => navigate('/lessons')}
                              >
                                Back to Lessons
                              </Button>
                            </Flex>
                          </Box>
                        )}
                      </>
                    )}
                  </Flex>
                </Flex>
              </Card>
            </Box>
          </Flex>
        </Box>

        {/* Word Translation Sidebar */}
        <WordSidebar
          isOpen={isSidebarOpen}
          onClose={handleCloseSidebar}
          selectedWord={selectedWord}
          wordTranslations={currentWordTranslations}
          wordPronunciations={currentWordPronunciations}
          languageCode={lesson?.languageCode}
        />
      </Flex>
    </>
  );
};

export default LessonMangaViewPage;
