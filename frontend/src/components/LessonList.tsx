import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Text,
  Flex,
  Badge,
  Dialog,
  IconButton,
  Box,
} from '@radix-ui/themes';
import MyButton from './MyButton';
import {
  TrashIcon,
  EyeOpenIcon,
  VideoIcon,
  Pencil1Icon,
  DrawingPinIcon,
  DrawingPinFilledIcon,
} from '@radix-ui/react-icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';
import AudioPlayer from './AudioPlayer';
import LessonEditDialog from './LessonEditDialog';
import { useI18n } from '../contexts/I18nContext';

interface Lesson {
  id: number;
  title: string;
  languageCode: string;
  lessonType?: 'text' | 'subtitle' | 'manga' | 'manual' | 'generated';
  processingStatus: 'pending' | 'completed' | 'failed';
  imageUrl?: string;
  fileUrl?: string;
  audioUrl?: string;
  createdAt: string;
  isPinned?: boolean;
  createdWithPrompt?: string;
  userProgress?: {
    status: 'reading' | 'finished';
    readTillSentenceId: number;
  };
  isSplittingSentences?: boolean;
  sentenceSplitProgress?: { splitCount: number; totalCount: number };
  hasUnsplitSentences?: boolean;
}

interface LessonListProps {
  selectedLanguage: string;
  refreshTrigger: number;
  search?: string;
  statusFilter?: 'reading' | 'finished';
  typeFilter?: 'text' | 'subtitle' | 'manga' | 'manual' | 'generated';
}

const LessonList: React.FC<LessonListProps> = ({
  selectedLanguage,
  refreshTrigger,
  search,
  statusFilter,
  typeFilter,
}) => {
  const { t } = useI18n();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<number | null>(null);
  const [pinningLessonId, setPinningLessonId] = useState<number | null>(null);
  const { axiosInstance, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const fetchLessons = useCallback(async () => {
    if (!selectedLanguage) {
      setLoading(false);
      setError(t('lessons.selectLanguage'));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const endpoint = `/api/lessons/language/${selectedLanguage}`;

      // Build query parameters
      const params = new URLSearchParams();
      if (search) {
        params.append('search', search);
      }
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      if (typeFilter) {
        params.append('type', typeFilter);
      }

      const queryString = params.toString();
      const url = queryString ? `${endpoint}?${queryString}` : endpoint;

      const response = await axiosInstance.get(url);

      if (response.data.success) {
        setLessons(response.data.lessons || []);
      } else {
        setError(response.data.message || t('lessons.loadFailed'));
      }
    } catch (err) {
      console.error('Error fetching lessons:', err);
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError(t('lessons.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [selectedLanguage, search, statusFilter, typeFilter, axiosInstance, t]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchLessons();
    }
  }, [isAuthenticated, refreshTrigger, fetchLessons]);

  // Auto-refresh for pending lesson uploads
  useEffect(() => {
    const hasPendingLessons = lessons.some(
      lesson => lesson.processingStatus === 'pending'
    );

    if (!hasPendingLessons) {
      return undefined;
    }

    const interval = setInterval(() => {
      fetchLessons();
    }, 10000);

    return () => clearInterval(interval);
  }, [lessons, fetchLessons]);

  // Poll split progress per lesson (lightweight API)
  const splittingLessonIds = lessons
    .filter(lesson => lesson.isSplittingSentences)
    .map(lesson => lesson.id)
    .join(',');

  useEffect(() => {
    if (!splittingLessonIds) {
      return undefined;
    }

    const lessonIds = splittingLessonIds.split(',').map(Number);

    const pollSplitProgress = async () => {
      const responses = await Promise.all(
        lessonIds.map(id =>
          axiosInstance.get(`/api/lessons/${id}/split-sentences/progress`)
        )
      );

      setLessons(prev =>
        prev.map(lesson => {
          const index = lessonIds.indexOf(lesson.id);
          if (index === -1) {
            return lesson;
          }

          const data = responses[index]?.data;
          if (!data?.success) {
            return lesson;
          }

          if (!data.isSplitting) {
            const { sentenceSplitProgress: _, ...rest } = lesson;
            return {
              ...rest,
              isSplittingSentences: false,
              hasUnsplitSentences: data.splitCount < data.totalCount,
            };
          }

          return {
            ...lesson,
            sentenceSplitProgress: {
              splitCount: data.splitCount,
              totalCount: data.totalCount,
            },
          };
        })
      );
    };

    void pollSplitProgress();
    const interval = setInterval(() => {
      void pollSplitProgress();
    }, 10000);

    return () => clearInterval(interval);
  }, [splittingLessonIds, axiosInstance]);

  const handleDeleteLesson = async (lessonId: number) => {
    try {
      setDeletingLessonId(lessonId);
      const response = await axiosInstance.delete(`/api/lessons/${lessonId}`);

      if (response.data.success) {
        // Remove the deleted lesson from the list
        setLessons(lessons.filter(lesson => lesson.id !== lessonId));
      } else {
        setError(response.data.message || t('lessons.deleteFailed'));
      }
    } catch (err) {
      console.error('Error deleting lesson:', err);
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError(t('lessons.deleteFailed'));
      }
    } finally {
      setDeletingLessonId(null);
    }
  };

  const handleLessonUpdated = (
    lessonId: number,
    updatedLesson?: Partial<Lesson>
  ) => {
    if (updatedLesson) {
      // Update the lesson in the local state
      setLessons(prevLessons =>
        prevLessons.map(lesson =>
          lesson.id === lessonId ? { ...lesson, ...updatedLesson } : lesson
        )
      );
    } else {
      // If no updated data provided, refetch to ensure consistency
      fetchLessons();
    }
  };

  const handleSplitAllSentences = async (lessonId: number) => {
    try {
      await axiosInstance.post(`/api/lessons/${lessonId}/split-sentences`);
      setLessons(prev =>
        prev.map(lesson =>
          lesson.id === lessonId
            ? { ...lesson, isSplittingSentences: true }
            : lesson
        )
      );
    } catch (err) {
      console.error('Error splitting sentences:', err);
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError(t('lessons.splitFailed'));
      }
    }
  };

  const handleTogglePin = async (lesson: Lesson) => {
    try {
      setPinningLessonId(lesson.id);
      if (lesson.isPinned) {
        await axiosInstance.delete(`/api/lessons/${lesson.id}/pin`);
      } else {
        await axiosInstance.post(`/api/lessons/${lesson.id}/pin`);
      }
      await fetchLessons();
    } catch (err) {
      console.error('Error toggling pin:', err);
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response?.data?.message ?? t('lessons.pinFailed'));
      } else {
        setError(t('lessons.pinFailed'));
      }
    } finally {
      setPinningLessonId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <Text>{t('lessons.loading')}</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Text color="red">{error}</Text>
        <MyButton onClick={fetchLessons} variant="soft" mt="2">
          {t('common.retry')}
        </MyButton>
      </Card>
    );
  }

  if (lessons.length === 0) {
    return (
      <Card>
        <Flex direction="column" align="center" gap="2" p="4">
          <Text size="3" color="gray">
            {t('lessons.none')}
          </Text>
          <Text size="2" color="gray">
            {t('lessons.noneForLanguage')}
          </Text>
        </Flex>
      </Card>
    );
  }

  return (
    <Box>
      <Flex direction="column" gap="3">
        {lessons.map(lesson => (
          <Card key={lesson.id}>
            <Flex justify="between" align="start" gap="3">
              <Flex direction="column" gap="2" flexGrow="1">
                <Flex align="center" gap="2">
                  <Badge variant="soft" color="blue">
                    {lesson.languageCode.toUpperCase()}
                  </Badge>
                  <Badge
                    variant="soft"
                    color={
                      lesson.processingStatus === 'completed'
                        ? 'green'
                        : lesson.processingStatus === 'pending'
                          ? 'yellow'
                          : 'red'
                    }
                  >
                    {lesson.processingStatus === 'completed'
                      ? t('lessons.ready')
                      : lesson.processingStatus === 'pending'
                        ? t('lessons.processing')
                        : t('lessons.failed')}
                  </Badge>
                  {lesson.userProgress &&
                    lesson.processingStatus === 'completed' && (
                      <Badge
                        variant="soft"
                        color={
                          lesson.userProgress.status === 'finished'
                            ? 'green'
                            : 'orange'
                        }
                      >
                        {lesson.userProgress.status === 'finished'
                          ? t('lessons.progressCompleted')
                          : t('lessons.progressReading')}
                      </Badge>
                    )}
                  {lesson.lessonType && (
                    <Badge variant="outline" color="gray">
                      {lesson.lessonType.charAt(0).toUpperCase() +
                        lesson.lessonType.slice(1)}
                    </Badge>
                  )}
                  {lesson.isSplittingSentences && (
                    <Badge variant="soft" color="yellow">
                      {t('lessons.splitting')}
                      {lesson.sentenceSplitProgress
                        ? ` ${lesson.sentenceSplitProgress.splitCount} / ${lesson.sentenceSplitProgress.totalCount}`
                        : ''}
                    </Badge>
                  )}
                  <Text size="2" color="gray">
                    {t('lessons.number', { id: lesson.id })}
                  </Text>
                </Flex>

                <Text size="3" weight="medium">
                  {lesson.title}
                </Text>

                <Flex direction="column" gap="2">
                  {lesson.imageUrl && (
                    <Flex align="center" gap="2">
                      <Text size="2" weight="medium">
                        {t('lessons.image')}
                      </Text>
                      <a
                        href={lesson.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent-9)' }}
                      >
                        <Text size="2">{t('lessons.viewImage')}</Text>
                      </a>
                    </Flex>
                  )}

                  {lesson.fileUrl && (
                    <Flex align="center" gap="2">
                      <Text size="2" weight="medium">
                        {t('lessons.file')}
                      </Text>
                      <a
                        href={lesson.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent-9)' }}
                      >
                        <Text size="2">{t('lessons.downloadFile')}</Text>
                      </a>
                    </Flex>
                  )}

                  {lesson.audioUrl && (
                    <Box>
                      <Text size="2" weight="medium" mb="2" as="div">
                        {t('lessons.audio')}
                      </Text>
                      <AudioPlayer
                        audioUrl={lesson.audioUrl}
                        title={`${lesson.title} - Audio`}
                      />
                    </Box>
                  )}
                </Flex>

                <Text size="1" color="gray">
                  {t('lessons.created', { date: dayjs(lesson.createdAt).format('MM/DD/YYYY') })}
                </Text>

                {lesson.createdWithPrompt && (
                  <Text size="2" color="gray" as="div">
                    {t('lessons.prompt', { prompt: lesson.createdWithPrompt })}
                  </Text>
                )}

                {lesson.processingStatus === 'pending' && (
                  <Box mt="3">
                    <Text size="2" color="orange">
                      {t('lessons.processingHelp')}
                    </Text>
                  </Box>
                )}

                {lesson.processingStatus === 'failed' && (
                  <Box mt="3">
                    <Text size="2" color="red">
                      {t('lessons.failedHelp')}
                    </Text>
                  </Box>
                )}

                <Flex gap="2" mt="3">
                  <MyButton
                    variant="soft"
                    size="2"
                    disabled={lesson.processingStatus !== 'completed'}
                    onClick={() => navigate(`/lessons/${lesson.id}`)}
                  >
                    <EyeOpenIcon />
                    {t('lessons.view')}
                  </MyButton>
                  <MyButton
                    variant="soft"
                    size="2"
                    onClick={() => navigate(`/words?lessonId=${lesson.id}`)}
                  >
                    {t('lesson.words')}
                  </MyButton>
                  {lesson.lessonType === 'subtitle' && (
                    <MyButton
                      variant="soft"
                      size="2"
                      disabled={lesson.processingStatus !== 'completed'}
                      onClick={() => navigate(`/lessons/${lesson.id}/video`)}
                    >
                      <VideoIcon />
                      {t('lessons.viewVideo')}
                    </MyButton>
                  )}
                  {(lesson.hasUnsplitSentences ||
                    lesson.isSplittingSentences) && (
                    <MyButton
                      variant="soft"
                      size="2"
                      disabled={
                        lesson.processingStatus !== 'completed' ||
                        lesson.isSplittingSentences
                      }
                      onClick={() => handleSplitAllSentences(lesson.id)}
                    >
                      {lesson.isSplittingSentences
                        ? t('lessons.splittingShort')
                        : t('lessons.splitAll')}
                    </MyButton>
                  )}
                </Flex>
              </Flex>

              <Flex gap="2" align="start">
                <IconButton
                  variant="ghost"
                  color={lesson.isPinned ? 'blue' : 'gray'}
                  disabled={pinningLessonId === lesson.id}
                  onClick={() => handleTogglePin(lesson)}
                  title={lesson.isPinned ? t('lessons.unpin') : t('lessons.pin')}
                >
                  {lesson.isPinned ? (
                    <DrawingPinFilledIcon />
                  ) : (
                    <DrawingPinIcon />
                  )}
                </IconButton>
                <LessonEditDialog
                  lesson={lesson}
                  onLessonUpdated={updatedLesson =>
                    handleLessonUpdated(lesson.id, updatedLesson)
                  }
                  trigger={
                    <IconButton variant="ghost" color="blue">
                      <Pencil1Icon />
                    </IconButton>
                  }
                />

                <Dialog.Root>
                  <Dialog.Trigger>
                    <IconButton
                      variant="ghost"
                      color="red"
                      disabled={deletingLessonId === lesson.id}
                    >
                      <TrashIcon />
                    </IconButton>
                  </Dialog.Trigger>
                  <Dialog.Content style={{ maxWidth: 450 }}>
                    <Dialog.Title>{t('lessons.deleteTitle')}</Dialog.Title>
                    <Dialog.Description size="2" mb="4">
                      {t('lessons.deleteConfirm')}
                    </Dialog.Description>

                    <Flex gap="3" mt="4" justify="end">
                      <Dialog.Close>
                        <MyButton variant="soft" color="gray">
                          {t('common.cancel')}
                        </MyButton>
                      </Dialog.Close>
                      <Dialog.Close>
                        <MyButton
                          variant="solid"
                          color="red"
                          onClick={() => handleDeleteLesson(lesson.id)}
                          disabled={deletingLessonId === lesson.id}
                        >
                          {deletingLessonId === lesson.id
                            ? t('lesson.deleting')
                            : t('lesson.delete')}
                        </MyButton>
                      </Dialog.Close>
                    </Flex>
                  </Dialog.Content>
                </Dialog.Root>
              </Flex>
            </Flex>
          </Card>
        ))}
      </Flex>
    </Box>
  );
};

export default LessonList;
