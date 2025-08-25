import { PrismaClient, Lesson } from '@prisma/client';
import { ConfigService } from './configService';
import { S3Service } from './s3Service';

const prisma = new PrismaClient();

export interface CreateLessonData {
  title: string;
  languageCode: string;
  imageKey?: string;
  fileKey?: string;
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
    createdAt: Date;
  };
  lessons?: {
    id: number;
    title: string;
    languageCode: string;
    imageUrl?: string;
    fileUrl?: string;
    createdAt: Date;
  }[];
}

export class LessonService {
  /**
   * Create a new lesson with optional URLs
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

      // Create lesson in database
      const lesson = await prisma.lesson.create({
        data: {
          created_by: userId,
          title: lessonData.title,
          language_code: lessonData.languageCode,
          image_s3_key: lessonData.imageKey || null,
          file_s3_key: lessonData.fileKey || null,
        },
      });

      return {
        success: true,
        message: 'Lesson created successfully',
        lesson: {
          id: lesson.id,
          title: lesson.title,
          languageCode: lesson.language_code,
          ...(lesson.image_s3_key && { imageUrl: lesson.image_s3_key }),
          ...(lesson.file_s3_key && { fileUrl: lesson.file_s3_key }),
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
   * Get all lessons for a user
   */
  static async getUserLessons(userId: number): Promise<LessonResponse> {
    try {
      const lessons = await prisma.lesson.findMany({
        where: {
          created_by: userId,
        },
        orderBy: {
          id: 'desc', // Most recent first
        },
      });

      const lessonsWithUrls = await Promise.all(
        lessons.map(async (lesson: Lesson) => {
          let imageUrl = lesson.image_s3_key;
          let fileUrl = lesson.file_s3_key;

          // Generate signed URLs for S3 keys
          if (lesson.image_s3_key) {
            try {
              imageUrl = await S3Service.getDownloadUrl(lesson.image_s3_key);
            } catch (error) {
              console.error('Error generating image download URL:', error);
              imageUrl = null;
            }
          }

          if (lesson.file_s3_key) {
            try {
              fileUrl = await S3Service.getDownloadUrl(lesson.file_s3_key);
            } catch (error) {
              console.error('Error generating file download URL:', error);
              fileUrl = null;
            }
          }

          return {
            id: lesson.id,
            title: lesson.title,
            languageCode: lesson.language_code,
            ...(imageUrl && { imageUrl }),
            ...(fileUrl && { fileUrl }),
            createdAt: lesson.created_at,
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
        orderBy: {
          id: 'desc',
        },
      });

      const lessonsWithUrls = await Promise.all(
        lessons.map(async (lesson: Lesson) => {
          let imageUrl = lesson.image_s3_key;
          let fileUrl = lesson.file_s3_key;

          if (lesson.image_s3_key) {
            try {
              imageUrl = await S3Service.getDownloadUrl(lesson.image_s3_key);
            } catch (error) {
              console.error('Error generating image download URL:', error);
              imageUrl = null;
            }
          }

          if (lesson.file_s3_key) {
            try {
              fileUrl = await S3Service.getDownloadUrl(lesson.file_s3_key);
            } catch (error) {
              console.error('Error generating file download URL:', error);
              fileUrl = null;
            }
          }

          return {
            id: lesson.id,
            title: lesson.title,
            languageCode: lesson.language_code,
            ...(imageUrl && { imageUrl }),
            ...(fileUrl && { fileUrl }),
            createdAt: lesson.created_at,
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
   * Delete a lesson
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
      });

      if (!lesson) {
        return {
          success: false,
          message: 'Lesson not found or access denied',
        };
      }

      // Delete files from S3 if they exist
      if (lesson.image_s3_key) {
        await S3Service.deleteFile(lesson.image_s3_key);
      }
      if (lesson.file_s3_key) {
        await S3Service.deleteFile(lesson.file_s3_key);
      }

      // Delete lesson from database
      await prisma.lesson.delete({
        where: {
          id: lessonId,
        },
      });

      return {
        success: true,
        message: 'Lesson deleted successfully',
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
