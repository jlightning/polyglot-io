import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Text, Flex, Dialog, Box, Tabs, Select } from '@radix-ui/themes';
import MyButton from './MyButton';
import { PlusIcon, UploadIcon, UpdateIcon } from '@radix-ui/react-icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useI18n } from '../i18n';

interface LessonUploadProps {
  onLessonUploaded: () => void;
}

const LessonUpload: React.FC<LessonUploadProps> = ({ onLessonUploaded }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
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
  const [lessonPastedText, setLessonPastedText] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Manual lesson (add sentence manually) states – title only, no files
  const [manualTitle, setManualTitle] = useState('');

  // Generate lesson with AI states
  const [aiGenerateTitle, setAiGenerateTitle] = useState('');
  const [aiGeneratePrompt, setAiGeneratePrompt] = useState('');
  const [aiGenerateDifficulty, setAiGenerateDifficulty] =
    useState<string>('Intermediate');

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
        'text/x-ass', // .ass and .ssa files
      ];

      if (!validFileTypes.includes(fileType)) {
        setError(t('upload.invalidText'));
        return;
      }

      // 5MB limit for lesson files
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        setError(t('upload.textTooBig'));
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
        setError(t('upload.invalidImage'));
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(t('upload.imageTooBig'));
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
      const validImageTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
      ];
      if (!validImageTypes.includes(fileType)) {
        setError(t('upload.invalidManga'));
        return;
      }
      // Validate file size (max 10MB per file)
      if (file.size > 10 * 1024 * 1024) {
        setError(t('upload.pageTooBig', { name: file.name }));
        return;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 500) {
      setError(t('upload.tooManyPages'));
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
      throw new Error(t('upload.uploadUrlFailed'));
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
      setError(t('upload.mangaTitleRequired'));
      return;
    }

    if (!selectedLanguage) {
      setError(t('upload.languageRequired'));
      return;
    }

    if (mangaFiles.length === 0) {
      setError(t('upload.pagesRequired'));
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
          const message = axios.isAxiosError(error)
            ? t('common.unknownError')
            : error instanceof Error
              ? error.message
              : t('common.unknownError');
          setError(t('upload.imageUploadFailed', { message }));
          return;
        }
      }

      // Upload all manga page files to S3
      for (const file of mangaFiles) {
        try {
          const fileKey = await uploadFileToS3(file);
          fileKeys.push(fileKey);
        } catch (error) {
          const message = axios.isAxiosError(error)
            ? t('common.unknownError')
            : error instanceof Error
              ? error.message
              : t('common.unknownError');
          setError(t('upload.pageUploadFailed', { name: file.name, message }));
          return;
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
        setSuccess(t('upload.mangaSuccess'));
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
        setError(t('upload.mangaCreateFailed'));
      }
    } catch (err) {
      console.error('Manga upload error:', err);
      setError(t('upload.failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleManualUpload = async () => {
    if (!manualTitle.trim()) {
      setError(t('upload.titleRequired'));
      return;
    }

    if (!selectedLanguage) {
      setError(t('upload.languageRequired'));
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const response = await axiosInstance.post('/api/lessons/manual', {
        title: manualTitle.trim(),
        languageCode: selectedLanguage,
      });

      if (response.data.success && response.data.lesson) {
        setSuccess(t('upload.manualSuccess'));
        setManualTitle('');

        onLessonUploaded();

        setTimeout(() => {
          setIsOpen(false);
          setSuccess(null);
          navigate(`/lessons/${response.data.lesson.id}`);
        }, 1500);
      } else {
        setError(t('upload.createFailed'));
      }
    } catch (err) {
      console.error('Manual lesson upload error:', err);
      setError(t('upload.failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleAiGenerateLesson = async () => {
    if (!aiGenerateTitle.trim()) {
      setError(t('upload.titleRequired'));
      return;
    }
    if (!aiGeneratePrompt.trim()) {
      setError(t('upload.promptRequired'));
      return;
    }
    if (!selectedLanguage) {
      setError(t('upload.languageRequired'));
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const response = await axiosInstance.post('/api/lessons/generate', {
        title: aiGenerateTitle.trim(),
        languageCode: selectedLanguage,
        prompt: aiGeneratePrompt.trim(),
        difficulty: aiGenerateDifficulty,
      });

      if (response.data.success && response.data.lesson) {
        setSuccess(t('upload.aiSuccess'));
        setAiGenerateTitle('');
        setAiGeneratePrompt('');
        onLessonUploaded();
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(null);
          navigate(`/lessons/${response.data.lesson.id}`);
        }, 1500);
      } else {
        setError(t('upload.generateFailed'));
      }
    } catch (err) {
      console.error('AI generate lesson error:', err);
      setError(t('upload.generateFailedRetry'));
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!title.trim()) {
      setError(t('upload.titleRequired'));
      return;
    }

    if (!selectedLanguage) {
      setError(t('upload.languageRequired'));
      return;
    }

    const hasPastedText = lessonPastedText.trim().length > 0;
    if (!lessonFile && !hasPastedText) {
      setError(t('upload.fileOrTextRequired'));
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
          const message = axios.isAxiosError(error)
            ? t('common.unknownError')
            : error instanceof Error
              ? error.message
              : t('common.unknownError');
          setError(t('edit.imageUploadFailed', { message }));
          return;
        }
      }

      // Upload lesson file to S3 (required): use file if selected, else create from pasted text
      const fileToUpload =
        lessonFile ||
        (hasPastedText
          ? new File([lessonPastedText.trim()], 'pasted-lesson.txt', {
              type: 'text/plain',
            })
          : null);
      if (fileToUpload) {
        try {
          fileKey = await uploadFileToS3(fileToUpload);
        } catch (error) {
          const message = axios.isAxiosError(error)
            ? t('common.unknownError')
            : error instanceof Error
              ? error.message
              : t('common.unknownError');
          setError(t('upload.fileUploadFailed', { message }));
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
          setError(t('upload.audioUploadFailed', { message }));
          return;
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
        setSuccess(t('upload.success'));
        setTitle('');
        setImageFile(null);
        setLessonFile(null);
        setLessonPastedText('');
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
        setError(t('upload.createFailed'));
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(t('upload.failed'));
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
            {t('upload.create')}
          </MyButton>
        </Dialog.Trigger>
        <Dialog.Content style={{ maxWidth: 720 }}>
          <Dialog.Title>{t('upload.title')}</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            {t('upload.description')}
          </Dialog.Description>

          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Trigger value="text">{t('upload.tabText')}</Tabs.Trigger>
              <Tabs.Trigger value="manual">
                {t('upload.tabManual')}
              </Tabs.Trigger>
              <Tabs.Trigger value="ai-generate">
                {t('upload.tabAi')}
              </Tabs.Trigger>
              <Tabs.Trigger value="manga">{t('upload.tabManga')}</Tabs.Trigger>
            </Tabs.List>

            <Box pt="4">
              {/* Text/SRT Upload Tab */}
              <Tabs.Content value="text">
                <Flex direction="column" gap="4">
                  {/* Title Input */}
                  <Box>
                    <Text size="2" weight="medium" mb="2" as="div">
                      {t('upload.lessonTitle')}
                    </Text>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder={t('upload.titlePlaceholder')}
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
                      {t('upload.imageOptional')}
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
                        {t('common.selectedFile', { name: imageFile.name })}
                      </Text>
                    )}
                  </Box>

                  {/* Lesson File Upload */}
                  <Box>
                    <Text size="2" weight="medium" mb="2" as="div">
                      {t('upload.lessonFile')}
                    </Text>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".txt,.srt,.ass,.ssa"
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
                        {t('common.selectedFile', { name: lessonFile.name })}
                      </Text>
                    )}
                  </Box>

                  {/* Paste text alternative */}
                  <Box>
                    <Text size="2" weight="medium" mb="2" as="div">
                      {t('upload.orPaste')}
                    </Text>
                    <Text size="1" color="gray" mb="2" as="div">
                      {t('upload.youtubeHint')}
                    </Text>
                    <textarea
                      value={lessonPastedText}
                      onChange={e => setLessonPastedText(e.target.value)}
                      placeholder={t('upload.pastePlaceholder')}
                      rows={6}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid var(--gray-7)',
                        borderRadius: '4px',
                        fontSize: '14px',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                  </Box>

                  {/* Audio File Upload */}
                  <Box>
                    <Text size="2" weight="medium" mb="2" as="div">
                      {t('upload.audioOptional')}
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
                        {t('common.selectedFile', { name: audioFile.name })}
                      </Text>
                    )}
                  </Box>
                </Flex>
              </Tabs.Content>

              {/* Manual Lesson Tab */}
              <Tabs.Content value="manual">
                <Flex direction="column" gap="4">
                  <Box>
                    <Text size="2" weight="medium" mb="2" as="div">
                      {t('upload.lessonTitle')}
                    </Text>
                    <input
                      type="text"
                      value={manualTitle}
                      onChange={e => setManualTitle(e.target.value)}
                      placeholder={t('upload.titlePlaceholder')}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid var(--gray-7)',
                        borderRadius: '4px',
                        fontSize: '14px',
                      }}
                    />
                  </Box>
                  <Text size="1" color="gray">
                    {t('upload.manualHint')}
                  </Text>
                </Flex>
              </Tabs.Content>

              {/* Generate Lesson with AI Tab */}
              <Tabs.Content value="ai-generate">
                <Flex direction="column" gap="4">
                  <Box>
                    <Text size="2" weight="medium" mb="2" as="div">
                      {t('upload.lessonTitle')}
                    </Text>
                    <input
                      type="text"
                      value={aiGenerateTitle}
                      onChange={e => setAiGenerateTitle(e.target.value)}
                      placeholder={t('upload.titlePlaceholder')}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid var(--gray-7)',
                        borderRadius: '4px',
                        fontSize: '14px',
                      }}
                    />
                  </Box>
                  <Box>
                    <Text size="2" weight="medium" mb="2" as="div">
                      {t('upload.difficulty')}
                    </Text>
                    <Select.Root
                      value={aiGenerateDifficulty}
                      onValueChange={setAiGenerateDifficulty}
                    >
                      <Select.Trigger
                        style={{ width: '100%' }}
                        placeholder={t('upload.selectDifficulty')}
                      />
                      <Select.Content>
                        <Select.Item value="Beginner">
                          {t('upload.beginner')}
                        </Select.Item>
                        <Select.Item value="Easy">
                          {t('upload.easy')}
                        </Select.Item>
                        <Select.Item value="Intermediate">
                          {t('upload.intermediate')}
                        </Select.Item>
                        <Select.Item value="Advanced">
                          {t('upload.advanced')}
                        </Select.Item>
                        <Select.Item value="Native">
                          {t('upload.native')}
                        </Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Box>
                  <Box>
                    <Text size="2" weight="medium" mb="2" as="div">
                      {t('upload.prompt')}
                    </Text>
                    <textarea
                      value={aiGeneratePrompt}
                      onChange={e => setAiGeneratePrompt(e.target.value)}
                      placeholder={t('upload.promptPlaceholder')}
                      rows={4}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid var(--gray-7)',
                        borderRadius: '4px',
                        fontSize: '14px',
                        resize: 'vertical',
                      }}
                    />
                    <Text size="1" color="gray" mt="1">
                      {t('upload.aiHint')}
                    </Text>
                  </Box>
                </Flex>
              </Tabs.Content>

              {/* Manga Upload Tab */}
              <Tabs.Content value="manga">
                <Flex direction="column" gap="4">
                  {/* Manga Title Input */}
                  <Box>
                    <Text size="2" weight="medium" mb="2" as="div">
                      {t('upload.mangaTitle')}
                    </Text>
                    <input
                      type="text"
                      value={mangaTitle}
                      onChange={e => setMangaTitle(e.target.value)}
                      placeholder={t('upload.mangaTitlePlaceholder')}
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
                      {t('upload.cover')}
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
                        {t('common.selectedFile', { name: mangaImage.name })}
                      </Text>
                    )}
                  </Box>

                  {/* Manga Pages Upload */}
                  <Box>
                    <Text size="2" weight="medium" mb="2" as="div">
                      {t('upload.mangaPages')}
                    </Text>
                    <input
                      id="manga-files-upload"
                      type="file"
                      accept="image/jpeg,.jpg,image/png,.png,image/gif,.gif,image/webp,.webp"
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
                        {t('common.selectedFiles', {
                          count: mangaFiles.length,
                        })}
                      </Text>
                    )}
                    <Text size="1" color="gray" mt="1">
                      {t('upload.ocrHint')}
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
                  {t('common.cancel')}
                </MyButton>
              </Dialog.Close>
              {activeTab === 'text' ? (
                <MyButton
                  onClick={handleUpload}
                  disabled={
                    uploading || (!lessonFile && !lessonPastedText.trim())
                  }
                >
                  {uploading ? (
                    <>
                      <UpdateIcon style={spinningIconStyle} />
                      {t('upload.uploading')}
                    </>
                  ) : (
                    <>
                      <UploadIcon />
                      {t('upload.uploadLesson')}
                    </>
                  )}
                </MyButton>
              ) : activeTab === 'manual' ? (
                <MyButton
                  onClick={handleManualUpload}
                  disabled={uploading || !manualTitle.trim()}
                >
                  {uploading ? (
                    <>
                      <UpdateIcon style={spinningIconStyle} />
                      {t('upload.creating')}
                    </>
                  ) : (
                    <>
                      <UploadIcon />
                      {t('upload.createLesson')}
                    </>
                  )}
                </MyButton>
              ) : activeTab === 'ai-generate' ? (
                <MyButton
                  onClick={handleAiGenerateLesson}
                  disabled={
                    uploading ||
                    !aiGenerateTitle.trim() ||
                    !aiGeneratePrompt.trim()
                  }
                >
                  {uploading ? (
                    <>
                      <UpdateIcon style={spinningIconStyle} />
                      {t('upload.generating')}
                    </>
                  ) : (
                    <>
                      <UploadIcon />
                      {t('upload.generate')}
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
                      {t('upload.processing')}
                    </>
                  ) : (
                    <>
                      <UploadIcon />
                      {t('upload.uploadManga')}
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
