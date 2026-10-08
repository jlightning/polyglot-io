import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n';
import AudioPlayer from './AudioPlayer';
import LessonEditDialog from './LessonEditDialog';

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
  const fetchLessons = useCallback(async () => {
    if (!selectedLanguage) {
      setLoading(false);
      setError(t('lessonList.selectLanguage'));
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
        setError(t('lessonList.loadFailed'));
      }
    } catch (err) {
      console.error('Error fetching lessons:', err);
      setError(t('lessonList.loadFailed'));
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
        setError(t('lessonList.deleteFailed'));
      }
    } catch (err) {
      console.error('Error deleting lesson:', err);
      setError(t('lessonList.deleteFailed'));
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
      setError(t('lessonList.splitFailed'));
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
      setError(t('lessonList.pinFailed'));
    } finally {
      setPinningLessonId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <Text>{t('lessonList.loading')}</Text>
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
            {t('lessonList.empty')}
          </Text>
          <Text size="2" color="gray">
            {t('lessonList.emptyLanguage')}
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
                      ? t('lessonList.ready')
                      : lesson.processingStatus === 'pending'
                        ? t('lessonList.processing')
                        : t('lessonList.failed')}
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
                          ? t('lessonList.completed')
                          : t('lessonList.inProgress')}
                      </Badge>
                    )}
                  {lesson.lessonType && (
                    <Badge variant="outline" color="gray">
                      {lesson.lessonType === 'text'
                        ? t('lessonType.text')
                        : lesson.lessonType === 'subtitle'
                          ? t('lessonType.subtitle')
                          : lesson.lessonType === 'manga'
                            ? t('lessonType.manga')
                            : lesson.lessonType === 'manual'
                              ? t('lessonType.manual')
                              : lesson.lessonType === 'generated'
                                ? t('lessonType.generated')
                                : lesson.lessonType}
                    </Badge>
                  )}
                  {lesson.isSplittingSentences && (
                    <Badge variant="soft" color="yellow">
                      {lesson.sentenceSplitProgress
                        ? t('lessonList.splittingProgress', {
                            done: lesson.sentenceSplitProgress.splitCount,
                            total: lesson.sentenceSplitProgress.totalCount,
                          })
                        : t('lessonList.splitting')}
                    </Badge>
                  )}
                  <Text size="2" color="gray">
                    {t('lessonList.lessonNumber', { id: lesson.id })}
                  </Text>
                </Flex>

                <Text size="3" weight="medium">
                  {lesson.title}
                </Text>

                <Flex direction="column" gap="2">
                  {lesson.imageUrl && (
                    <Flex align="center" gap="2">
                      <Text size="2" weight="medium">
                        {t('lessonList.image')}
                      </Text>
                      <a
                        href={lesson.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent-9)' }}
                      >
                        <Text size="2">{t('lessonList.viewImage')}</Text>
                      </a>
                    </Flex>
                  )}

                  {lesson.fileUrl && (
                    <Flex align="center" gap="2">
                      <Text size="2" weight="medium">
                        {t('lessonList.file')}
                      </Text>
                      <a
                        href={lesson.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent-9)' }}
                      >
                        <Text size="2">{t('lessonList.downloadFile')}</Text>
                      </a>
                    </Flex>
                  )}

                  {lesson.audioUrl && (
                    <Box>
                      <Text size="2" weight="medium" mb="2" as="div">
                        {t('lessonList.audio')}
                      </Text>
                      <AudioPlayer
                        audioUrl={lesson.audioUrl}
                        title={t('lessonList.audioTitle', {
                          title: lesson.title,
                        })}
                      />
                    </Box>
                  )}
                </Flex>

                <Text size="1" color="gray">
                  {t('lessonList.created', {
                    date: dayjs(lesson.createdAt).format('DD/MM/YYYY'),
                  })}
                </Text>

                {lesson.createdWithPrompt && (
                  <Text size="2" color="gray" as="div">
                    {t('lessonList.prompt', {
                      prompt: lesson.createdWithPrompt,
                    })}
                  </Text>
                )}

                {lesson.processingStatus === 'pending' && (
                  <Box mt="3">
                    <Text size="2" color="orange">
                      {t('lessonList.processingNote')}
                    </Text>
                  </Box>
                )}

                {lesson.processingStatus === 'failed' && (
                  <Box mt="3">
                    <Text size="2" color="red">
                      {t('lessonList.failedNote')}
                    </Text>
                  </Box>
                )}

                <Flex gap="2" mt="3">
                  {lesson.processingStatus !== 'completed' ? (
                    <MyButton variant="soft" size="2" disabled>
                      <EyeOpenIcon />
                      {t('lessonList.view')}
                    </MyButton>
                  ) : (
                    <MyButton variant="soft" size="2" asChild>
                      <Link to={`/lessons/${lesson.id}`}>
                        <EyeOpenIcon />
                        {t('lessonList.view')}
                      </Link>
                    </MyButton>
                  )}
                  <MyButton variant="soft" size="2" asChild>
                    <Link to={`/words?lessonId=${lesson.id}`}>
                      {t('lessonList.wordsInLesson')}
                    </Link>
                  </MyButton>
                  {lesson.lessonType === 'subtitle' &&
                    (lesson.processingStatus !== 'completed' ? (
                      <MyButton variant="soft" size="2" disabled>
                        <VideoIcon />
                        {t('lessonList.viewVideo')}
                      </MyButton>
                    ) : (
                      <MyButton variant="soft" size="2" asChild>
                        <Link to={`/lessons/${lesson.id}/video`}>
                          <VideoIcon />
                          {t('lessonList.viewVideo')}
                        </Link>
                      </MyButton>
                    ))}
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
                        ? t('lessonList.splittingButton')
                        : t('lessonList.splitAll')}
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
                  title={
                    lesson.isPinned
                      ? t('lessonList.unpin')
                      : t('lessonList.pin')
                  }
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
                    <Dialog.Title>{t('lessonList.deleteTitle')}</Dialog.Title>
                    <Dialog.Description size="2" mb="4">
                      {t('lessonList.deleteConfirm')}
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
                            ? t('common.deleting')
                            : t('common.delete')}
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
