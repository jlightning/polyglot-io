import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Container,
  Flex,
  Heading,
  Text,
  Dialog,
  Badge,
  TextField,
  Select,
  IconButton,
} from '@radix-ui/themes';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  Cross2Icon,
  Pencil1Icon,
} from '@radix-ui/react-icons';
import MyButton from '../components/MyButton';
import LessonUpload from '../components/LessonUpload';
import LessonList from '../components/LessonList';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n';

interface SeriesDetail {
  id: number;
  title: string;
  languageCode: string;
  createdAt: string;
  status: 'completed' | 'in_progress' | 'pending';
  lessons: { id: number }[];
}

const SeriesDetailPage: React.FC = () => {
  const { t } = useI18n();
  const { seriesId } = useParams<{ seriesId: string }>();
  const { axiosInstance, isAuthenticated } = useAuth();
  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [lessonOptions, setLessonOptions] = useState<
    { id: number; title: string }[]
  >([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [adding, setAdding] = useState(false);
  const [movingLessonId, setMovingLessonId] = useState<number | null>(null);
  const [removingLessonId, setRemovingLessonId] = useState<number | null>(null);
  const [lessonListVersion, setLessonListVersion] = useState(0);

  const fetchSeries = useCallback(
    async (silent: boolean) => {
      if (!seriesId) {
        setLoading(false);
        setError(t('series.notFound'));
        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }
        setError(null);
        const response = await axiosInstance.get(`/api/series/${seriesId}`);
        if (response.data.success) {
          setSeries(response.data.series);
        } else if (!silent) {
          setSeries(null);
          setError(t('series.notFound'));
        } else {
          setError(t('series.loadFailed'));
        }
      } catch (err) {
        console.error('Error fetching series:', err);
        if (!silent) {
          setSeries(null);
          setError(t('series.notFound'));
        } else {
          setError(t('series.loadFailed'));
        }
      } finally {
        setLoading(false);
      }
    },
    [seriesId, axiosInstance, t]
  );

  useEffect(() => {
    if (isAuthenticated) {
      void fetchSeries(false);
    }
  }, [isAuthenticated, fetchSeries]);

  const handleRename = async () => {
    const title = editTitle.trim();
    if (!series || !title) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await axiosInstance.put(`/api/series/${series.id}`, {
        title,
      });
      if (response.data.success) {
        setSeries({ ...series, title });
        setRenameOpen(false);
      } else {
        setError(t('series.updateFailed'));
      }
    } catch (err) {
      console.error('Error updating series:', err);
      setError(t('series.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddLesson = async () => {
    if (!series || !selectedLessonId) {
      return;
    }

    try {
      setAdding(true);
      setError(null);
      const response = await axiosInstance.post(
        `/api/series/${series.id}/lessons`,
        { lessonId: Number(selectedLessonId) }
      );
      if (response.data.success) {
        setAddOpen(false);
        setSelectedLessonId('');
        await fetchSeries(true);
        setLessonListVersion(version => version + 1);
      } else {
        setError(t('series.addFailed'));
      }
    } catch (err) {
      console.error('Error adding lesson:', err);
      setError(t('series.addFailed'));
    } finally {
      setAdding(false);
    }
  };

  const handleMove = async (lessonId: number, direction: 'up' | 'down') => {
    if (!series) {
      return;
    }

    try {
      setMovingLessonId(lessonId);
      setError(null);
      const response = await axiosInstance.post(
        `/api/series/${series.id}/lessons/${lessonId}/move`,
        { direction }
      );
      if (response.data.success) {
        await fetchSeries(true);
        setLessonListVersion(version => version + 1);
      } else {
        setError(t('series.moveFailed'));
      }
    } catch (err) {
      console.error('Error moving lesson:', err);
      setError(t('series.moveFailed'));
    } finally {
      setMovingLessonId(null);
    }
  };

  const handleRemove = async (lessonId: number) => {
    if (!series) {
      return;
    }

    try {
      setRemovingLessonId(lessonId);
      setError(null);
      const response = await axiosInstance.delete(
        `/api/series/${series.id}/lessons/${lessonId}`
      );
      if (response.data.success) {
        setSeries({
          ...series,
          lessons: series.lessons.filter(lesson => lesson.id !== lessonId),
        });
        setLessonListVersion(version => version + 1);
      } else {
        setError(t('series.removeFailed'));
      }
    } catch (err) {
      console.error('Error removing lesson:', err);
      setError(t('series.removeFailed'));
    } finally {
      setRemovingLessonId(null);
    }
  };

  return (
    <Container size="4" p="4">
      <Link
        to="/series"
        style={{ color: 'var(--accent-11)', textDecoration: 'none' }}
      >
        <Text size="2">{t('series.back')}</Text>
      </Link>

      {loading ? (
        <Text color="gray" mt="4" as="div">
          {t('series.loading')}
        </Text>
      ) : !series ? (
        <Text color="red" mt="4" as="div">
          {error || t('series.notFound')}
        </Text>
      ) : (
        <>
          <Flex justify="between" align="center" mt="4" mb="4" gap="3">
            <Flex align="center" gap="3">
              <Heading size="6">{series.title}</Heading>
              <Badge
                variant="soft"
                color={
                  series.status === 'completed'
                    ? 'green'
                    : series.status === 'in_progress'
                      ? 'orange'
                      : 'gray'
                }
              >
                {series.status === 'completed'
                  ? t('lessonList.completed')
                  : series.status === 'in_progress'
                    ? t('lessonList.inProgress')
                    : t('series.statusPending')}
              </Badge>
            </Flex>
            <Flex gap="2">
              <MyButton
                variant="soft"
                onClick={() => {
                  setEditTitle(series.title);
                  setRenameOpen(true);
                }}
              >
                <Pencil1Icon />
                {t('series.rename')}
              </MyButton>
              <LessonUpload
                languageCode={series.languageCode}
                redirectToLesson={false}
                onLessonUploaded={lessonId => {
                  if (!lessonId) {
                    return;
                  }
                  void axiosInstance
                    .post(`/api/series/${series.id}/lessons`, { lessonId })
                    .then(response => {
                      if (response.data.success) {
                        void fetchSeries(true);
                        setLessonListVersion(version => version + 1);
                      } else {
                        setError(t('series.addFailed'));
                      }
                    })
                    .catch(err => {
                      console.error('Error adding created lesson:', err);
                      setError(t('series.addFailed'));
                    });
                }}
              />
              <Dialog.Root
                open={addOpen}
                onOpenChange={open => {
                  setAddOpen(open);
                  if (!open) {
                    setSelectedLessonId('');
                    return;
                  }
                  setLessonsLoading(true);
                  setSelectedLessonId('');
                  void axiosInstance
                    .get(`/api/lessons/language/${series.languageCode}`)
                    .then(response => {
                      if (response.data.success) {
                        const inSeries = new Set(
                          series.lessons.map(lesson => lesson.id)
                        );
                        const options = (response.data.lessons || []).flatMap(
                          (lesson: { id: number; title: string }) =>
                            inSeries.has(lesson.id)
                              ? []
                              : [{ id: lesson.id, title: lesson.title }]
                        );
                        setLessonOptions(options);
                      } else {
                        setError(t('series.loadFailed'));
                      }
                    })
                    .catch(err => {
                      console.error('Error loading lessons:', err);
                      setError(t('series.loadFailed'));
                    })
                    .finally(() => {
                      setLessonsLoading(false);
                    });
                }}
              >
                <Dialog.Trigger>
                  <MyButton>{t('series.addLesson')}</MyButton>
                </Dialog.Trigger>
                <Dialog.Content style={{ maxWidth: 450 }}>
                  <Dialog.Title>{t('series.addLessonTitle')}</Dialog.Title>
                  {lessonsLoading ? (
                    <Text color="gray" mt="3" as="div">
                      {t('common.loading')}
                    </Text>
                  ) : lessonOptions.length === 0 ? (
                    <Text color="gray" mt="3" as="div">
                      {t('series.noLessonsToAdd')}
                    </Text>
                  ) : (
                    <Select.Root
                      value={selectedLessonId}
                      onValueChange={setSelectedLessonId}
                    >
                      <Select.Trigger
                        placeholder={t('series.selectLesson')}
                        style={{ width: '100%', marginTop: 12 }}
                      />
                      <Select.Content>
                        {lessonOptions.map(lesson => (
                          <Select.Item
                            key={lesson.id}
                            value={String(lesson.id)}
                          >
                            {lesson.title}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  )}
                  <Flex gap="3" mt="4" justify="end">
                    <Dialog.Close>
                      <MyButton variant="soft" color="gray">
                        {t('common.cancel')}
                      </MyButton>
                    </Dialog.Close>
                    <MyButton
                      onClick={handleAddLesson}
                      disabled={adding || !selectedLessonId}
                    >
                      {adding ? t('series.adding') : t('series.addLesson')}
                    </MyButton>
                  </Flex>
                </Dialog.Content>
              </Dialog.Root>
            </Flex>
          </Flex>

          {error && (
            <Text color="red" mb="4" as="div">
              {error}
            </Text>
          )}

          {series.lessons.length === 0 ? (
            <Text color="gray">{t('series.emptyLessons')}</Text>
          ) : (
            <LessonList
              selectedLanguage={series.languageCode}
              refreshTrigger={lessonListVersion}
              seriesId={series.id}
              trailing={(lesson, index, count) => (
                <>
                  <IconButton
                    variant="ghost"
                    disabled={index === 0 || movingLessonId === lesson.id}
                    onClick={() => handleMove(lesson.id, 'up')}
                    title={t('series.moveUp')}
                  >
                    <ArrowUpIcon />
                  </IconButton>
                  <IconButton
                    variant="ghost"
                    disabled={
                      index === count - 1 || movingLessonId === lesson.id
                    }
                    onClick={() => handleMove(lesson.id, 'down')}
                    title={t('series.moveDown')}
                  >
                    <ArrowDownIcon />
                  </IconButton>
                  <IconButton
                    variant="ghost"
                    color="red"
                    disabled={removingLessonId === lesson.id}
                    onClick={() => handleRemove(lesson.id)}
                    title={t('series.removeLesson')}
                  >
                    <Cross2Icon />
                  </IconButton>
                </>
              )}
            />
          )}

          <Dialog.Root open={renameOpen} onOpenChange={setRenameOpen}>
            <Dialog.Content style={{ maxWidth: 450 }}>
              <Dialog.Title>{t('series.renameTitle')}</Dialog.Title>
              <Flex direction="column" gap="2" mt="3">
                <Text size="2">{t('series.name')}</Text>
                <TextField.Root
                  value={editTitle}
                  onChange={event => setEditTitle(event.target.value)}
                />
              </Flex>
              <Flex gap="3" mt="4" justify="end">
                <Dialog.Close>
                  <MyButton variant="soft" color="gray">
                    {t('common.cancel')}
                  </MyButton>
                </Dialog.Close>
                <MyButton
                  onClick={handleRename}
                  disabled={saving || !editTitle.trim()}
                >
                  {saving ? t('common.saving') : t('common.save')}
                </MyButton>
              </Flex>
            </Dialog.Content>
          </Dialog.Root>
        </>
      )}
    </Container>
  );
};

export default SeriesDetailPage;
