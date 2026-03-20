import {
  Prisma,
  LessonType,
  LessonProcessingStatus,
  UserLessonProgressStatus,
} from '@prisma/client';
import type { Context } from './index';
import { wrapInTransaction } from './db';

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

export interface CreateMangaLessonData {
  title: string;
  languageCode: string;
  imageKey?: string;
  mangaPageKeys: string[];
}

export interface CreateManualLessonData {
  title: string;
  languageCode: string;
  imageKey?: string;
  audioKey?: string;
  sentences?: string[];
  lessonType?: 'manual' | 'generated';
  createdWithPrompt?: string;
}

export interface LessonResponse {
  success: boolean;
  message: string;
  lesson?: {
    id: number;
    title: string;
    languageCode: string;
    lessonType?: string;
    processingStatus: string;
    totalSentences?: number;
    imageUrl?: string;
    fileUrl?: string;
    audioUrl?: string;
    lessonFiles?: any[];
    userProgress?: any;
    isPinned?: boolean;
    createdAt: Date;
    createdWithPrompt?: string;
  };
  lessons?: {
    id: number;
    title: string;
    languageCode: string;
    lessonType?: string;
    processingStatus: string;
    imageUrl?: string;
    fileUrl?: string;
    audioUrl?: string;
    isPinned?: boolean;
    createdAt: Date;
    userProgress?: any;
    createdWithPrompt?: string;
  }[];
}

export class LessonService {
  /**
   * Create a new lesson with optional URLs and process lesson file
   */
  async createLesson(
    ctx: Context,
    userId: number,
    lessonData: CreateLessonData
  ): Promise<LessonResponse> {
    try {
      // Validate language code
      if (!ctx.configService.isLanguageEnabled(ctx, lessonData.languageCode)) {
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
          const fileContent = await ctx.s3Service.getFileContent(
            ctx,
            lessonData.fileKey
          );
          const fileName = lessonData.fileKey.split('/').pop() || '';

          // Use TextProcessingService to detect file type
          const detectedFileType = ctx.textProcessingService.getFileType(
            ctx,
            fileContent,
            fileName
          );
          lessonType =
            detectedFileType === 'srt' ||
            detectedFileType === 'ass' ||
            detectedFileType === 'youtube_transcript'
              ? LessonType.subtitle
              : LessonType.text;
        } catch (error) {
          console.error(
            'Error detecting file type, defaulting to text:',
            error
          );
          lessonType = LessonType.text;
        }
      }

      const lesson = await wrapInTransaction(ctx, async ctx => {
        // Create lesson in database
        const lesson = await ctx.prisma.lesson.create({
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
          await this.processLessonFile(ctx, lesson.id, lessonData.fileKey);
        }

        return lesson;
      });

      return {
        success: true,
        message: 'Lesson created successfully',
        lesson: {
          id: lesson.id,
          title: lesson.title,
          languageCode: lesson.language_code,
          processingStatus: lesson.processing_status,
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
   * Create a new manual lesson (no file; sentences are added one by one from the lesson view)
   */
  async createManualLesson(
    ctx: Context,
    userId: number,
    lessonData: CreateManualLessonData
  ): Promise<LessonResponse> {
    try {
      if (!ctx.configService.isLanguageEnabled(ctx, lessonData.languageCode)) {
        return {
          success: false,
          message: 'Language not supported or not enabled',
        };
      }

      const lessonType = lessonData.lessonType ?? LessonType.manual;

      const lesson = await wrapInTransaction(ctx, async ctx => {
        const lesson = await ctx.prisma.lesson.create({
          data: {
            created_by: userId,
            title: lessonData.title,
            lesson_type: lessonType,
            language_code: lessonData.languageCode,
            image_s3_key: lessonData.imageKey || null,
            audio_s3_key: lessonData.audioKey || null,
            created_with_prompt: lessonData.createdWithPrompt ?? null,
          },
        });
        await ctx.prisma.lessonFile.create({
          data: {
            lesson_id: lesson.id,
            file_s3_key: null,
          },
        });
        return lesson;
      });

      if (
        lessonData.sentences &&
        Array.isArray(lessonData.sentences) &&
        lessonData.sentences.length > 0
      ) {
        const addResult = await ctx.sentenceService.addSentencesToLesson(
          ctx,
          lesson.id,
          userId,
          lessonData.sentences
        );
        if (!addResult.success) {
          return {
            success: false,
            message: addResult.message ?? 'Failed to add sentences to lesson',
          };
        }
      }

      return {
        success: true,
        message: 'Lesson created successfully',
        lesson: {
          id: lesson.id,
          title: lesson.title,
          languageCode: lesson.language_code,
          processingStatus: lesson.processing_status,
          ...(lesson.image_s3_key && { imageUrl: lesson.image_s3_key }),
          ...(lesson.audio_s3_key && { audioUrl: lesson.audio_s3_key }),
          ...(lesson.created_with_prompt && {
            createdWithPrompt: lesson.created_with_prompt,
          }),
          createdAt: lesson.created_at,
        },
      };
    } catch (error) {
      console.error('Create manual lesson error:', error);
      return {
        success: false,
        message: 'Failed to create lesson',
      };
    }
  }

  /**
   * Create a new manga lesson and process manga pages with OCR
   */
  async createMangaLesson(
    ctx: Context,
    userId: number,
    lessonData: CreateMangaLessonData
  ): Promise<LessonResponse> {
    try {
      // Validate language code
      if (!ctx.configService.isLanguageEnabled(ctx, lessonData.languageCode)) {
        return {
          success: false,
          message: 'Language not supported or not enabled',
        };
      }

      // Convert image files (PNG, GIF, WebP) to JPG and get the updated keys
      const processedMangaPageKeys: string[] = [];
      const convertedKeys: string[] = [];

      for (const pageKey of lessonData.mangaPageKeys) {
        if (
          ['png', 'gif', 'webp'].some(ext =>
            pageKey?.toLowerCase().endsWith(`.${ext}`)
          )
        ) {
          try {
            console.log(`Converting image to JPG: ${pageKey}`);
            const jpgKey = await ctx.s3Service.convertImageToJpgAndReplace(
              ctx,
              pageKey,
              userId
            );
            processedMangaPageKeys.push(jpgKey);
            convertedKeys.push(pageKey);
          } catch (error) {
            console.error(`Failed to convert image ${pageKey} to JPG:`, error);
            // If conversion fails, keep the original key and log the error
            processedMangaPageKeys.push(pageKey);
          }
        } else {
          // Keep JPG files as is
          processedMangaPageKeys.push(pageKey);
        }
      }

      // Create manga lesson in database with pending processing status
      const lesson = await ctx.prisma.lesson.create({
        data: {
          created_by: userId,
          title: lessonData.title,
          lesson_type: LessonType.manga,
          language_code: lessonData.languageCode,
          image_s3_key: lessonData.imageKey || null,
          audio_s3_key: null, // Manga lessons don't have audio
          processing_status: LessonProcessingStatus.completed,
        },
      });

      // Create lesson file record for this manga page using processed keys
      await ctx.prisma.lessonFile.createMany({
        data: processedMangaPageKeys.map(p => ({
          lesson_id: lesson.id,
          file_s3_key: p,
        })),
      });

      return {
        success: true,
        message: 'Manga lesson created and processed successfully',
        lesson: {
          id: lesson.id,
          title: lesson.title,
          languageCode: lesson.language_code,
          processingStatus: lesson.processing_status,
          ...(lesson.image_s3_key && {
            imageUrl: ctx.s3Service.getFileUrl(ctx, lesson.image_s3_key),
          }),
          createdAt: lesson.created_at,
        },
      };
    } catch (error) {
      console.error('Error in createMangaLesson:', error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create manga lesson',
      };
    }
  }

  /**
   * Process a lesson file (SRT or TXT) and create sentence records
   */
  private async processLessonFile(
    ctx: Context,
    lessonId: number,
    fileKey: string
  ): Promise<void> {
    try {
      // Create lesson file record
      const lessonFile = await ctx.prisma.lessonFile.create({
        data: {
          lesson_id: lessonId,
          file_s3_key: fileKey,
        },
      });

      // Download file content from S3
      const fileContent = await ctx.s3Service.getFileContent(ctx, fileKey);

      if (!fileContent || fileContent.trim().length === 0) {
        throw new Error('File content is empty');
      }

      // Extract filename from S3 key for file type detection
      const fileName = fileKey.split('/').pop() || '';

      // Process the file content to extract sentences
      const processedSentences = ctx.textProcessingService.processLessonFile(
        ctx,
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
      await ctx.prisma.sentence.createMany({
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
   * Get a specific lesson by ID
   */
  async getLessonById(
    ctx: Context,
    userId: number,
    lessonId: number
  ): Promise<LessonResponse> {
    try {
      const lesson = await ctx.prisma.lesson.findFirst({
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

      let imageUrl = lesson.image_s3_key;
      let fileUrl = null;
      let audioUrl = lesson.audio_s3_key;

      // Generate signed URLs for S3 keys
      if (lesson.image_s3_key) {
        try {
          imageUrl = await ctx.s3Service.getDownloadUrl(
            ctx,
            lesson.image_s3_key
          );
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
          fileUrl = await ctx.s3Service.getDownloadUrl(
            ctx,
            lesson.lessonFiles[0]?.file_s3_key
          );
        } catch (error) {
          console.error('Error generating file download URL:', error);
          fileUrl = null;
        }
      }

      if (lesson.audio_s3_key) {
        try {
          audioUrl = await ctx.s3Service.getDownloadUrl(
            ctx,
            lesson.audio_s3_key
          );
        } catch (error) {
          console.error('Error generating audio download URL:', error);
          audioUrl = null;
        }
      }

      // Get user progress for this lesson
      const progress = await ctx.prisma.userLessonProgress.findUnique({
        where: {
          user_id_lesson_id: {
            user_id: userId,
            lesson_id: lesson.id,
          },
        },
      });

      const pin = await ctx.prisma.lessonUserPin.findUnique({
        where: {
          user_id_lesson_id: { user_id: userId, lesson_id: lesson.id },
        },
      });

      // Generate download URLs for lesson files (for manga lessons)
      let lessonFiles: any[] = [];
      if (lesson.lessonFiles && lesson.lessonFiles.length > 0) {
        lessonFiles = await Promise.all(
          lesson.lessonFiles.map(async file => {
            let imageUrl: string | undefined;
            if (file.file_s3_key) {
              try {
                imageUrl = await ctx.s3Service.getDownloadUrl(
                  ctx,
                  file.file_s3_key
                );
              } catch (error) {
                console.error('Error generating file download URL:', error);
              }
            }
            return {
              id: file.id,
              fileS3Key: file.file_s3_key,
              ...(imageUrl && { imageUrl }),
            };
          })
        );
      }

      return {
        success: true,
        message: 'Lesson retrieved successfully',
        lesson: {
          id: lesson.id,
          title: lesson.title,
          languageCode: lesson.language_code,
          lessonType: lesson.lesson_type,
          processingStatus: lesson.processing_status,
          totalSentences: await ctx.prisma.sentence.count({
            where: { lesson_id: lesson.id },
          }),
          ...(imageUrl && { imageUrl }),
          ...(fileUrl && { fileUrl }),
          ...(audioUrl && { audioUrl }),
          ...(lessonFiles.length > 0 && { lessonFiles }),
          createdAt: lesson.created_at,
          ...(progress && {
            userProgress: {
              status: progress.status,
              readTillSentenceId: progress.read_till_sentence_id,
            },
          }),
          isPinned: !!pin,
          ...(lesson.created_with_prompt && {
            createdWithPrompt: lesson.created_with_prompt,
          }),
        },
      };
    } catch (error) {
      console.error('Get lesson by ID error:', error);
      return {
        success: false,
        message: 'Failed to retrieve lesson',
      };
    }
  }

  /**
   * Pin a lesson for the user
   */
  async pinLesson(
    ctx: Context,
    userId: number,
    lessonId: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const lesson = await ctx.prisma.lesson.findFirst({
        where: {
          id: lessonId,
          created_by: userId,
        },
      });
      if (!lesson) {
        return {
          success: false,
          message: 'Lesson not found or access denied',
        };
      }
      await ctx.prisma.lessonUserPin.upsert({
        where: {
          user_id_lesson_id: { user_id: userId, lesson_id: lessonId },
        },
        create: { user_id: userId, lesson_id: lessonId },
        update: {},
      });
      return { success: true, message: 'Lesson pinned' };
    } catch (error) {
      console.error('Pin lesson error:', error);
      return {
        success: false,
        message: 'Failed to pin lesson',
      };
    }
  }

  /**
   * Unpin a lesson for the user
   */
  async unpinLesson(
    ctx: Context,
    userId: number,
    lessonId: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const lesson = await ctx.prisma.lesson.findFirst({
        where: {
          id: lessonId,
          created_by: userId,
        },
      });
      if (!lesson) {
        return {
          success: false,
          message: 'Lesson not found or access denied',
        };
      }
      await ctx.prisma.lessonUserPin.deleteMany({
        where: {
          user_id: userId,
          lesson_id: lessonId,
        },
      });
      return { success: true, message: 'Lesson unpinned' };
    } catch (error) {
      console.error('Unpin lesson error:', error);
      return {
        success: false,
        message: 'Failed to unpin lesson',
      };
    }
  }

  /**
   * Get lessons filtered by language
   */
  async getLessonsByLanguage(
    ctx: Context,
    userId: number,
    languageCode: string,
    filters?: {
      search?: string;
      status?: 'reading' | 'finished';
      type?: 'text' | 'subtitle' | 'manga' | 'manual' | 'generated';
    }
  ): Promise<LessonResponse> {
    try {
      // Validate language code
      if (!ctx.configService.isLanguageEnabled(ctx, languageCode)) {
        return {
          success: false,
          message: 'Language not supported or not enabled',
        };
      }

      // Build where clause with filters
      const whereClause: Prisma.LessonWhereInput = {
        created_by: userId,
        language_code: languageCode,
      };

      // Add full-text search on title (case-insensitive, uses FULLTEXT index)
      if (filters?.search) {
        whereClause.title = { search: filters.search };
      }

      // Add lesson type filter
      if (filters?.type) {
        whereClause.lesson_type = filters.type as LessonType;
      }

      // Add user progress status filter
      if (filters?.status) {
        whereClause.userLessonProgresses = {
          some: {
            user_id: userId,
            status: filters.status as UserLessonProgressStatus,
          },
        };
      }

      // Load pinned lesson IDs (same filters)
      const pinnedPins = await ctx.prisma.lessonUserPin.findMany({
        where: {
          user_id: userId,
          lesson: whereClause,
        },
        select: { lesson_id: true },
      });
      const pinnedIds = pinnedPins.map(p => p.lesson_id);

      // Load pinned lessons then unpinned, combine (pinned first)
      const pinnedLessons = await ctx.prisma.lesson.findMany({
        where: {
          id: { in: pinnedIds },
          ...whereClause,
        },
        include: { lessonFiles: true },
        orderBy: { id: 'desc' },
      });
      const unpinnedLessons = await ctx.prisma.lesson.findMany({
        where: {
          id: { notIn: pinnedIds },
          ...whereClause,
        },
        include: { lessonFiles: true },
        orderBy: { id: 'desc' },
      });
      const lessons = [...pinnedLessons, ...unpinnedLessons];

      const lessonsWithUrls = await Promise.all(
        lessons.map(async lesson => {
          let imageUrl = lesson.image_s3_key;
          let fileUrl = null;
          let audioUrl = lesson.audio_s3_key;

          if (lesson.image_s3_key) {
            try {
              imageUrl = await ctx.s3Service.getDownloadUrl(
                ctx,
                lesson.image_s3_key
              );
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
              fileUrl = await ctx.s3Service.getDownloadUrl(
                ctx,
                lesson.lessonFiles[0]?.file_s3_key
              );
            } catch (error) {
              console.error('Error generating file download URL:', error);
              fileUrl = null;
            }
          }

          if (lesson.audio_s3_key) {
            try {
              audioUrl = await ctx.s3Service.getDownloadUrl(
                ctx,
                lesson.audio_s3_key
              );
            } catch (error) {
              console.error('Error generating audio download URL:', error);
              audioUrl = null;
            }
          }

          // Get user progress for this lesson
          const progress = await ctx.prisma.userLessonProgress.findUnique({
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
            lessonType: lesson.lesson_type,
            processingStatus: lesson.processing_status,
            ...(imageUrl && { imageUrl }),
            ...(fileUrl && { fileUrl }),
            ...(audioUrl && { audioUrl }),
            createdAt: lesson.created_at,
            isPinned: pinnedIds.includes(lesson.id),
            ...(progress && {
              userProgress: {
                status: progress.status,
                readTillSentenceId: progress.read_till_sentence_id,
              },
            }),
            ...(lesson.created_with_prompt && {
              createdWithPrompt: lesson.created_with_prompt,
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
  async updateLesson(
    ctx: Context,
    userId: number,
    lessonId: number,
    updateData: UpdateLessonData
  ): Promise<LessonResponse> {
    try {
      // Find the lesson to ensure it belongs to the user
      const existingLesson = await ctx.prisma.lesson.findFirst({
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
      const updatedLesson = await ctx.prisma.lesson.update({
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
        Promise.all(
          s3KeysToDelete.map(key => ctx.s3Service.deleteFile(ctx, key))
        ).catch((error: any) => {
          console.error(
            'Error deleting old S3 files during lesson update:',
            error
          );
        });
      }

      return {
        success: true,
        message: 'Lesson updated successfully',
        lesson: {
          id: updatedLesson.id,
          title: updatedLesson.title,
          languageCode: updatedLesson.language_code,
          processingStatus: updatedLesson.processing_status,
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
  async deleteLesson(
    ctx: Context,
    userId: number,
    lessonId: number
  ): Promise<LessonResponse> {
    try {
      // Find the lesson to ensure it belongs to the user
      const lesson = await ctx.prisma.lesson.findFirst({
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
      await wrapInTransaction(ctx, async ctx => {
        await ctx.prisma.userLessonProgress.deleteMany({
          where: {
            lesson_id: lessonId,
          },
        });

        const allSentences = await ctx.prisma.sentence.findMany({
          where: {
            lesson_id: lessonId,
          },
          select: {
            id: true,
          },
        });

        const sentenceIds = allSentences.map(s => s.id);

        await ctx.prisma.sentenceWord.deleteMany({
          where: {
            sentence_id: { in: sentenceIds },
          },
        });

        await ctx.prisma.sentenceTranslation.deleteMany({
          where: {
            sentence_id: { in: sentenceIds },
          },
        });

        // First, delete all sentences associated with the lesson
        await ctx.prisma.sentence.deleteMany({
          where: {
            lesson_id: lessonId,
          },
        });

        // Delete all lesson files associated with the lesson
        await ctx.prisma.lessonFile.deleteMany({
          where: {
            lesson_id: lessonId,
          },
        });

        // Then delete the lesson itself
        await ctx.prisma.lesson.delete({
          where: {
            id: lessonId,
          },
        });
      });

      const s3DeletePromises = [
        s3KeysToDelete.imageKey &&
          ctx.s3Service
            .deleteFile(ctx, s3KeysToDelete.imageKey)
            .catch(error => {
              console.error('Error deleting image from S3:', error);
            }),
        ...s3KeysToDelete.fileKeys.map(fileKey =>
          ctx.s3Service.deleteFile(ctx, fileKey).catch(error => {
            console.error('Error deleting file from S3:', error);
          })
        ),
        s3KeysToDelete.audioKey &&
          ctx.s3Service
            .deleteFile(ctx, s3KeysToDelete.audioKey)
            .catch(error => {
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

  /**
   * Process OCR on a selected region of a manga page and add extracted sentences
   */
  async processOCROnSelectedRegion(
    ctx: Context,
    lessonId: number,
    lessonFileId: number,
    selection: { x: number; y: number; width: number; height: number }
  ): Promise<{
    success: boolean;
    message: string;
    sentences?: any[];
    error?: string;
  }> {
    try {
      // Verify lesson ownership
      const lesson = await ctx.prisma.lesson.findFirst({
        where: {
          id: lessonId,
        },
        include: {
          lessonFiles: {
            where: {
              id: lessonFileId,
            },
          },
        },
      });

      if (!lesson) {
        return {
          success: false,
          message: 'Lesson not found or access denied',
        };
      }

      const lessonFile = lesson.lessonFiles[0];
      if (!lessonFile) {
        return {
          success: false,
          message: 'Lesson file not found',
        };
      }

      // Download image from S3 and convert to base64
      if (!lessonFile.file_s3_key) {
        return {
          success: false,
          message: 'Lesson file S3 key not found',
        };
      }

      const imageBuffer = await ctx.s3Service.getFileBuffer(
        ctx,
        lessonFile.file_s3_key
      );
      const imageBase64 = imageBuffer.toString('base64');

      // Extract text from selected region using OpenAI Vision API
      const extractedTexts = await ctx.openaiService.extractTextFromImageRegion(
        ctx,
        imageBase64,
        lesson.language_code,
        selection
      );

      if (extractedTexts.length === 0) {
        return {
          success: true,
          message: 'No text found in selected region',
          sentences: [],
        };
      }

      // Create new sentences from extracted text
      const newSentenceRecords = [];
      for (const text of extractedTexts) {
        try {
          const sentence = await ctx.prisma.sentence.create({
            data: {
              lesson_id: lessonId,
              lesson_file_id: lessonFileId,
              original_text: text,
              split_text: Prisma.JsonNull,
              start_time: null,
              end_time: null,
            },
          });

          newSentenceRecords.push({
            id: sentence.id,
            original_text: sentence.original_text,
            split_text: null,
            start_time: null,
            end_time: null,
          });
        } catch (error) {
          console.error('Error creating sentence:', error);
        }
      }

      // Process all new sentences using SentenceService to split text and store translations
      const processedSentences =
        await ctx.sentenceService.processSentenceSplitText(
          ctx,
          newSentenceRecords,
          lesson.language_code
        );

      return {
        success: true,
        message: `Successfully extracted ${extractedTexts.length} sentence(s) from selected region`,
        sentences: processedSentences,
      };
    } catch (error) {
      console.error('Process OCR on selected region error:', error);
      return {
        success: false,
        message: 'Failed to process OCR on selected region',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
