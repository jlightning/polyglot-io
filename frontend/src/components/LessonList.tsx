import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Text,
  Flex,
  Button,
  Badge,
  Dialog,
  IconButton,
  Box,
} from '@radix-ui/themes';
import { TrashIcon, EyeOpenIcon, VideoIcon } from '@radix-ui/react-icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';
import AudioPlayer from './AudioPlayer';

interface Lesson {
  id: number;
  title: string;
  languageCode: string;
  lessonType?: 'text' | 'subtitle' | 'manga';
  processingStatus: 'pending' | 'completed' | 'failed';
  imageUrl?: string;
  fileUrl?: string;
  audioUrl?: string;
  createdAt: string;
  userProgress?: {
    status: 'reading' | 'finished';
    readTillSentenceId: number;
  };
}

interface LessonListProps {
  selectedLanguage: string;
  refreshTrigger: number;
}

const LessonList: React.FC<LessonListProps> = ({
  selectedLanguage,
  refreshTrigger,
}) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<number | null>(null);
  const { axiosInstance, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const fetchLessons = async () => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = selectedLanguage
        ? `/api/lessons/language/${selectedLanguage}`
        : '/api/lessons';

      const response = await axiosInstance.get(endpoint);

      if (response.data.success) {
        setLessons(response.data.lessons || []);
      } else {
        setError(response.data.message || 'Failed to load lessons');
      }
    } catch (err) {
      console.error('Error fetching lessons:', err);
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Failed to load lessons');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchLessons();
    }
  }, [isAuthenticated, selectedLanguage, refreshTrigger]);

  // Auto-refresh for pending lessons
  useEffect(() => {
    const hasPendingLessons = lessons.some(
      lesson => lesson.processingStatus === 'pending'
    );

    if (hasPendingLessons) {
      const interval = setInterval(() => {
        fetchLessons();
      }, 10000); // Refresh every 10 seconds if there are pending lessons

      return () => clearInterval(interval);
    }

    return undefined;
  }, [lessons]);

  const handleDeleteLesson = async (lessonId: number) => {
    try {
      setDeletingLessonId(lessonId);
      const response = await axiosInstance.delete(`/api/lessons/${lessonId}`);

      if (response.data.success) {
        // Remove the deleted lesson from the list
        setLessons(lessons.filter(lesson => lesson.id !== lessonId));
      } else {
        setError(response.data.message || 'Failed to delete lesson');
      }
    } catch (err) {
      console.error('Error deleting lesson:', err);
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Failed to delete lesson');
      }
    } finally {
      setDeletingLessonId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <Text>Loading lessons...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Text color="red">{error}</Text>
        <Button onClick={fetchLessons} variant="soft" mt="2">
          Retry
        </Button>
      </Card>
    );
  }

  if (lessons.length === 0) {
    return (
      <Card>
        <Flex direction="column" align="center" gap="2" p="4">
          <Text size="3" color="gray">
            No lessons found
          </Text>
          <Text size="2" color="gray">
            {selectedLanguage
              ? `No lessons found for the selected language.`
              : 'Upload your first lesson to get started!'}
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
                      ? '✓ Ready'
                      : lesson.processingStatus === 'pending'
                        ? '⏳ Processing'
                        : '❌ Failed'}
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
                          ? '✓ Completed'
                          : '📖 In Progress'}
                      </Badge>
                    )}
                  <Text size="2" color="gray">
                    Lesson #{lesson.id}
                  </Text>
                </Flex>

                <Text size="3" weight="medium">
                  {lesson.title}
                </Text>

                <Flex direction="column" gap="2">
                  {lesson.imageUrl && (
                    <Flex align="center" gap="2">
                      <Text size="2" weight="medium">
                        Image:
                      </Text>
                      <a
                        href={lesson.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent-9)' }}
                      >
                        <Text size="2">View Image</Text>
                      </a>
                    </Flex>
                  )}

                  {lesson.fileUrl && (
                    <Flex align="center" gap="2">
                      <Text size="2" weight="medium">
                        File:
                      </Text>
                      <a
                        href={lesson.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent-9)' }}
                      >
                        <Text size="2">Download File</Text>
                      </a>
                    </Flex>
                  )}

                  {lesson.audioUrl && (
                    <Box>
                      <Text size="2" weight="medium" mb="2" as="div">
                        Audio:
                      </Text>
                      <AudioPlayer
                        audioUrl={lesson.audioUrl}
                        title={`${lesson.title} - Audio`}
                      />
                    </Box>
                  )}
                </Flex>

                <Text size="1" color="gray">
                  Created: {dayjs(lesson.createdAt).format('MM/DD/YYYY')}
                </Text>

                {lesson.processingStatus === 'pending' && (
                  <Box mt="3">
                    <Text size="2" color="orange">
                      📤 Your lesson is being processed. This may take a few
                      minutes for manga lessons with multiple pages.
                    </Text>
                  </Box>
                )}

                {lesson.processingStatus === 'failed' && (
                  <Box mt="3">
                    <Text size="2" color="red">
                      ⚠️ Processing failed. Please try uploading your lesson
                      again or contact support if the issue persists.
                    </Text>
                  </Box>
                )}

                <Flex gap="2" mt="3">
                  <Button
                    variant="soft"
                    size="2"
                    disabled={lesson.processingStatus !== 'completed'}
                    onClick={() => navigate(`/lessons/${lesson.id}`)}
                  >
                    <EyeOpenIcon />
                    View Lesson
                  </Button>
                  {lesson.lessonType === 'subtitle' && (
                    <Button
                      variant="soft"
                      size="2"
                      disabled={lesson.processingStatus !== 'completed'}
                      onClick={() => navigate(`/lessons/${lesson.id}/video`)}
                    >
                      <VideoIcon />
                      View Lesson with Video
                    </Button>
                  )}
                </Flex>
              </Flex>

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
                  <Dialog.Title>Delete Lesson</Dialog.Title>
                  <Dialog.Description size="2" mb="4">
                    Are you sure you want to delete this lesson? This action
                    cannot be undone.
                  </Dialog.Description>

                  <Flex gap="3" mt="4" justify="end">
                    <Dialog.Close>
                      <Button variant="soft" color="gray">
                        Cancel
                      </Button>
                    </Dialog.Close>
                    <Dialog.Close>
                      <Button
                        variant="solid"
                        color="red"
                        onClick={() => handleDeleteLesson(lesson.id)}
                        disabled={deletingLessonId === lesson.id}
                      >
                        {deletingLessonId === lesson.id
                          ? 'Deleting...'
                          : 'Delete'}
                      </Button>
                    </Dialog.Close>
                  </Flex>
                </Dialog.Content>
              </Dialog.Root>
            </Flex>
          </Card>
        ))}
      </Flex>
    </Box>
  );
};

export default LessonList;
