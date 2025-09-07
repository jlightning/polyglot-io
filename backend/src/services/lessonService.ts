import { Prisma, LessonType } from '@prisma/client';
import { ConfigService } from './configService';
import { S3Service } from './s3Service';
import { TextProcessingService } from './textProcessingService';

import { prisma } from './index';

export interface CreateLessonData {
  title: string;
  languageCode: string;
  imageKey?: string;
  fileKey?: string;
  audioKey?: string;
}

export interface UpdateLessonData {
  title: string;
  imageKey?: string;
  audioKey?: string;
}

export interface LessonResponse {
  success: boolean;
  message: string;
  lesson?: {
    id: number;
    title: string;
    languageCode: string;
    imageUrl?: string;
    fileUrl?: string;
    audioUrl?: string;
    createdAt: Date;
  };
  lessons?: {
    id: number;
    title: string;
    languageCode: string;
    imageUrl?: string;
    fileUrl?: string;
    audioUrl?: string;
    createdAt: Date;
  }[];
}

export class LessonService {
  /**
   * Create a new lesson with optional URLs and process lesson file
   */
  static async createLesson(
    userId: number,
    lessonData: CreateLessonData
  ): Promise<LessonResponse> {
    try {
      // Validate language code
      if (!ConfigService.isLanguageEnabled(lessonData.languageCode)) {
        return {
          success: false,
          message: 'Language not supported or not enabled',
        };
      }

      // Determine lesson type based on file if provided
      let lessonType: LessonType = LessonType.text; // default to text

      if (lessonData.fileKey) {
        try {
          // Download file content to determine type
          const fileContent = await S3Service.getFileContent(
            lessonData.fileKey
          );
          const fileName = lessonData.fileKey.split('/').pop() || '';

          // Use TextProcessingService to detect file type
          const detectedFileType = TextProcessingService.getFileType(
            fileContent,
            fileName
          );
          lessonType =
            detectedFileType === 'srt' ? LessonType.subtitle : LessonType.text;
        } catch (error) {
          console.error(
            'Error detecting file type, defaulting to text:',
            error
          );
          lessonType = LessonType.text;
        }
      }

      // Create lesson in database
      const lesson = await prisma.lesson.create({
        data: {
          created_by: userId,
          title: lessonData.title,
          lesson_type: lessonType,
          language_code: lessonData.languageCode,
          image_s3_key: lessonData.imageKey || null,
          audio_s3_key: lessonData.audioKey || null,
        },
      });

      // Process lesson file if provided
      if (lessonData.fileKey) {
        try {
          await this.processLessonFile(lesson.id, lessonData.fileKey);
        } catch (error) {
          console.error('Error processing lesson file:', error);
          // Note: We don't fail the lesson creation if file processing fails
          // The lesson is still created, but without sentences
          console.warn(
            `Lesson ${lesson.id} created but file processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      return {
        success: true,
        message: 'Lesson created successfully',
        lesson: {
          id: lesson.id,
          title: lesson.title,
          languageCode: lesson.language_code,
          ...(lesson.image_s3_key && { imageUrl: lesson.image_s3_key }),
          ...(lesson.audio_s3_key && { audioUrl: lesson.audio_s3_key }),
          createdAt: lesson.created_at,
        },
      };
    } catch (error) {
      console.error('Create lesson error:', error);
      return {
        success: false,
        message: 'Failed to create lesson',
      };
    }
  }

  /**
   * Process a lesson file (SRT or TXT) and create sentence records
   */
  private static async processLessonFile(
    lessonId: number,
    fileKey: string
  ): Promise<void> {
    try {
      // Create lesson file record
      const lessonFile = await prisma.lessonFile.create({
        data: {
          lesson_id: lessonId,
          file_s3_key: fileKey,
        },
      });

      // Download file content from S3
      const fileContent = await S3Service.getFileContent(fileKey);

      if (!fileContent || fileContent.trim().length === 0) {
        throw new Error('File content is empty');
      }

      // Extract filename from S3 key for file type detection
      const fileName = fileKey.split('/').pop() || '';

      // Process the file content to extract sentences
      const processedSentences = TextProcessingService.processLessonFile(
        fileContent,
        fileName
      );

      if (processedSentences.length === 0) {
        throw new Error('No sentences found in the file');
      }

      // Create sentence records in database
      const sentenceData = processedSentences.map(sentence => ({
        lesson_id: lessonId,
        lesson_file_id: lessonFile.id,
        original_text: sentence.text,
        split_text: Prisma.JsonNull, // Keep null as requested using Prisma.JsonNull
        start_time: sentence.startTime ? sentence.startTime / 1000 : null, // Convert milliseconds to seconds for Decimal
        end_time: sentence.endTime ? sentence.endTime / 1000 : null, // Convert milliseconds to seconds for Decimal
      }));

      // Create sentence records in database
      await prisma.sentence.createMany({
        data: sentenceData,
      });

      console.log(
        `Successfully processed ${processedSentences.length} sentences for lesson ${lessonId}`
      );
    } catch (error) {
      console.error('Error in processLessonFile:', error);
      throw error;
    }
  }

  /**
   * Get all lessons for a user
   */
  static async getUserLessons(userId: number): Promise<LessonResponse> {
    try {
      const lessons = await prisma.lesson.findMany({
        where: {
          created_by: userId,
        },
        include: {
          lessonFiles: true,
        },
        orderBy: {
          id: 'desc', // Most recent first
        },
      });

      const lessonsWithUrls = await Promise.all(
        lessons.map(async lesson => {
          let imageUrl = lesson.image_s3_key;
          let fileUrl = null;
          let audioUrl = lesson.audio_s3_key;

          // Generate signed URLs for S3 keys
          if (lesson.image_s3_key) {
            try {
              imageUrl = await S3Service.getDownloadUrl(lesson.image_s3_key);
            } catch (error) {
              console.error('Error generating image download URL:', error);
              imageUrl = null;
            }
          }

          // Get file URL from the first lesson file if any
          if (
            lesson.lessonFiles &&
            lesson.lessonFiles.length > 0 &&
            lesson.lessonFiles[0]?.file_s3_key
          ) {
            try {
              fileUrl = await S3Service.getDownloadUrl(
                lesson.lessonFiles[0]?.file_s3_key
              );
            } catch (error) {
              console.error('Error generating file download URL:', error);
              fileUrl = null;
            }
          }

          if (lesson.audio_s3_key) {
            try {
              audioUrl = await S3Service.getDownloadUrl(lesson.audio_s3_key);
            } catch (error) {
              console.error('Error generating audio download URL:', error);
              audioUrl = null;
            }
          }

          // Get user progress for this lesson
          const progress = await prisma.userLessonProgress.findUnique({
            where: {
              user_id_lesson_id: {
                user_id: userId,
                lesson_id: lesson.id,
              },
            },
          });

          return {
            id: lesson.id,
            title: lesson.title,
            languageCode: lesson.language_code,
            ...(imageUrl && { imageUrl }),
            ...(fileUrl && { fileUrl }),
            ...(audioUrl && { audioUrl }),
            createdAt: lesson.created_at,
            ...(progress && {
              userProgress: {
                status: progress.status,
                readTillSentenceId: progress.read_till_sentence_id,
              },
            }),
          };
        })
      );

      return {
        success: true,
        message: 'Lessons retrieved successfully',
        lessons: lessonsWithUrls,
      };
    } catch (error) {
      console.error('Get user lessons error:', error);
      return {
        success: false,
        message: 'Failed to retrieve lessons',
      };
    }
  }

  /**
   * Get lessons filtered by language
   */
  static async getLessonsByLanguage(
    userId: number,
    languageCode: string
  ): Promise<LessonResponse> {
    try {
      // Validate language code
      if (!ConfigService.isLanguageEnabled(languageCode)) {
        return {
          success: false,
          message: 'Language not supported or not enabled',
        };
      }

      const lessons = await prisma.lesson.findMany({
        where: {
          created_by: userId,
          language_code: languageCode,
        },
        include: {
          lessonFiles: true,
        },
        orderBy: {
          id: 'desc',
        },
      });

      const lessonsWithUrls = await Promise.all(
        lessons.map(async lesson => {
          let imageUrl = lesson.image_s3_key;
          let fileUrl = null;
          let audioUrl = lesson.audio_s3_key;

          if (lesson.image_s3_key) {
            try {
              imageUrl = await S3Service.getDownloadUrl(lesson.image_s3_key);
            } catch (error) {
              console.error('Error generating image download URL:', error);
              imageUrl = null;
            }
          }

          // Get file URL from the first lesson file if any
          if (
            lesson.lessonFiles &&
            lesson.lessonFiles.length > 0 &&
            lesson.lessonFiles[0]?.file_s3_key
          ) {
            try {
              fileUrl = await S3Service.getDownloadUrl(
                lesson.lessonFiles[0]?.file_s3_key
              );
            } catch (error) {
              console.error('Error generating file download URL:', error);
              fileUrl = null;
            }
          }

          if (lesson.audio_s3_key) {
            try {
              audioUrl = await S3Service.getDownloadUrl(lesson.audio_s3_key);
            } catch (error) {
              console.error('Error generating audio download URL:', error);
              audioUrl = null;
            }
          }

          // Get user progress for this lesson
          const progress = await prisma.userLessonProgress.findUnique({
            where: {
              user_id_lesson_id: {
                user_id: userId,
                lesson_id: lesson.id,
              },
            },
          });

          return {
            id: lesson.id,
            title: lesson.title,
            languageCode: lesson.language_code,
            ...(imageUrl && { imageUrl }),
            ...(fileUrl && { fileUrl }),
            ...(audioUrl && { audioUrl }),
            createdAt: lesson.created_at,
            ...(progress && {
              userProgress: {
                status: progress.status,
                readTillSentenceId: progress.read_till_sentence_id,
              },
            }),
          };
        })
      );

      return {
        success: true,
        message: 'Lessons retrieved successfully',
        lessons: lessonsWithUrls,
      };
    } catch (error) {
      console.error('Get lessons by language error:', error);
      return {
        success: false,
        message: 'Failed to retrieve lessons',
      };
    }
  }

  /**
   * Update a lesson's title and optional files
   */
  static async updateLesson(
    userId: number,
    lessonId: number,
    updateData: UpdateLessonData
  ): Promise<LessonResponse> {
    try {
      // Find the lesson to ensure it belongs to the user
      const existingLesson = await prisma.lesson.findFirst({
        where: {
          id: lessonId,
          created_by: userId,
        },
      });

      if (!existingLesson) {
        return {
          success: false,
          message: 'Lesson not found or access denied',
        };
      }

      // Store old S3 keys for cleanup if they're being replaced
      const oldImageKey = existingLesson.image_s3_key;
      const oldAudioKey = existingLesson.audio_s3_key;

      // Update the lesson in the database
      const updatedLesson = await prisma.lesson.update({
        where: {
          id: lessonId,
        },
        data: {
          title: updateData.title,
          image_s3_key: updateData.imageKey || existingLesson.image_s3_key,
          audio_s3_key: updateData.audioKey || existingLesson.audio_s3_key,
        },
      });

      // Clean up old S3 files if they were replaced (but not if they were just removed)
      const s3KeysToDelete: string[] = [];

      // If imageKey was provided and is different from old key, delete old key
      if (
        updateData.imageKey &&
        oldImageKey &&
        updateData.imageKey !== oldImageKey
      ) {
        s3KeysToDelete.push(oldImageKey);
      }

      // If audioKey was provided and is different from old key, delete old key
      if (
        updateData.audioKey &&
        oldAudioKey &&
        updateData.audioKey !== oldAudioKey
      ) {
        s3KeysToDelete.push(oldAudioKey);
      }

      // Delete old S3 files asynchronously (don't wait for completion)
      if (s3KeysToDelete.length > 0) {
        Promise.all(s3KeysToDelete.map(key => S3Service.deleteFile(key))).catch(
          (error: any) => {
            console.error(
              'Error deleting old S3 files during lesson update:',
              error
            );
          }
        );
      }

      return {
        success: true,
        message: 'Lesson updated successfully',
        lesson: {
          id: updatedLesson.id,
          title: updatedLesson.title,
          languageCode: updatedLesson.language_code,
          ...(updatedLesson.image_s3_key && {
            imageUrl: updatedLesson.image_s3_key,
          }),
          ...(updatedLesson.audio_s3_key && {
            audioUrl: updatedLesson.audio_s3_key,
          }),
          createdAt: updatedLesson.created_at,
        },
      };
    } catch (error) {
      console.error('Update lesson error:', error);
      return {
        success: false,
        message: 'Failed to update lesson',
      };
    }
  }

  /**
   * Delete a lesson with all associated sentences and S3 files
   */
  static async deleteLesson(
    userId: number,
    lessonId: number
  ): Promise<LessonResponse> {
    try {
      // Find the lesson to ensure it belongs to the user
      const lesson = await prisma.lesson.findFirst({
        where: {
          id: lessonId,
          created_by: userId,
        },
        include: {
          lessonFiles: true,
        },
      });

      if (!lesson) {
        return {
          success: false,
          message: 'Lesson not found or access denied',
        };
      }

      // Store S3 keys for deletion after database operations
      const s3KeysToDelete = {
        imageKey: lesson.image_s3_key,
        fileKeys: lesson.lessonFiles
          .map(lf => lf.file_s3_key)
          .filter((key): key is string => Boolean(key)),
        audioKey: lesson.audio_s3_key,
      };

      // Delete lesson and all associated records in a transaction
      await prisma.$transaction(async tx => {
        // First, delete all sentences associated with the lesson
        await tx.sentence.deleteMany({
          where: {
            lesson_id: lessonId,
          },
        });

        // Delete all lesson files associated with the lesson
        await tx.lessonFile.deleteMany({
          where: {
            lesson_id: lessonId,
          },
        });

        // Then delete the lesson itself
        await tx.lesson.delete({
          where: {
            id: lessonId,
          },
        });
      });

      const s3DeletePromises = [
        s3KeysToDelete.imageKey &&
          S3Service.deleteFile(s3KeysToDelete.imageKey).catch(error => {
            console.error('Error deleting image from S3:', error);
          }),
        ...s3KeysToDelete.fileKeys.map(fileKey =>
          S3Service.deleteFile(fileKey).catch(error => {
            console.error('Error deleting file from S3:', error);
          })
        ),
        s3KeysToDelete.audioKey &&
          S3Service.deleteFile(s3KeysToDelete.audioKey).catch(error => {
            console.error('Error deleting audio from S3:', error);
          }),
      ].filter(Boolean);

      await Promise.all(s3DeletePromises);

      return {
        success: true,
        message: 'Lesson and all associated data deleted successfully',
      };
    } catch (error) {
      console.error('Delete lesson error:', error);
      return {
        success: false,
        message: 'Failed to delete lesson',
      };
    }
  }
}
