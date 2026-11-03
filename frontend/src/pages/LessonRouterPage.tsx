import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Container, Flex, Text } from '@radix-ui/themes';
import MyButton from '../components/MyButton';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n';
import LessonViewPage from './LessonViewPage';
import LessonOriginalTextViewPage from './LessonOriginalTextViewPage';

const LessonRouterPage: React.FC = () => {
  const { t } = useI18n();
  const { lessonId } = useParams<{ lessonId: string }>();
  const [searchParams] = useSearchParams();
  const { axiosInstance, isAuthenticated, isLoading: authLoading } = useAuth();
  const [lesson, setLesson] = useState<{
    id: number;
    title: string;
    languageCode: string;
    lessonType?: string;
    totalSentences?: number;
    createdWithPrompt?: string;
    userProgress?: {
      status: string;
      readTillSentenceId: number;
    } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLesson = async () => {
      if (!lessonId || !isAuthenticated) return;
      try {
        setLoading(true);
        setError(null);
        const response = await axiosInstance.get(`/api/lessons/${lessonId}`);
        if (response.data.success && response.data.lesson) {
          setLesson(response.data.lesson);
        } else {
          setError(t('view.loadFailed'));
        }
      } catch (err) {
        console.error('Error fetching lesson:', err);
        setError(t('view.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadLesson();
  }, [lessonId, isAuthenticated, axiosInstance, t]);

  if (authLoading || loading) {
    return (
      <Container size="4" p="4">
        <Flex
          direction="column"
          align="center"
          justify="center"
          style={{ minHeight: '50vh' }}
        >
          <Text size="3">{t('view.loading')}</Text>
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
            {t('view.loginRequired')}
          </Text>
        </Flex>
      </Container>
    );
  }

  if (error || !lesson) {
    return (
      <Container size="4" p="4">
        <Flex direction="column" gap="4">
          <MyButton variant="ghost" asChild>
            <Link to="/lessons">← {t('view.back')}</Link>
          </MyButton>
          <Flex
            direction="column"
            align="center"
            justify="center"
            style={{ minHeight: '50vh' }}
          >
            <Text size="3" color="red">
              {error || t('view.notFound')}
            </Text>
          </Flex>
        </Flex>
      </Container>
    );
  }

  const showOriginal =
    (lesson.lessonType === 'text' || lesson.lessonType === 'generated') &&
    searchParams.get('view') !== 'sentences';

  if (showOriginal) {
    return <LessonOriginalTextViewPage lesson={lesson} />;
  }

  return <LessonViewPage />;
};

export default LessonRouterPage;
