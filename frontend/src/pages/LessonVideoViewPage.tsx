import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Flex, Heading, Text, Box, Card, Badge } from '@radix-ui/themes';
import MyButton from '../components/MyButton';

import { useAuth } from '../contexts/AuthContext';
import { useWordMark } from '../contexts/WordMarkContext';
import WordSidebar from '../components/WordSidebar';
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
  const [isDragging, setIsDragging] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

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
  const [previousSentences, setPreviousSentences] = useState<Sentence[]>([]);
  const [nextSentences, setNextSentences] = useState<Sentence[]>([]);

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
              sentences: [...prev.sentences, ...uniqueNewSentences].sort(
                (a, b) => a.id - b.id
              ),
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

  // Find previous sentences to display
  const findPreviousSentences = useCallback(
    (currentSentence: Sentence | null, count: number = 3): Sentence[] => {
      if (!currentSentence || !currentSentence.start_time) return [];

      // Filter for sentences that have start_time < current sentence start_time
      const filteredSentences = sentenceBuffer.sentences.filter(
        sentence =>
          sentence.start_time !== null &&
          sentence.start_time < currentSentence.start_time! &&
          sentence.id !== currentSentence.id // Exclude the current sentence itself
      );

      // Sort by start_time descending to get the most recent previous sentences
      filteredSentences.sort((a, b) => b.start_time! - a.start_time!);

      // Take the first <count> sentences and reverse to maintain chronological order
      return filteredSentences.slice(0, count).reverse();
    },
    [sentenceBuffer.sentences]
  );

  // Find next few sentences to display
  const findNextSentences = useCallback(
    (currentSentence: Sentence | null, count: number = 3): Sentence[] => {
      if (!currentSentence || !currentSentence.start_time) return [];

      // Filter for sentences that have start_time >= current sentence start_time
      const filteredSentences = sentenceBuffer.sentences.filter(
        sentence =>
          sentence.start_time !== null &&
          sentence.start_time >= currentSentence.start_time! &&
          sentence.id !== currentSentence.id // Exclude the current sentence itself
      );

      // Take the first <count> sentences
      return filteredSentences.slice(0, count);
    },
    [sentenceBuffer.sentences]
  );

  // Update active sentence, previous and next sentences based on current time
  useEffect(() => {
    const current = findCurrentSentence(currentTime);
    setActiveSentence(current);
    setPreviousSentences(findPreviousSentences(current));
    setNextSentences(findNextSentences(current));
  }, [
    currentTime,
    findCurrentSentence,
    findPreviousSentences,
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

  // Cleanup object URLs when component unmounts or video URL changes
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

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

  // Helper function to check if file is a video (handles macOS MIME type issues)
  const isVideoFile = (file: File): boolean => {
    // Check MIME type first
    if (file.type && file.type.startsWith('video/')) {
      return true;
    }

    // Fallback: check file extension (macOS sometimes doesn't set MIME type correctly)
    const fileName = file.name.toLowerCase();
    const videoExtensions = [
      '.mp4',
      '.mkv',
      '.webm',
      '.mov',
      '.avi',
      '.m4v',
      '.flv',
      '.ogv',
    ];
    return videoExtensions.some(ext => fileName.endsWith(ext));
  };

  // Helper function to verify file is accessible by attempting to read it
  const verifyFileAccess = async (file: File): Promise<boolean> => {
    try {
      // Try to read a small slice of the file to verify access
      const slice = file.slice(0, 1);
      const reader = new FileReader();

      return new Promise(resolve => {
        reader.onload = () => resolve(true);
        reader.onerror = () => resolve(false);
        reader.readAsArrayBuffer(slice);

        // Timeout after 2 seconds
        setTimeout(() => resolve(false), 2000);
      });
    } catch (error) {
      console.error('Error verifying file access:', error);
      return false;
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      setVideoError('No file selected');
      return;
    }

    // Validate file is accessible and has valid properties
    if (!file.size || file.size === 0) {
      setVideoError('Selected file is empty or cannot be accessed');
      return;
    }

    // Check if it's a video file (with macOS-friendly detection)
    if (!isVideoFile(file)) {
      setVideoError(
        'Please select a valid video file (MP4, MKV, WebM, MOV, AVI, etc.)'
      );
      return;
    }

    try {
      // Verify file is accessible before proceeding
      const isAccessible = await verifyFileAccess(file);
      if (!isAccessible) {
        setVideoError(
          'Cannot access file. This may be a permissions issue on macOS. Try moving the file to Downloads or Desktop, or grant Chrome file access in System Preferences.'
        );
        setVideoLoading(false);
        return;
      }

      // Clean up previous URL if exists
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }

      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setHasRestoredVideoProgress(false);
      setVideoError(null);
      setVideoLoading(true);

      // Verify file is actually accessible by checking if we can create a URL
      if (!url) {
        setVideoError(
          'Cannot access file. Please check file permissions or try a different file.'
        );
        setVideoLoading(false);
      }
    } catch (error) {
      console.error('Error creating video URL:', error);
      setVideoError(
        'Cannot access file. This may be a permissions issue on macOS. Try moving the file to a different location or granting browser file access permissions.'
      );
      setVideoLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    // Only set dragging to false if we're leaving the drop zone entirely
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const files = event.dataTransfer.files;
    const file = files[0];

    if (!file) {
      setVideoError('No file dropped');
      return;
    }

    // Validate file is accessible and has valid properties
    if (!file.size || file.size === 0) {
      setVideoError('Dropped file is empty or cannot be accessed');
      return;
    }

    // Check if it's a video file (with macOS-friendly detection)
    if (!isVideoFile(file)) {
      setVideoError(
        'Please drop a valid video file (MP4, MKV, WebM, MOV, AVI, etc.)'
      );
      return;
    }

    try {
      // Verify file is accessible before proceeding
      const isAccessible = await verifyFileAccess(file);
      if (!isAccessible) {
        setVideoError(
          'Cannot access dropped file. This may be a permissions issue on macOS. Try moving the file to Downloads or Desktop, or grant Chrome file access in System Preferences.'
        );
        setVideoLoading(false);
        return;
      }

      // Clean up previous URL if exists
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }

      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setHasRestoredVideoProgress(false);
      setVideoError(null);
      setVideoLoading(true);

      // Verify file is actually accessible by checking if we can create a URL
      if (!url) {
        setVideoError(
          'Cannot access file. Please check file permissions or try a different file.'
        );
        setVideoLoading(false);
      }
    } catch (error) {
      console.error('Error creating video URL from dropped file:', error);
      setVideoError(
        'Cannot access dropped file. This may be a permissions issue on macOS. Try moving the file to a different location or granting browser file access permissions.'
      );
      setVideoLoading(false);
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
      setVideoLoading(false);
      setVideoError(null);
    }
  };

  const handleVideoError = () => {
    if (videoRef.current) {
      const error = videoRef.current.error;
      let errorMessage = 'Failed to load video. ';

      if (error) {
        switch (error.code) {
          case error.MEDIA_ERR_ABORTED:
            errorMessage +=
              'Video loading was aborted. This may indicate a file access issue on macOS.';
            break;
          case error.MEDIA_ERR_NETWORK:
            errorMessage += 'Network error occurred while loading video.';
            break;
          case error.MEDIA_ERR_DECODE:
            errorMessage +=
              'Video codec is not supported. MKV files with HEVC/H.265 codec may not work in Chrome. Try converting to MP4 with H.264 codec.';
            break;
          case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage +=
              'Video format is not supported or file cannot be accessed. On macOS, this may be a permissions issue. Try: 1) Moving the file to Downloads or Desktop, 2) Granting Chrome file access in System Preferences > Security & Privacy > Files and Folders, or 3) Converting MKV to MP4 format.';
            break;
          default:
            errorMessage +=
              'Unknown error occurred. The video format or codec may not be supported, or there may be a file access issue on macOS.';
        }
      } else {
        errorMessage +=
          'The video format or codec may not be supported, or the file cannot be accessed. On macOS, check file permissions or try converting MKV files with HEVC/H.265 codec to MP4 with H.264 codec.';
      }

      setVideoError(errorMessage);
      setVideoLoading(false);
    }
  };

  const handleLoadStart = () => {
    setVideoLoading(true);
    setVideoError(null);
  };

  const handleCanPlay = () => {
    setVideoLoading(false);
    setVideoError(null);
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleWordClick = (word: string) => {
    // Pause the video when a word is clicked
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }

    setSelectedWord(word);
    setIsSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
    setSelectedWord(null);
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
    if (!activeSentence || !lesson || !activeSentence.start_time) return false;

    // Check if we have loaded all sentences
    const hasLoadedAllPages =
      sentenceBuffer.loadedPages.size === sentenceBuffer.totalPages;

    if (!hasLoadedAllPages) return false;

    // Filter for sentences that have start_time >= current sentence start_time
    // and exclude the current sentence itself
    const sentencesAfterCurrent = sentenceBuffer.sentences.filter(
      sentence =>
        sentence.start_time !== null &&
        sentence.start_time >= activeSentence.start_time! &&
        sentence.id !== activeSentence.id
    );

    // If there are no sentences after the current one (with start_time >= current start_time),
    // then this is the last sentence
    return sentencesAfterCurrent.length === 0;
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
          preload="metadata"
          playsInline
          style={{
            width: '100%',
            height: '100%',
            maxHeight: '1000px',
            borderRadius: '8px',
            objectFit: 'contain',
          }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onLoadStart={handleLoadStart}
          onCanPlay={handleCanPlay}
          onError={handleVideoError}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Sentence Overlay */}
        {showSentenceOverlay && activeSentence && (
          <Box
            style={{
              position: 'absolute',
              bottom: '10px', // Simple bottom positioning
              left: '30px',
              right: '30px',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              color: 'white',
              padding: '4px',
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
                  fontSize: '20px',
                  fontWeight: '500',
                  textAlign: 'center',
                }}
              >
                {activeSentence.split_text &&
                activeSentence.split_text.length > 0 ? (
                  <SentenceReconstructor
                    sentence={activeSentence}
                    fontSize="20px"
                    onWordClick={handleWordClick}
                    fallbackToOriginalText={true}
                  />
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
        </Box>
      </Flex>
    );
  }

  return (
    <Flex
      direction="column"
      style={{ width: '100%', minHeight: '100vh', position: 'relative' }}
    >
      {/* Compact Header */}
      <Box style={{ padding: '12px 24px' }}>
        <Flex direction="column" gap="2">
          <Flex align="center" justify="between">
            <MyButton
              variant="ghost"
              size="2"
              onClick={() => navigate('/lessons')}
            >
              ← Back to Lessons
            </MyButton>
          </Flex>
          <Flex align="center" gap="2">
            <Heading size="5">{lesson.title} - Video View</Heading>
            <Badge variant="soft" size="1">
              {lesson.languageCode.toUpperCase()}
            </Badge>
          </Flex>
        </Flex>
      </Box>

      {/* Video Player - full width minus sidebar space */}
      <Box
        style={{
          marginRight: '350px',
          marginBottom: '24px',
          padding: '0 24px',
        }}
      >
        <Card style={{ padding: '16px' }}>
          <Flex direction="column" gap="4">
            <Flex align="center" justify="between" style={{ padding: '0 8px' }}>
              <Heading size="4">Video Player</Heading>
              <Text size="2" color="gray">
                {lesson.totalSentences} sentences total •{' '}
                {sentenceBuffer.sentences.length} loaded
              </Text>
            </Flex>

            {!videoUrl ? (
              <Flex
                direction="column"
                gap="4"
                align="center"
                style={{ minHeight: '400px', padding: '0 16px' }}
              >
                <Box
                  style={{
                    border: isDragging
                      ? '2px solid var(--accent-9)'
                      : '2px dashed var(--gray-7)',
                    borderRadius: '8px',
                    padding: '40px',
                    textAlign: 'center',
                    minHeight: '300px',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDragging
                      ? 'var(--accent-3)'
                      : 'transparent',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={handleVideoSelect}
                >
                  <Text size="4" mb="2">
                    {isDragging ? '📁' : '🎬'}
                  </Text>
                  <Text size="3" color="gray" mb="3">
                    {isDragging
                      ? 'Drop your video file here'
                      : 'Drag and drop a video file here, or click to select'}
                  </Text>
                  {!isDragging && (
                    <MyButton onClick={handleVideoSelect}>
                      Choose Video File
                    </MyButton>
                  )}
                </Box>
              </Flex>
            ) : (
              <Flex direction="column" gap="3">
                {videoLoading && !videoError && (
                  <Box
                    style={{
                      padding: '40px',
                      textAlign: 'center',
                      backgroundColor: 'var(--gray-2)',
                      borderRadius: '8px',
                      minHeight: '200px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text size="3" color="gray">
                      Loading video...
                    </Text>
                  </Box>
                )}

                {videoError && (
                  <Box
                    style={{
                      padding: '24px',
                      backgroundColor: 'var(--red-2)',
                      borderRadius: '8px',
                      border: '1px solid var(--red-6)',
                    }}
                  >
                    <Flex direction="column" gap="3">
                      <Text size="3" weight="bold" color="red">
                        ⚠️ Video Loading Error
                      </Text>
                      <Text size="2" color="red">
                        {videoError}
                      </Text>
                      <Box style={{ marginTop: '8px' }}>
                        <Text size="1" color="gray" weight="bold" mb="1">
                          Troubleshooting on macOS:
                        </Text>
                        <Flex
                          direction="column"
                          gap="1"
                          style={{ marginLeft: '8px' }}
                        >
                          <Text size="1" color="gray">
                            • Check file permissions: Move file to Downloads or
                            Desktop folder
                          </Text>
                          <Text size="1" color="gray">
                            • Grant Chrome file access: System Preferences →
                            Security & Privacy → Files and Folders → Enable
                            Chrome
                          </Text>
                          <Text size="1" color="gray">
                            • Format compatibility: Use MP4 with H.264 codec
                            (convert MKV using HandBrake or FFmpeg)
                          </Text>
                          <Text size="1" color="gray">
                            • Try a different browser: Safari may have better
                            file access on macOS
                          </Text>
                        </Flex>
                      </Box>
                      <MyButton
                        variant="soft"
                        color="red"
                        size="2"
                        onClick={() => {
                          setVideoUrl(null);
                          setVideoError(null);
                          setVideoLoading(false);
                          setHasRestoredVideoProgress(false);
                        }}
                        style={{ marginTop: '8px' }}
                      >
                        Try Different Video
                      </MyButton>
                    </Flex>
                  </Box>
                )}

                {!videoError && videoElement}

                {/* Custom Video Controls */}
                <Box style={{ padding: '0 16px' }}>
                  <Flex align="center" gap="3" wrap="wrap">
                    <MyButton onClick={handlePlayPause}>
                      {isPlaying ? 'Pause' : 'Play'}
                    </MyButton>
                    <Text size="2">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </Text>

                    {/* Sentence Overlay Toggle */}
                    <MyButton
                      variant={showSentenceOverlay ? 'solid' : 'soft'}
                      size="2"
                      onClick={() =>
                        setShowSentenceOverlay(!showSentenceOverlay)
                      }
                      style={{
                        backgroundColor: showSentenceOverlay
                          ? 'var(--accent-9)'
                          : undefined,
                      }}
                    >
                      {showSentenceOverlay
                        ? '📖 Hide Subtitles'
                        : '📖 Show Subtitles'}
                    </MyButton>

                    {/* Backend Progress Controls */}
                    {lesson?.userProgress?.sentenceInfo?.startTime &&
                      !hasRestoredVideoProgress && (
                        <MyButton
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
                          {formatTime(
                            lesson.userProgress.sentenceInfo.startTime
                          )}
                        </MyButton>
                      )}

                    <MyButton
                      variant="soft"
                      size="2"
                      onClick={() => {
                        // Clean up object URL before clearing state
                        if (videoUrl) {
                          URL.revokeObjectURL(videoUrl);
                        }
                        setVideoUrl(null);
                        setHasRestoredVideoProgress(false);
                        setVideoError(null);
                        setVideoLoading(false);
                      }}
                    >
                      Change Video
                    </MyButton>
                  </Flex>

                  {/* Seek Bar */}
                  <Box style={{ width: '100%', marginTop: '12px' }}>
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
                    <Text size="1" color="gray" style={{ marginTop: '8px' }}>
                      {hasRestoredVideoProgress
                        ? '✓ Resumed from last lesson position'
                        : `📖 Lesson progress available at ${formatTime(lesson.userProgress.sentenceInfo.startTime)}`}
                    </Text>
                  )}
                </Box>
              </Flex>
            )}
          </Flex>
        </Card>
      </Box>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mkv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Sentences Sidebar - Fixed position on the right, below word sidebar when open */}
      <Box
        style={{
          position: 'fixed',
          top: isSidebarOpen ? '60vh' : '0',
          right: '0',
          width: '350px',
          height: isSidebarOpen ? '40vh' : '100vh',
          backgroundColor: 'var(--color-surface)',
          borderLeft: '1px solid var(--gray-6)',
          borderTop: isSidebarOpen ? '1px solid var(--gray-6)' : 'none',
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          transition: 'top 0.3s ease-in-out, height 0.3s ease-in-out',
          overflow: 'auto',
        }}
      >
        {/* Sentences Header */}
        <Box
          style={{ padding: '16px', borderBottom: '1px solid var(--gray-6)' }}
        >
          <Heading size="4">Sentences</Heading>
        </Box>

        {/* Sentences Content */}
        <Box style={{ padding: '16px', flex: 1 }}>
          <Flex direction="column" gap="2">
            {/* Previous Sentences */}
            {previousSentences.map((sentence, index) => (
              <Box key={sentence.id}>
                <Box
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--gray-3)',
                    borderRadius: '6px',
                    opacity: 0.6 + index * 0.1, // Gradually increase opacity for more recent sentences
                    cursor: sentence.start_time ? 'pointer' : 'default',
                    fontSize: '14px',
                  }}
                  onClick={() => {
                    if (sentence.start_time && videoRef.current) {
                      handleSeek(sentence.start_time);
                    }
                  }}
                >
                  <Text size="2">{sentence.original_text}</Text>
                </Box>
              </Box>
            ))}

            {/* Current Sentence */}
            <Box>
              {activeSentence ? (
                <Box
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--accent-3)',
                    borderRadius: '8px',
                    border: '2px solid var(--accent-6)',
                  }}
                >
                  <Flex direction="column" gap="3">
                    <Box>
                      <Box
                        style={{
                          lineHeight: '1.6',
                          fontSize: 'var(--font-size-3)',
                        }}
                      >
                        {activeSentence.split_text &&
                        activeSentence.split_text.length > 0 ? (
                          <SentenceReconstructor
                            sentence={activeSentence}
                            fontSize="16px"
                            onWordClick={handleWordClick}
                            fallbackToOriginalText={true}
                          />
                        ) : (
                          <Text size="3" style={{ lineHeight: '1.6' }}>
                            {activeSentence.original_text}
                          </Text>
                        )}
                      </Box>
                    </Box>

                    {/* Translation Section */}
                    <Box>
                      <MyButton
                        variant="soft"
                        size="1"
                        onClick={() => toggleTranslation(activeSentence.id)}
                        disabled={loadingTranslations[activeSentence.id]}
                        style={{}}
                      >
                        {loadingTranslations[activeSentence.id]
                          ? 'Loading...'
                          : translations[activeSentence.id]
                            ? 'Hide translation'
                            : 'Show translation'}
                      </MyButton>

                      {translations[activeSentence.id] && (
                        <Box
                          mt="2"
                          p="2"
                          style={{
                            backgroundColor: 'var(--gray-2)',
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
                            {translations[activeSentence.id]}
                          </Text>
                        </Box>
                      )}
                    </Box>
                  </Flex>
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

            {/* Next Sentences */}
            {nextSentences.map((sentence, index) => (
              <Box key={sentence.id}>
                <Box
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--gray-3)',
                    borderRadius: '6px',
                    opacity: 0.9 - index * 0.1, // Gradually decrease opacity for future sentences
                    cursor: sentence.start_time ? 'pointer' : 'default',
                    fontSize: '14px',
                  }}
                  onClick={() => {
                    if (sentence.start_time && videoRef.current) {
                      handleSeek(sentence.start_time);
                    }
                  }}
                >
                  <Text size="2">{sentence.original_text}</Text>
                </Box>
              </Box>
            ))}
          </Flex>

          {/* Finish Lesson Button in Sidebar */}
          {isLastSentence &&
            lesson?.userProgress?.status !== 'finished' &&
            !lessonCompleted && (
              <Box mt="4">
                <Flex direction="column" gap="3" align="center">
                  <Heading size="3">🎉 Congratulations!</Heading>
                  <Text size="2" color="gray" style={{ textAlign: 'center' }}>
                    You've reached the last sentence of this lesson.
                  </Text>
                  <MyButton
                    size="2"
                    variant="solid"
                    color="green"
                    onClick={handleFinishLesson}
                    disabled={isFinishingLesson}
                    style={{}}
                  >
                    {isFinishingLesson ? 'Finishing...' : 'Finish Lesson'}
                  </MyButton>
                </Flex>
              </Box>
            )}

          {/* Lesson Completed Message in Sidebar */}
          {lessonCompleted && (
            <Box mt="4">
              <Flex direction="column" gap="3" align="center">
                <Heading size="3">✅ Lesson Completed!</Heading>
                <Text size="2" color="green" style={{ textAlign: 'center' }}>
                  Great job! You have successfully completed this lesson. 🎉
                </Text>
                <MyButton
                  size="2"
                  variant="soft"
                  onClick={() => navigate('/lessons')}
                >
                  Back to Lessons
                </MyButton>
              </Flex>
            </Box>
          )}
        </Box>
      </Box>

      {/* Word Translation Sidebar */}
      <WordSidebar
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        selectedWord={selectedWord}
        languageCode={lesson?.languageCode}
        targetLanguage="en"
      />
    </Flex>
  );
};

export default LessonVideoViewPage;
