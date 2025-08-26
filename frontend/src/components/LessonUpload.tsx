import React, { useState, useEffect } from 'react';
import {
  Card,
  Text,
  Flex,
  Button,
  Dialog,
  Select,
  Box,
} from '@radix-ui/themes';
import { PlusIcon, UploadIcon } from '@radix-ui/react-icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface LessonUploadProps {
  onLessonUploaded: () => void;
}

const LessonUpload: React.FC<LessonUploadProps> = ({ onLessonUploaded }) => {
  const { selectedLanguage, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [languageCode, setLanguageCode] = useState(
    selectedLanguage !== 'all'
      ? selectedLanguage
      : languages.length > 0
        ? languages[0]?.code || 'ja'
        : 'ja'
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { axiosInstance } = useAuth();

  // Update languageCode when selectedLanguage changes
  useEffect(() => {
    if (selectedLanguage !== 'all') {
      setLanguageCode(selectedLanguage);
    } else if (languages.length > 0 && languages[0]) {
      setLanguageCode(languages[0].code);
    }
  }, [selectedLanguage, languages]);

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
        setError(
          'Please select a valid image file (JPEG, PNG, GIF, WebP, or SVG)'
        );
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image file must be smaller than 10MB');
        return;
      }
      setImageFile(file);
      setError(null);
    }
  };

  const handleLessonFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type using our helper function
      const fileType = getFileType(file);
      const validFileTypes = [
        'text/plain', // .txt files
        'application/x-subrip', // .srt files
      ];

      if (!validFileTypes.includes(fileType)) {
        setError(
          'Please select a text file (.txt) or subtitle file (.srt) only'
        );
        return;
      }

      // 5MB limit for lesson files
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        setError('Lesson file must be smaller than 5MB');
        return;
      }

      setLessonFile(file);
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
        setError('Please select a valid audio file (MP3, OGG, or AAC)');
        return;
      }

      // 50MB limit for audio files
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        setError('Audio file must be smaller than 50MB');
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
      throw new Error(
        uploadUrlResponse.data.message || 'Failed to get upload URL'
      );
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

  const handleUpload = async () => {
    if (!title.trim()) {
      setError('Please enter a lesson title');
      return;
    }

    if (!languageCode) {
      setError('Please select a language');
      return;
    }

    if (!lessonFile) {
      setError('Please select a lesson file (required)');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      let imageKey: string | undefined;
      let fileKey: string | undefined;
      let audioKey: string | undefined;

      // Upload image to S3 if provided
      if (imageFile) {
        try {
          imageKey = await uploadFileToS3(imageFile);
        } catch (error) {
          throw new Error(
            `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Upload lesson file to S3 (required)
      if (lessonFile) {
        try {
          fileKey = await uploadFileToS3(lessonFile);
        } catch (error) {
          throw new Error(
            `Failed to upload lesson file: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Upload audio file to S3 if provided
      if (audioFile) {
        try {
          audioKey = await uploadFileToS3(audioFile);
        } catch (error) {
          throw new Error(
            `Failed to upload audio: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Step 3: Create lesson record with S3 keys
      const response = await axiosInstance.post('/api/lessons', {
        title: title.trim(),
        languageCode,
        imageKey,
        fileKey,
        audioKey,
      });

      if (response.data.success) {
        setSuccess('Lesson uploaded successfully!');
        setTitle('');
        setImageFile(null);
        setLessonFile(null);
        setAudioFile(null);

        // Reset file inputs
        const imageInput = document.getElementById(
          'image-upload'
        ) as HTMLInputElement;
        const fileInput = document.getElementById(
          'file-upload'
        ) as HTMLInputElement;
        const audioInput = document.getElementById(
          'audio-upload'
        ) as HTMLInputElement;
        if (imageInput) imageInput.value = '';
        if (fileInput) fileInput.value = '';
        if (audioInput) audioInput.value = '';

        // Notify parent component to refresh lesson list
        onLessonUploaded();

        // Close dialog after a short delay
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(null);
        }, 1500);
      } else {
        setError(response.data.message || 'Failed to create lesson');
      }
    } catch (err) {
      console.error('Upload error:', err);
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Upload failed. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger>
        <Button>
          <PlusIcon />
          Upload New Lesson
        </Button>
      </Dialog.Trigger>
      <Dialog.Content style={{ maxWidth: 500 }}>
        <Dialog.Title>Upload New Lesson</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Upload image and lesson files for language learning.
        </Dialog.Description>

        <Flex direction="column" gap="4">
          {/* Title Input */}
          <Box>
            <Text size="2" weight="medium" mb="2" as="div">
              Lesson Title *
            </Text>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter lesson title..."
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--gray-7)',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </Box>

          {/* Language Selection */}
          <Box>
            <Text size="2" weight="medium" mb="2" as="div">
              Language *
            </Text>
            <Select.Root value={languageCode} onValueChange={setLanguageCode}>
              <Select.Trigger placeholder="Select language" />
              <Select.Content>
                <Select.Group>
                  {languages.map(language => (
                    <Select.Item key={language.code} value={language.code}>
                      {language.localName &&
                      language.localName !== language.name
                        ? `${language.localName} (${language.name})`
                        : language.name}
                    </Select.Item>
                  ))}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Box>

          {/* Image Upload */}
          <Box>
            <Text size="2" weight="medium" mb="2" as="div">
              Image (Optional)
            </Text>
            <input
              id="image-upload"
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
                Selected: {imageFile.name}
              </Text>
            )}
          </Box>

          {/* Lesson File Upload */}
          <Box>
            <Text size="2" weight="medium" mb="2" as="div">
              Lesson File (Required) - Text or Subtitle files only
            </Text>
            <input
              id="file-upload"
              type="file"
              accept=".txt,.srt"
              onChange={handleLessonFileChange}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--gray-7)',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
            {lessonFile && (
              <Text size="1" color="green" mt="1">
                Selected: {lessonFile.name}
              </Text>
            )}
          </Box>

          {/* Audio File Upload */}
          <Box>
            <Text size="2" weight="medium" mb="2" as="div">
              Audio File (Optional) - MP3, OGG, or AAC files
            </Text>
            <input
              id="audio-upload"
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
                Selected: {audioFile.name}
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
              <Button variant="soft" color="gray" disabled={uploading}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button onClick={handleUpload} disabled={uploading || !lessonFile}>
              {uploading ? (
                <>
                  <UploadIcon />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadIcon />
                  Upload Lesson
                </>
              )}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default LessonUpload;
