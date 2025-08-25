import React, { useState } from 'react';
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

interface LessonUploadProps {
  selectedLanguage: string;
  onLessonUploaded: () => void;
}

const LessonUpload: React.FC<LessonUploadProps> = ({
  selectedLanguage,
  onLessonUploaded,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [languageCode, setLanguageCode] = useState(
    selectedLanguage !== 'all' ? selectedLanguage : 'ja'
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { axiosInstance } = useAuth();

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

    if (!imageFile && !lessonFile) {
      setError('Please select at least one file to upload');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      let imageKey: string | undefined;
      let fileKey: string | undefined;

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

      // Upload lesson file to S3 if provided
      if (lessonFile) {
        try {
          fileKey = await uploadFileToS3(lessonFile);
        } catch (error) {
          throw new Error(
            `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Step 3: Create lesson record with S3 keys
      const response = await axiosInstance.post('/api/lessons', {
        title: title.trim(),
        languageCode,
        imageKey,
        fileKey,
      });

      if (response.data.success) {
        setSuccess('Lesson uploaded successfully!');
        setTitle('');
        setImageFile(null);
        setLessonFile(null);

        // Reset file inputs
        const imageInput = document.getElementById(
          'image-upload'
        ) as HTMLInputElement;
        const fileInput = document.getElementById(
          'file-upload'
        ) as HTMLInputElement;
        if (imageInput) imageInput.value = '';
        if (fileInput) fileInput.value = '';

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
                  <Select.Item value="ja">🇯🇵 Japanese</Select.Item>
                  <Select.Item value="ko">🇰🇷 Korean</Select.Item>
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
              Lesson File (Optional) - Text or Subtitle files only
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
            <Button
              onClick={handleUpload}
              disabled={uploading || (!imageFile && !lessonFile)}
            >
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
