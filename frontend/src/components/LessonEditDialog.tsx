import React, { useState, useEffect } from 'react';
import { Card, Text, Flex, Dialog, Box } from '@radix-ui/themes';
import MyButton from './MyButton';
import { Pencil1Icon, UploadIcon } from '@radix-ui/react-icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n';

interface Lesson {
  id: number;
  title: string;
  languageCode: string;
  imageUrl?: string;
  fileUrl?: string;
  audioUrl?: string;
  createdAt: string;
}

interface LessonEditDialogProps {
  lesson: Lesson;
  onLessonUpdated: (updatedLesson?: Partial<Lesson>) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const LessonEditDialog: React.FC<LessonEditDialogProps> = ({
  lesson,
  onLessonUpdated,
  trigger,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}) => {
  const { t } = useI18n();
  const [internalOpen, setInternalOpen] = useState(false);

  // Use external control if provided, otherwise use internal state
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen =
    externalOnOpenChange !== undefined ? externalOnOpenChange : setInternalOpen;
  const [updating, setUpdating] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { axiosInstance } = useAuth();

  // Reset form when lesson changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      setTitle(lesson.title);
      setImageFile(null);
      setAudioFile(null);
      setError(null);
      setSuccess(null);

      // Reset file inputs
      const imageInput = document.getElementById(
        `image-edit-${lesson.id}`
      ) as HTMLInputElement;
      const audioInput = document.getElementById(
        `audio-edit-${lesson.id}`
      ) as HTMLInputElement;
      if (imageInput) imageInput.value = '';
      if (audioInput) audioInput.value = '';
    }
  }, [isOpen, lesson]);

  const getFileType = (file: File): string => {
    // If the browser provided a MIME type, use it
    if (file.type) {
      return file.type;
    }

    // Otherwise, infer from file extension using a simple mapping
    const fileName = file.name.toLowerCase();
    const extensionMap: Record<string, string> = {
      '.txt': 'text/plain',
      '.srt': 'application/x-subrip',
      '.ass': 'text/x-ass',
      '.ssa': 'text/x-ass',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.aac': 'audio/aac',
    };

    for (const [ext, mimeType] of Object.entries(extensionMap)) {
      if (fileName.endsWith(ext)) {
        return mimeType;
      }
    }

    // Default fallback
    return 'application/octet-stream';
  };

  const handleImageFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type using our helper function
      const fileType = getFileType(file);
      const validImageTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
      ];
      if (!validImageTypes.includes(fileType)) {
        setError(t('upload.invalidImage'));
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(t('upload.imageTooBig'));
        return;
      }
      setImageFile(file);
      setError(null);
    }
  };

  const handleAudioFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type using our helper function
      const fileType = getFileType(file);
      const validAudioTypes = [
        'audio/mpeg', // .mp3 files
        'audio/ogg', // .ogg files
        'audio/aac', // .aac files
      ];

      if (!validAudioTypes.includes(fileType)) {
        setError(t('upload.invalidAudio'));
        return;
      }

      // 50MB limit for audio files
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        setError(t('upload.audioTooBig'));
        return;
      }

      setAudioFile(file);
      setError(null);
    }
  };

  const uploadFileToS3 = async (file: File): Promise<string> => {
    // Step 1: Get upload URL from backend
    const fileType = getFileType(file);

    const uploadUrlResponse = await axiosInstance.post('/api/s3/upload-file', {
      fileName: file.name,
      fileType: fileType,
    });

    if (!uploadUrlResponse.data.success) {
      throw new Error(t('edit.uploadUrlFailed'));
    }

    const { uploadUrl, key } = uploadUrlResponse.data;

    // Step 2: Upload file directly to S3
    // IMPORTANT: Use the same fileType that we sent to the backend
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': fileType,
      },
    });

    return key;
  };

  const handleUpdate = async () => {
    if (!title.trim()) {
      setError(t('edit.titleRequired'));
      return;
    }

    try {
      setUpdating(true);
      setError(null);
      setSuccess(null);

      let imageKey: string | undefined;
      let audioKey: string | undefined;

      // Upload image to S3 if provided
      if (imageFile) {
        try {
          imageKey = await uploadFileToS3(imageFile);
        } catch (error) {
          const message = axios.isAxiosError(error)
            ? t('common.unknownError')
            : error instanceof Error
              ? error.message
              : t('common.unknownError');
          setError(t('edit.imageUploadFailed', { message }));
          return;
        }
      }

      // Upload audio file to S3 if provided
      if (audioFile) {
        try {
          audioKey = await uploadFileToS3(audioFile);
        } catch (error) {
          const message = axios.isAxiosError(error)
            ? t('common.unknownError')
            : error instanceof Error
              ? error.message
              : t('common.unknownError');
          setError(t('edit.audioUploadFailed', { message }));
          return;
        }
      }

      // Step 3: Update lesson record with new data
      const response = await axiosInstance.put(`/api/lessons/${lesson.id}`, {
        title: title.trim(),
        imageKey,
        audioKey,
      });

      if (response.data.success) {
        setSuccess(t('edit.success'));

        // Notify parent component with updated lesson data
        onLessonUpdated({
          title: title.trim(),
          ...(imageKey && { imageUrl: imageKey }),
          ...(audioKey && { audioUrl: audioKey }),
        });

        // Close dialog after a short delay
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(null);
        }, 1500);
      } else {
        setError(t('edit.failed'));
      }
    } catch (err) {
      console.error('Update error:', err);
      setError(t('edit.failedRetry'));
    } finally {
      setUpdating(false);
    }
  };

  const defaultTrigger = (
    <MyButton variant="soft" size="2">
      <Pencil1Icon />
      {t('common.edit')}
    </MyButton>
  );

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      {trigger !== null && (
        <Dialog.Trigger>{trigger || defaultTrigger}</Dialog.Trigger>
      )}
      <Dialog.Content style={{ maxWidth: 500 }}>
        <Dialog.Title>{t('edit.title')}</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          {t('edit.description')}
        </Dialog.Description>

        <Flex direction="column" gap="4">
          {/* Title Input */}
          <Box>
            <Text size="2" weight="medium" mb="2" as="div">
              {t('edit.lessonTitle')}
            </Text>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('edit.titlePlaceholder')}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--gray-7)',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </Box>

          {/* Current Files Info */}
          <Box>
            <Text size="2" weight="medium" mb="2" as="div">
              {t('edit.currentFiles')}
            </Text>
            <Flex direction="column" gap="1">
              {lesson.imageUrl && (
                <Text size="1" color="gray">
                  {t('edit.hasImage')}
                </Text>
              )}
              {lesson.audioUrl && (
                <Text size="1" color="gray">
                  {t('edit.hasAudio')}
                </Text>
              )}
              {!lesson.imageUrl && !lesson.audioUrl && (
                <Text size="1" color="gray">
                  {t('edit.noFiles')}
                </Text>
              )}
            </Flex>
          </Box>

          {/* Image Upload */}
          <Box>
            <Text size="2" weight="medium" mb="2" as="div">
              {lesson.imageUrl ? t('edit.replaceImage') : t('edit.addImage')}
            </Text>
            <input
              id={`image-edit-${lesson.id}`}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
              onChange={handleImageFileChange}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--gray-7)',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
            {imageFile && (
              <Text size="1" color="green" mt="1">
                {t('common.selectedFile', { name: imageFile.name })}
              </Text>
            )}
          </Box>

          {/* Audio File Upload */}
          <Box>
            <Text size="2" weight="medium" mb="2" as="div">
              {lesson.audioUrl ? t('edit.replaceAudio') : t('edit.addAudio')}
            </Text>
            <input
              id={`audio-edit-${lesson.id}`}
              type="file"
              accept=".mp3,.ogg,.aac,audio/mpeg,audio/ogg,audio/aac"
              onChange={handleAudioFileChange}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--gray-7)',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
            {audioFile && (
              <Text size="1" color="green" mt="1">
                {t('common.selectedFile', { name: audioFile.name })}
              </Text>
            )}
          </Box>

          {/* Error Message */}
          {error && (
            <Card
              variant="surface"
              style={{
                backgroundColor: 'var(--red-2)',
                borderColor: 'var(--red-7)',
              }}
            >
              <Text size="2" color="red">
                {error}
              </Text>
            </Card>
          )}

          {/* Success Message */}
          {success && (
            <Card
              variant="surface"
              style={{
                backgroundColor: 'var(--green-2)',
                borderColor: 'var(--green-7)',
              }}
            >
              <Text size="2" color="green">
                {success}
              </Text>
            </Card>
          )}

          {/* Action Buttons */}
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <MyButton variant="soft" color="gray" disabled={updating}>
                {t('common.cancel')}
              </MyButton>
            </Dialog.Close>
            <MyButton onClick={handleUpdate} disabled={updating}>
              {updating ? (
                <>
                  <UploadIcon />
                  {t('edit.updating')}
                </>
              ) : (
                <>
                  <Pencil1Icon />
                  {t('edit.update')}
                </>
              )}
            </MyButton>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default LessonEditDialog;
