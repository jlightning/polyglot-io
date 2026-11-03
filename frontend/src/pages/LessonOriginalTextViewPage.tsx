import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Badge,
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Separator,
  Text,
} from '@radix-ui/themes';
import MyButton from '../components/MyButton';
import LessonEditDialog from '../components/LessonEditDialog';
import LessonOriginalTextReConstructor from '../components/LessonOriginalTextReConstructor';
import { useAuth } from '../contexts/AuthContext';
import { useWordMark } from '../contexts/WordMarkContext';
import { useWordSidebar } from '../contexts/WordSidebarContext';
import { useI18n } from '../i18n';

const LessonOriginalTextViewPage: React.FC<{
  lesson: {
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
  };
}> = ({ lesson }) => {
  const { t } = useI18n();
  const { lessonId } = useParams<{ lessonId: string }>();
  const { axiosInstance, isAuthenticated } = useAuth();
  const { addWords } = useWordMark();
  const { openWordSidebar, setWordSidebarLanguage } = useWordSidebar();
  const [text, setText] = useState<string | null>(null);
  const [words, setWords] = useState<{ word: string; sentenceId: number }[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [finished, setFinished] = useState(
    lesson.userProgress?.status === 'finished'
  );
  const [isFinishingLesson, setIsFinishingLesson] = useState(false);

  useEffect(() => {
    setWordSidebarLanguage(lesson.languageCode);
  }, [lesson.languageCode, setWordSidebarLanguage]);

  useEffect(() => {
    const loadOriginalText = async () => {
      if (!lessonId || !isAuthenticated) return;
      try {
        setLoading(true);
        setError(null);
        const response = await axiosInstance.get(
          `/api/lessons/${lessonId}/original-text`
        );
        if (response.data.success && typeof response.data.text === 'string') {
          const loadedWords: { word: string; sentenceId: number }[] =
            Array.isArray(response.data.words) ? response.data.words : [];
          setText(response.data.text);
          setWords(loadedWords);
          await addWords(
            [...new Set(loadedWords.map(word => word.word))],
            lesson.languageCode
          );
        } else {
          setError(t('view.loadFailed'));
        }
      } catch (err) {
        console.error('Error fetching original lesson text:', err);
        setError(t('view.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadOriginalText();
  }, [lessonId, isAuthenticated, axiosInstance, lesson.languageCode, t]);

  const handleFinishLesson = async () => {
    if (!lessonId || !isAuthenticated || isFinishingLesson) return;
    try {
      setIsFinishingLesson(true);
      await axiosInstance.post(`/api/lessons/${lessonId}/progress`, {
        currentPage: 1,
        sentencesPerPage: 10,
        finishLesson: true,
      });
      setFinished(true);
    } catch (err) {
      console.error('Error finishing lesson:', err);
    } finally {
      setIsFinishingLesson(false);
    }
  };

  if (loading) {
    return (
      <Container size="4" p="4">
        <Text size="3">{t('view.loading')}</Text>
      </Container>
    );
  }

  return (
    <Container size="4" p="4">
      <Flex direction="column" gap="4" mb="6">
        <MyButton variant="ghost" asChild>
          <Link to="/lessons">← {t('view.back')}</Link>
        </MyButton>
        <Flex align="center" gap="3" justify="between">
          <Flex align="center" gap="3">
            <Heading size="6">{title}</Heading>
            <Badge variant="soft">{lesson.languageCode.toUpperCase()}</Badge>
          </Flex>
          <Flex gap="3">
            <MyButton variant="soft" asChild>
              <Link to={`/lessons/${lessonId}?view=sentences`}>
                {t('view.sentences')}
              </Link>
            </MyButton>
            <MyButton variant="soft" asChild>
              <Link to={`/lessons/${lessonId}/video`}>{t('view.video')}</Link>
            </MyButton>
            <MyButton variant="soft" asChild>
              <Link to={`/words?lessonId=${lessonId}`}>
                {t('lessonList.wordsInLesson')}
              </Link>
            </MyButton>
            <MyButton variant="soft" onClick={() => setIsEditDialogOpen(true)}>
              {t('edit.title')}
            </MyButton>
          </Flex>
        </Flex>
        <Flex direction="column" gap="1">
          {typeof lesson.totalSentences === 'number' && (
            <Text size="3" color="gray">
              {t('view.sentenceCount', { count: lesson.totalSentences })}
            </Text>
          )}
          {lesson.createdWithPrompt && (
            <Text size="2" color="gray">
              {t('view.createdWithPrompt', {
                prompt: lesson.createdWithPrompt,
              })}
            </Text>
          )}
          {(lesson.userProgress || finished) && (
            <Text size="2" color={finished ? 'green' : 'blue'}>
              {t('view.status')}{' '}
              {finished ? t('view.completed') : t('view.inProgress')}
              {finished && ' 🎉'}
            </Text>
          )}
        </Flex>
      </Flex>

      <Separator size="4" mb="4" />

      {error || text === null ? (
        <Text size="3" color="red">
          {error || t('view.loadFailed')}
        </Text>
      ) : (
        <Card mb="6" style={{ padding: '16px' }}>
          <Box style={{ lineHeight: '1.6', fontSize: 'var(--font-size-4)' }}>
            <LessonOriginalTextReConstructor
              text={text}
              words={words}
              fontSize="18px"
              onWordClick={word => openWordSidebar(word, lesson.languageCode)}
              className="word-badge"
            />
          </Box>
        </Card>
      )}

      {!finished && (
        <Flex justify="center" mt="6">
          <MyButton
            size="3"
            variant="solid"
            color="green"
            onClick={handleFinishLesson}
            disabled={isFinishingLesson}
          >
            {isFinishingLesson ? t('view.finishing') : t('view.finish')}
          </MyButton>
        </Flex>
      )}

      <LessonEditDialog
        lesson={{
          id: lesson.id,
          title,
          languageCode: lesson.languageCode,
          createdAt: new Date().toISOString(),
        }}
        onLessonUpdated={updated => {
          if (updated?.title) setTitle(updated.title);
        }}
        trigger={null}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </Container>
  );
};

export default LessonOriginalTextViewPage;
