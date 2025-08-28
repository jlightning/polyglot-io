import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
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

interface Lesson {
  id: number;
  title: string;
  languageCode: string;
  sentences: Sentence[];
  totalSentences: number;
  audioUrl?: string;
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

interface SentenceBuffer {
  sentences: Sentence[];
  loadedPages: Set<number>;
  loadingPages: Set<number>;
  totalPages: number;
  isLoading: boolean;
}

const SENTENCES_PER_PAGE = 10;
const BUFFER_AHEAD = 2; // Load 2 pages ahead

const LessonVideoViewPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { axiosInstance, isAuthenticated, isLoading: authLoading } = useAuth();
  const { getWordMark, addWords } = useWordMark();

  // Use a ref to store the current addWords function to avoid callback recreations
  const addWordsRef = useRef(addWords);
  addWordsRef.current = addWords;

  // Video and lesson state
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Lesson progress state
  const [isFinishingLesson, setIsFinishingLesson] = useState(false);
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [hasRestoredVideoProgress, setHasRestoredVideoProgress] =
    useState(false);

  // Lesson and sentence state
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [sentenceBuffer, setSentenceBuffer] = useState<SentenceBuffer>({
    sentences: [],
    loadedPages: new Set(),
    loadingPages: new Set(),
    totalPages: 0,
    isLoading: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active sentence tracking
  const [activeSentence, setActiveSentence] = useState<Sentence | null>(null);
  const [previousSentence, setPreviousSentence] = useState<Sentence | null>(
    null
  );
  const [nextSentences, setNextSentences] = useState<Sentence[]>([]);

  // Word sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [currentWordTranslations, setCurrentWordTranslations] = useState<
    WordTranslation[] | null
  >(null);
  const [currentWordPronunciations, setCurrentWordPronunciations] = useState<
    WordPronunciation[] | null
  >(null);

  // Video overlay state
  const [showSentenceOverlay, setShowSentenceOverlay] = useState(true);

  // Load basic lesson info and first page of sentences
  useEffect(() => {
    const fetchLessonInfo = async () => {
      if (!lessonId || !isAuthenticated) return;

      try {
        setLoading(true);
        setError(null);

        // Get first page of sentences which includes lesson metadata
        const response = await axiosInstance.get(
          `/api/lessons/${lessonId}/sentences`,
          {
            params: {
              page: 1,
              limit: SENTENCES_PER_PAGE,
            },
          }
        );

        // Also fetch the current progress to get video timestamp
        const progressResponse = await axiosInstance.get(
          `/api/lessons/${lessonId}/progress`,
          {
            params: {
              sentencesPerPage: SENTENCES_PER_PAGE,
            },
          }
        );

        if (response.data.success) {
          const lessonData = response.data.lesson;
          setLesson({
            id: lessonData.id,
            title: lessonData.title,
            languageCode: lessonData.languageCode,
            sentences: [],
            totalSentences: lessonData.totalSentences || 0,
            audioUrl: lessonData.audioUrl,
            userProgress: progressResponse.data.success
              ? progressResponse.data.progress
              : null,
          });

          const totalPages = Math.ceil(
            (lessonData.totalSentences || 0) / SENTENCES_PER_PAGE
          );
          setSentenceBuffer(prev => ({ ...prev, totalPages }));

          // Add the first page sentences to buffer
          setSentenceBuffer(prev => ({
            ...prev,
            sentences: lessonData.sentences,
            loadedPages: new Set([1]),
          }));

          // Collect all unique words and add them to word context asynchronously
          if (lessonData.languageCode) {
            setTimeout(async () => {
              const allWords = new Set<string>();
              lessonData.sentences.forEach((sentence: Sentence) => {
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
                    lessonData.languageCode
                  );
                } catch (err) {
                  console.error('Error adding words to context:', err);
                }
              }
            }, 0);
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

    fetchLessonInfo();
  }, [lessonId, isAuthenticated, axiosInstance]);

  // Load sentences for a specific page
  const loadSentencePage = useCallback(
    async (page: number) => {
      if (
        !lessonId ||
        !isAuthenticated ||
        sentenceBuffer.loadedPages.has(page) ||
        sentenceBuffer.loadingPages.has(page)
      ) {
        return;
      }

      try {
        setSentenceBuffer(prev => ({
          ...prev,
          isLoading: true,
          loadingPages: new Set([...prev.loadingPages, page]),
        }));

        const response = await axiosInstance.get(
          `/api/lessons/${lessonId}/sentences`,
          {
            params: {
              page,
              limit: SENTENCES_PER_PAGE,
            },
          }
        );

        if (response.data.success) {
          const newSentences = response.data.lesson.sentences;

          setSentenceBuffer(prev => {
            // Create a map of existing sentences by ID to avoid duplicates
            const existingSentenceIds = new Set(prev.sentences.map(s => s.id));
            const uniqueNewSentences = newSentences.filter(
              (s: Sentence) => !existingSentenceIds.has(s.id)
            );

            const newLoadingPages = new Set(prev.loadingPages);
            newLoadingPages.delete(page);

            return {
              ...prev,
              sentences: [...prev.sentences, ...uniqueNewSentences],
              loadedPages: new Set([...prev.loadedPages, page]),
              loadingPages: newLoadingPages,
              isLoading: newLoadingPages.size > 0,
            };
          });

          // Collect all unique words and add them to word context asynchronously
          // Use setTimeout to defer the addWords call and prevent blocking the UI
          if (lesson?.languageCode) {
            setTimeout(async () => {
              const allWords = new Set<string>();
              newSentences.forEach((sentence: Sentence) => {
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
        console.error('Error loading sentence page:', err);
      } finally {
        setSentenceBuffer(prev => {
          const newLoadingPages = new Set(prev.loadingPages);
          newLoadingPages.delete(page);
          return {
            ...prev,
            loadingPages: newLoadingPages,
            isLoading: newLoadingPages.size > 0,
          };
        });
      }
    },
    [
      lessonId,
      isAuthenticated,
      axiosInstance,
      sentenceBuffer.loadedPages,
      sentenceBuffer.loadingPages,
      lesson?.languageCode,
    ]
  );

  // Buffer management - load pages ahead based on current video time
  useEffect(() => {
    if (!lesson || sentenceBuffer.sentences.length === 0) return;

    const currentSentence = findCurrentSentence(currentTime);
    if (!currentSentence) return;

    // Find which page this sentence belongs to
    const sentenceIndex = sentenceBuffer.sentences.findIndex(
      s => s.id === currentSentence.id
    );
    const currentPage = Math.floor(sentenceIndex / SENTENCES_PER_PAGE) + 1;

    // Load ahead pages
    for (let i = 1; i <= BUFFER_AHEAD; i++) {
      const pageToLoad = currentPage + i;
      if (
        pageToLoad <= sentenceBuffer.totalPages &&
        !sentenceBuffer.loadedPages.has(pageToLoad)
      ) {
        loadSentencePage(pageToLoad);
      }
    }

    // If we're near the end of loaded sentences, make sure we load all remaining pages
    // to properly detect the last sentence
    const loadedSentenceCount = sentenceBuffer.sentences.length;
    const totalSentences = lesson.totalSentences;
    const remainingToLoad = totalSentences - loadedSentenceCount;

    if (remainingToLoad > 0 && remainingToLoad <= SENTENCES_PER_PAGE * 2) {
      // Load all remaining pages when we're close to the end
      for (let page = 1; page <= sentenceBuffer.totalPages; page++) {
        if (!sentenceBuffer.loadedPages.has(page)) {
          loadSentencePage(page);
        }
      }
    }
  }, [
    currentTime,
    lesson,
    sentenceBuffer.sentences,
    sentenceBuffer.totalPages,
    sentenceBuffer.loadedPages,
    loadSentencePage,
  ]);

  // Find current sentence based on video time
  const findCurrentSentence = useCallback(
    (time: number): Sentence | null => {
      // First, try to find an exact match (time is within sentence bounds)
      const exactMatch = sentenceBuffer.sentences.find(
        sentence =>
          sentence.start_time !== null &&
          sentence.end_time !== null &&
          time >= sentence.start_time &&
          time <= sentence.end_time
      );

      if (exactMatch) return exactMatch;

      // If no exact match, find the closest previous sentence
      let closestPrevious: Sentence | null = null;
      let closestDistance = Infinity;

      for (const sentence of sentenceBuffer.sentences) {
        if (sentence.end_time !== null && sentence.end_time <= time) {
          const distance = time - sentence.end_time;
          if (distance < closestDistance) {
            closestDistance = distance;
            closestPrevious = sentence;
          }
        }
      }

      return closestPrevious;
    },
    [sentenceBuffer.sentences]
  );

  // Find previous sentence to display
  const findPreviousSentence = useCallback(
    (currentSentence: Sentence | null): Sentence | null => {
      if (!currentSentence) return null;

      const currentIndex = sentenceBuffer.sentences.findIndex(
        s => s.id === currentSentence.id
      );
      if (currentIndex === -1 || currentIndex === 0) return null;

      return sentenceBuffer.sentences[currentIndex - 1] || null;
    },
    [sentenceBuffer.sentences]
  );

  // Find next few sentences to display
  const findNextSentences = useCallback(
    (currentSentence: Sentence | null, count: number = 1): Sentence[] => {
      if (!currentSentence) return [];

      const currentIndex = sentenceBuffer.sentences.findIndex(
        s => s.id === currentSentence.id
      );
      if (currentIndex === -1) return [];

      return sentenceBuffer.sentences.slice(
        currentIndex + 1,
        currentIndex + 1 + count
      );
    },
    [sentenceBuffer.sentences]
  );

  // Update active sentence, previous and next sentences based on current time
  useEffect(() => {
    const current = findCurrentSentence(currentTime);
    setActiveSentence(current);
    setPreviousSentence(findPreviousSentence(current));
    setNextSentences(findNextSentences(current));
  }, [
    currentTime,
    findCurrentSentence,
    findPreviousSentence,
    findNextSentences,
  ]);

  // Save lesson progress based on current active sentence
  useEffect(() => {
    if (!lessonId || !isAuthenticated || !activeSentence || !lesson) return;

    // Debounce saving to avoid too frequent writes
    const timeoutId = setTimeout(async () => {
      try {
        await axiosInstance.post(`/api/lessons/${lessonId}/progress/sentence`, {
          sentenceId: activeSentence.id,
        });
      } catch (error) {
        console.error('Error saving lesson progress to backend:', error);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [activeSentence, lessonId, isAuthenticated, axiosInstance, lesson]);

  // Restore video progress based on user's lesson progress
  useEffect(() => {
    if (
      !videoRef.current ||
      !videoUrl ||
      hasRestoredVideoProgress ||
      !lesson?.userProgress?.sentenceInfo?.startTime
    ) {
      return;
    }

    const startTime = lesson.userProgress.sentenceInfo.startTime;

    // Seek video to the start of that sentence
    if (startTime > 0 && startTime < videoRef.current.duration) {
      videoRef.current.currentTime = startTime;
      setCurrentTime(startTime);
      setHasRestoredVideoProgress(true);
    }
  }, [videoUrl, lesson?.userProgress, hasRestoredVideoProgress]);

  // Handle video file selection
  const handleVideoSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setHasRestoredVideoProgress(false);
    }
  };

  // Video control handlers
  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Keyboard controls for video playback
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      // Only handle spacebar if video is loaded and no input is focused
      if (
        event.code === 'Space' &&
        videoRef.current &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (event.target as HTMLElement)?.tagName
        )
      ) {
        event.preventDefault();
        handlePlayPause();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [handlePlayPause]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Sentence reconstruction with clickable words
  const reconstructSentenceWithWords = (sentence: Sentence) => {
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
            fontSize: '16px',
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
    // Pause the video when a word is clicked
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }

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

  const handleFinishLesson = async () => {
    if (!lessonId || !isAuthenticated || isFinishingLesson || !activeSentence)
      return;

    try {
      setIsFinishingLesson(true);

      await axiosInstance.post(`/api/lessons/${lessonId}/progress/sentence`, {
        sentenceId: activeSentence.id,
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
      // Could add error handling/notification here
    } finally {
      setIsFinishingLesson(false);
    }
  };

  // Check if current sentence is the last sentence in the lesson
  const isLastSentence = useMemo(() => {
    if (!activeSentence || !lesson) return false;

    // Check if we have loaded all sentences
    const totalLoadedSentences = sentenceBuffer.sentences.length;
    const hasLoadedAllPages =
      sentenceBuffer.loadedPages.size === sentenceBuffer.totalPages;

    if (!hasLoadedAllPages) return false;

    // Find the index of the current sentence in the buffer
    const currentIndex = sentenceBuffer.sentences.findIndex(
      s => s.id === activeSentence.id
    );

    // Check if this is the last sentence in the buffer (and we've loaded all sentences)
    return currentIndex === totalLoadedSentences - 1;
  }, [activeSentence, lesson, sentenceBuffer]);

  // Format time for display
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Memoize the video element to prevent unnecessary re-renders
  const videoElement = useMemo(() => {
    if (!videoUrl) return null;

    return (
      <Box style={{ position: 'relative', width: '100%' }}>
        <video
          ref={videoRef}
          src={videoUrl}
          style={{
            width: '100%',
            height: '600px',
            borderRadius: '8px',
            objectFit: 'contain',
          }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Sentence Overlay */}
        {showSentenceOverlay && activeSentence && (
          <Box
            style={{
              position: 'absolute',
              bottom: '10px', // Simple bottom positioning
              left: '20px',
              right: '20px',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '16px',
              borderRadius: '8px',
              backdropFilter: 'blur(4px)',
              zIndex: 10,
              pointerEvents: 'auto', // Enable clicking for word interactions
              textAlign: 'center', // Center align content
            }}
          >
            <Flex direction="column" gap="2" align="center">
              <Box
                style={{
                  lineHeight: '1.6',
                  fontSize: '18px',
                  fontWeight: '500',
                  textAlign: 'center',
                }}
              >
                {activeSentence.split_text &&
                activeSentence.split_text.length > 0 ? (
                  reconstructSentenceWithWords(activeSentence)
                ) : (
                  <Text size="4" style={{ color: 'white' }}>
                    {activeSentence.original_text}
                  </Text>
                )}
              </Box>
            </Flex>
          </Box>
        )}
      </Box>
    );
  }, [videoUrl, showSentenceOverlay, activeSentence, getWordMark]);

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
        <Flex align="center" gap="3">
          <Button
            variant="ghost"
            onClick={() => navigate(`/lessons/${lessonId}`)}
          >
            ← Back to Lesson
          </Button>
          <Button variant="ghost" onClick={() => navigate('/lessons')}>
            ← Back to Lessons
          </Button>
        </Flex>
        <Flex align="center" gap="3" justify="between">
          <Flex align="center" gap="3">
            <Heading size="6">{lesson.title} - Video View</Heading>
            <Badge variant="soft">{lesson.languageCode.toUpperCase()}</Badge>
          </Flex>
        </Flex>
        <Text size="3" color="gray">
          {lesson.totalSentences} sentences total •{' '}
          {sentenceBuffer.sentences.length} loaded
        </Text>
      </Flex>

      <Separator size="4" mb="4" />

      {/* Full Width Video Player */}
      <Card style={{ padding: '16px', marginBottom: '24px' }}>
        <Flex direction="column" gap="4">
          <Heading size="4">Video Player</Heading>

          {!videoUrl ? (
            <Flex
              direction="column"
              gap="4"
              align="center"
              style={{ minHeight: '400px' }}
            >
              <Box
                style={{
                  border: '2px dashed var(--gray-7)',
                  borderRadius: '8px',
                  padding: '40px',
                  textAlign: 'center',
                  minHeight: '300px',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text size="3" color="gray" mb="3">
                  Select a video file to sync with lesson sentences
                </Text>
                <Button onClick={handleVideoSelect}>Choose Video File</Button>
              </Box>
            </Flex>
          ) : (
            <Flex direction="column" gap="3">
              {videoElement}

              {/* Custom Video Controls */}
              <Flex align="center" gap="3" wrap="wrap">
                <Button onClick={handlePlayPause}>
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
                <Text size="2">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </Text>

                {/* Sentence Overlay Toggle */}
                <Button
                  variant={showSentenceOverlay ? 'solid' : 'soft'}
                  size="2"
                  onClick={() => setShowSentenceOverlay(!showSentenceOverlay)}
                  style={{
                    backgroundColor: showSentenceOverlay
                      ? 'var(--accent-9)'
                      : undefined,
                  }}
                >
                  {showSentenceOverlay
                    ? '📖 Hide Subtitles'
                    : '📖 Show Subtitles'}
                </Button>

                {/* Backend Progress Controls */}
                {lesson?.userProgress?.sentenceInfo?.startTime &&
                  !hasRestoredVideoProgress && (
                    <Button
                      variant="soft"
                      color="green"
                      size="2"
                      onClick={() => {
                        if (
                          videoRef.current &&
                          lesson.userProgress?.sentenceInfo?.startTime
                        ) {
                          videoRef.current.currentTime =
                            lesson.userProgress.sentenceInfo.startTime;
                          setCurrentTime(
                            lesson.userProgress.sentenceInfo.startTime
                          );
                          setHasRestoredVideoProgress(true);
                        }
                      }}
                    >
                      Continue from{' '}
                      {formatTime(lesson.userProgress.sentenceInfo.startTime)}
                    </Button>
                  )}

                <Button
                  variant="soft"
                  size="2"
                  onClick={() => {
                    setVideoUrl(null);
                    setHasRestoredVideoProgress(false);
                  }}
                >
                  Change Video
                </Button>
              </Flex>

              {/* Seek Bar */}
              <Box style={{ width: '100%' }}>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={e => handleSeek(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    height: '8px',
                    background: 'var(--gray-6)',
                    borderRadius: '4px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
              </Box>

              {/* Progress Info */}
              {lesson?.userProgress?.sentenceInfo?.startTime && (
                <Text size="1" color="gray">
                  {hasRestoredVideoProgress
                    ? '✓ Resumed from last lesson position'
                    : `📖 Lesson progress available at ${formatTime(lesson.userProgress.sentenceInfo.startTime)}`}
                </Text>
              )}
            </Flex>
          )}
        </Flex>
      </Card>

      {/* Sentence Display - Vertical Layout */}
      <Card style={{ padding: '16px', marginBottom: '24px' }}>
        <Flex direction="column" gap="4">
          <Heading size="4">Sentences</Heading>

          <Flex direction="column" gap="3">
            {/* Previous Sentence */}
            <Box>
              {previousSentence ? (
                <Box
                  style={{
                    padding: '12px',
                    backgroundColor: 'var(--gray-3)',
                    borderRadius: '8px',
                    opacity: 0.7,
                    cursor: previousSentence.start_time ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (previousSentence.start_time && videoRef.current) {
                      handleSeek(previousSentence.start_time);
                    }
                  }}
                >
                  <Text
                    size="2"
                    color="gray"
                    style={{ display: 'block', marginBottom: '4px' }}
                  >
                    {previousSentence.start_time !== null &&
                    previousSentence.end_time !== null
                      ? `${previousSentence.start_time.toFixed(1)}s - ${previousSentence.end_time.toFixed(1)}s`
                      : 'No timing data'}
                  </Text>
                  <Text size="3">{previousSentence.original_text}</Text>
                </Box>
              ) : (
                <Box
                  style={{
                    padding: '12px',
                    backgroundColor: 'var(--gray-2)',
                    borderRadius: '8px',
                    textAlign: 'center',
                  }}
                >
                  <Text size="3" color="gray">
                    No previous sentence
                  </Text>
                </Box>
              )}
            </Box>

            {/* Current Sentence */}
            <Box>
              {activeSentence ? (
                <Box
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--gray-3)',
                    borderRadius: '8px',
                  }}
                >
                  <Text
                    size="2"
                    color="gray"
                    style={{ display: 'block', marginBottom: '8px' }}
                  >
                    {activeSentence.start_time !== null &&
                    activeSentence.end_time !== null
                      ? `${activeSentence.start_time.toFixed(1)}s - ${activeSentence.end_time.toFixed(1)}s`
                      : 'No timing data'}
                  </Text>
                  <Box
                    style={{
                      lineHeight: '1.6',
                      fontSize: 'var(--font-size-4)',
                    }}
                  >
                    {activeSentence.split_text &&
                    activeSentence.split_text.length > 0 ? (
                      reconstructSentenceWithWords(activeSentence)
                    ) : (
                      <Text size="4" style={{ lineHeight: '1.6' }}>
                        {activeSentence.original_text}
                      </Text>
                    )}
                  </Box>
                </Box>
              ) : (
                <Box
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--gray-2)',
                    borderRadius: '8px',
                    textAlign: 'center',
                  }}
                >
                  <Text size="3" color="gray">
                    {videoUrl
                      ? 'No sentence active at current time'
                      : 'Select a video to see sentences'}
                  </Text>
                </Box>
              )}
            </Box>

            {/* Next Sentence */}
            <Box>
              {nextSentences.length > 0 && nextSentences[0] ? (
                <Box
                  style={{
                    padding: '12px',
                    backgroundColor: 'var(--gray-3)',
                    borderRadius: '8px',
                    opacity: 0.7,
                    cursor: nextSentences[0].start_time ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (nextSentences[0]?.start_time && videoRef.current) {
                      handleSeek(nextSentences[0].start_time);
                    }
                  }}
                >
                  <Text
                    size="2"
                    color="gray"
                    style={{ display: 'block', marginBottom: '4px' }}
                  >
                    {nextSentences[0]?.start_time !== null &&
                    nextSentences[0]?.end_time !== null
                      ? `${nextSentences[0].start_time.toFixed(1)}s - ${nextSentences[0].end_time.toFixed(1)}s`
                      : 'No timing data'}
                  </Text>
                  <Text size="3">{nextSentences[0]?.original_text}</Text>
                </Box>
              ) : (
                <Box
                  style={{
                    padding: '12px',
                    backgroundColor: 'var(--gray-2)',
                    borderRadius: '8px',
                    textAlign: 'center',
                  }}
                >
                  <Text size="3" color="gray">
                    No next sentence
                  </Text>
                </Box>
              )}
            </Box>
          </Flex>
        </Flex>
      </Card>

      {/* Finish Lesson Button - Show when user reaches the last sentence and lesson is not finished */}
      {isLastSentence &&
        lesson?.userProgress?.status !== 'finished' &&
        !lessonCompleted && (
          <Card style={{ padding: '16px', marginBottom: '24px' }}>
            <Flex direction="column" gap="3" align="center">
              <Heading size="4">🎉 Congratulations!</Heading>
              <Text size="3" color="gray" style={{ textAlign: 'center' }}>
                You've reached the last sentence of this lesson.
              </Text>
              <Button
                size="3"
                variant="solid"
                color="green"
                onClick={handleFinishLesson}
                disabled={isFinishingLesson}
                style={{
                  cursor: isFinishingLesson ? 'not-allowed' : 'pointer',
                }}
              >
                {isFinishingLesson ? 'Finishing Lesson...' : 'Finish Lesson'}
              </Button>
            </Flex>
          </Card>
        )}

      {/* Lesson Completed Message */}
      {lessonCompleted && (
        <Card style={{ padding: '16px', marginBottom: '24px' }}>
          <Flex direction="column" gap="3" align="center">
            <Heading size="4">✅ Lesson Completed!</Heading>
            <Text size="3" color="green" style={{ textAlign: 'center' }}>
              Great job! You have successfully completed this lesson. 🎉
            </Text>
            <Button variant="soft" onClick={() => navigate('/lessons')}>
              Back to Lessons
            </Button>
          </Flex>
        </Card>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mkv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Word Translation Sidebar */}
      <WordSidebar
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        selectedWord={selectedWord}
        wordTranslations={currentWordTranslations}
        wordPronunciations={currentWordPronunciations}
        languageCode={lesson?.languageCode}
      />
    </Container>
  );
};

export default LessonVideoViewPage;
