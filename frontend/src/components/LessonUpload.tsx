import React, { useState } from 'react';
import { Card, Text, Flex, Dialog, Box, Tabs } from '@radix-ui/themes';
import MyButton from './MyButton';
import { PlusIcon, UploadIcon, UpdateIcon } from '@radix-ui/react-icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface LessonUploadProps {
  onLessonUploaded: () => void;
}

const LessonUpload: React.FC<LessonUploadProps> = ({ onLessonUploaded }) => {
  const { selectedLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('text');

  // CSS for spinning animation
  const spinningIconStyle: React.CSSProperties = {
    animation: 'spin 1s linear infinite',
  };

  // Text/SRT upload states
  const [title, setTitle] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Manga upload states
  const [mangaTitle, setMangaTitle] = useState('');
  const [mangaImage, setMangaImage] = useState<File | null>(null);
  const [mangaFiles, setMangaFiles] = useState<File[]>([]);

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

  const handleMangaImageChange = (
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
      setMangaImage(file);
      setError(null);
    }
  };

  const handleMangaFilesChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate each file
    const validFiles: File[] = [];
    for (const file of files) {
      const fileType = getFileType(file);
      if (fileType !== 'image/jpeg') {
        setError('Please select only JPG files for manga pages');
        return;
      }
      // Validate file size (max 10MB per file)
      if (file.size > 10 * 1024 * 1024) {
        setError(`File ${file.name} must be smaller than 10MB`);
        return;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 500) {
      setError('Maximum 500 manga pages allowed');
      return;
    }

    setMangaFiles(validFiles);
    setError(null);
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

  const handleMangaUpload = async () => {
    if (!mangaTitle.trim()) {
      setError('Please enter a manga lesson title');
      return;
    }

    if (!selectedLanguage) {
      setError('Please select a language');
      return;
    }

    if (mangaFiles.length === 0) {
      setError('Please select at least one manga page (JPG files)');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      let imageKey: string | undefined;
      const fileKeys: string[] = [];

      // Upload manga lesson image to S3 if provided
      if (mangaImage) {
        try {
          imageKey = await uploadFileToS3(mangaImage);
        } catch (error) {
          throw new Error(
            `Failed to upload lesson image: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Upload all manga page files to S3
      for (const file of mangaFiles) {
        try {
          const fileKey = await uploadFileToS3(file);
          fileKeys.push(fileKey);
        } catch (error) {
          throw new Error(
            `Failed to upload manga page ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Create manga lesson record with S3 keys
      const response = await axiosInstance.post('/api/lessons/manga', {
        title: mangaTitle.trim(),
        languageCode: selectedLanguage,
        imageKey,
        mangaPageKeys: fileKeys,
      });

      if (response.data.success) {
        setSuccess('Manga lesson uploaded and processed successfully!');
        setMangaTitle('');
        setMangaImage(null);
        setMangaFiles([]);

        // Reset file inputs
        const imageInput = document.getElementById(
          'manga-image-upload'
        ) as HTMLInputElement;
        const filesInput = document.getElementById(
          'manga-files-upload'
        ) as HTMLInputElement;
        if (imageInput) imageInput.value = '';
        if (filesInput) filesInput.value = '';

        // Notify parent component to refresh lesson list
        onLessonUploaded();

        // Close dialog after a short delay
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(null);
        }, 2000);
      } else {
        setError(response.data.message || 'Failed to create manga lesson');
      }
    } catch (err) {
      console.error('Manga upload error:', err);
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

  const handleUpload = async () => {
    if (!title.trim()) {
      setError('Please enter a lesson title');
      return;
    }

    if (!selectedLanguage) {
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
        languageCode: selectedLanguage,
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
    <>
      {/* CSS keyframes for spinning animation */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Trigger>
          <MyButton>
            <PlusIcon />
            Upload New Lesson
          </MyButton>
        </Dialog.Trigger>
        <Dialog.Content style={{ maxWidth: 600 }}>
          <Dialog.Title>Upload New Lesson</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Upload lesson files for language learning - text/subtitle files or
            manga pages.
          </Dialog.Description>

          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Trigger value="text">Text / SRT Upload</Tabs.Trigger>
              <Tabs.Trigger value="manga">Manga Upload</Tabs.Trigger>
            </Tabs.List>

            <Box pt="4">
              {/* Text/SRT Upload Tab */}
              <Tabs.Content value="text">
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
                </Flex>
              </Tabs.Content>

              {/* Manga Upload Tab */}
              <Tabs.Content value="manga">
                <Flex direction="column" gap="4">
                  {/* Manga Title Input */}
                  <Box>
                    <Text size="2" weight="medium" mb="2" as="div">
                      Manga Lesson Title *
                    </Text>
                    <input
                      type="text"
                      value={mangaTitle}
                      onChange={e => setMangaTitle(e.target.value)}
                      placeholder="Enter manga lesson title..."
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid var(--gray-7)',
                        borderRadius: '4px',
                        fontSize: '14px',
                      }}
                    />
                  </Box>

                  {/* Manga Lesson Image Upload */}
                  <Box>
                    <Text size="2" weight="medium" mb="2" as="div">
                      Lesson Cover Image (Optional)
                    </Text>
                    <input
                      id="manga-image-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                      onChange={handleMangaImageChange}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid var(--gray-7)',
                        borderRadius: '4px',
                        fontSize: '14px',
                      }}
                    />
                    {mangaImage && (
                      <Text size="1" color="green" mt="1">
                        Selected: {mangaImage.name}
                      </Text>
                    )}
                  </Box>

                  {/* Manga Pages Upload */}
                  <Box>
                    <Text size="2" weight="medium" mb="2" as="div">
                      Manga Pages (Required) - JPG Only
                    </Text>
                    <input
                      id="manga-files-upload"
                      type="file"
                      accept="image/jpeg,.jpg"
                      multiple
                      onChange={handleMangaFilesChange}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid var(--gray-7)',
                        borderRadius: '4px',
                        fontSize: '14px',
                      }}
                    />
                    {mangaFiles.length > 0 && (
                      <Text size="1" color="green" mt="1">
                        Selected: {mangaFiles.length} files
                      </Text>
                    )}
                    <Text size="1" color="gray" mt="1">
                      Pages will be processed using OCR to extract text for
                      learning
                    </Text>
                  </Box>
                </Flex>
              </Tabs.Content>
            </Box>

            {/* Error Message */}
            {error && (
              <Card
                variant="surface"
                style={{
                  backgroundColor: 'var(--red-2)',
                  borderColor: 'var(--red-7)',
                  marginTop: '16px',
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
                  marginTop: '16px',
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
                <MyButton variant="soft" color="gray" disabled={uploading}>
                  Cancel
                </MyButton>
              </Dialog.Close>
              {activeTab === 'text' ? (
                <MyButton
                  onClick={handleUpload}
                  disabled={uploading || !lessonFile}
                >
                  {uploading ? (
                    <>
                      <UpdateIcon style={spinningIconStyle} />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <UploadIcon />
                      Upload Lesson
                    </>
                  )}
                </MyButton>
              ) : (
                <MyButton
                  onClick={handleMangaUpload}
                  disabled={uploading || mangaFiles.length === 0}
                >
                  {uploading ? (
                    <>
                      <UpdateIcon style={spinningIconStyle} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <UploadIcon />
                      Upload Manga
                    </>
                  )}
                </MyButton>
              )}
            </Flex>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
};

export default LessonUpload;
