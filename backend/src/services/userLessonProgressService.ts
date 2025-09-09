import { UserLessonProgressStatus } from '@prisma/client';

import { prisma } from './index';

export interface UserLessonProgressData {
  id: number;
  userId: number;
  lessonId: number;
  status: UserLessonProgressStatus;
  readTillSentenceId: number;
  sentenceInfo?: {
    id: number;
    originalText: string;
    lesson_file_id?: number;
    startTime: number | null;
    endTime: number | null;
  };
}

export interface UpdateProgressResponse {
  success: boolean;
  message?: string;
  progress?: UserLessonProgressData;
}

export interface GetProgressResponse {
  success: boolean;
  message?: string;
  progress?: UserLessonProgressData | null;
  shouldNavigateToPage?: number;
}

export class UserLessonProgressService {
  /**
   * Update user's progress for a lesson when they change pages or finish the lesson
   */
  static async updateProgress(
    userId: number,
    lessonId: number,
    currentPage: number,
    sentencesPerPage: number = 5,
    finishLesson: boolean = false
  ): Promise<UpdateProgressResponse> {
    try {
      // First, verify the lesson exists and belongs to the user
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

      // Get the first sentence of the current page
      const offset = (currentPage - 1) * sentencesPerPage;
      const firstSentenceOnPage = await prisma.sentence.findFirst({
        where: { lesson_id: lessonId },
        orderBy: { id: 'asc' },
        skip: offset,
        take: 1,
        select: {
          id: true,
          original_text: true,
        },
      });

      if (!firstSentenceOnPage) {
        return {
          success: false,
          message: 'No sentences found for this page',
        };
      }

      // Determine status based on finishLesson parameter or page position
      const totalSentences = await prisma.sentence.count({
        where: { lesson_id: lessonId },
      });
      const totalPages = Math.ceil(totalSentences / sentencesPerPage);
      const isLastPage = currentPage >= totalPages;

      let status: UserLessonProgressStatus | undefined;
      if (finishLesson) {
        status = UserLessonProgressStatus.finished;
      } else {
        status = isLastPage ? undefined : UserLessonProgressStatus.reading;
      }

      // Upsert the progress record
      const progress = await prisma.userLessonProgress.upsert({
        where: {
          user_id_lesson_id: {
            user_id: userId,
            lesson_id: lessonId,
          },
        },
        update: {
          read_till_sentence_id: firstSentenceOnPage.id,
          ...(status ? { status: status } : {}),
        },
        create: {
          user_id: userId,
          lesson_id: lessonId,
          read_till_sentence_id: firstSentenceOnPage.id,
          status: UserLessonProgressStatus.reading,
        },
        include: {
          sentence: {
            select: {
              id: true,
              original_text: true,
              start_time: true,
              end_time: true,
            },
          },
        },
      });

      return {
        success: true,
        progress: {
          id: progress.id,
          userId: progress.user_id,
          lessonId: progress.lesson_id,
          status: progress.status,
          readTillSentenceId: progress.read_till_sentence_id,
          sentenceInfo: {
            id: progress.sentence.id,
            originalText: progress.sentence.original_text,
            startTime: progress.sentence.start_time
              ? progress.sentence.start_time.toNumber()
              : null,
            endTime: progress.sentence.end_time
              ? progress.sentence.end_time.toNumber()
              : null,
          },
        },
      };
    } catch (error) {
      console.error('Error updating user lesson progress:', error);
      return {
        success: false,
        message: 'Failed to update progress',
      };
    }
  }

  /**
   * Get user's progress for a lesson and calculate which page they should navigate to
   */
  static async getProgress(
    userId: number,
    lessonId: number,
    sentencesPerPage: number = 5
  ): Promise<GetProgressResponse> {
    try {
      // First, verify the lesson exists and belongs to the user
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

      // Get the progress record
      const progress = await prisma.userLessonProgress.findUnique({
        where: {
          user_id_lesson_id: {
            user_id: userId,
            lesson_id: lessonId,
          },
        },
        include: {
          sentence: true,
        },
      });

      if (!progress) {
        // No progress found, user should start from page 1
        return {
          success: true,
          progress: null,
          shouldNavigateToPage: 1,
        };
      }

      // Calculate which page contains the read_till_sentence_id
      const sentencesBefore = await prisma.sentence.count({
        where: {
          lesson_id: lessonId,
          id: {
            lt: progress.read_till_sentence_id,
          },
        },
      });

      // Calculate the page number (1-indexed)
      const pageNumber = Math.floor(sentencesBefore / sentencesPerPage) + 1;

      return {
        success: true,
        progress: {
          id: progress.id,
          userId: progress.user_id,
          lessonId: progress.lesson_id,
          status: progress.status,
          readTillSentenceId: progress.read_till_sentence_id,
          sentenceInfo: {
            id: progress.sentence.id,
            originalText: progress.sentence.original_text,
            lesson_file_id: progress.sentence.lesson_file_id,
            startTime: progress.sentence.start_time
              ? progress.sentence.start_time.toNumber()
              : null,
            endTime: progress.sentence.end_time
              ? progress.sentence.end_time.toNumber()
              : null,
          },
        },
        shouldNavigateToPage: pageNumber,
      };
    } catch (error) {
      console.error('Error getting user lesson progress:', error);
      return {
        success: false,
        message: 'Failed to get progress',
      };
    }
  }

  /**
   * Get all progress records for a user (for dashboard/overview purposes)
   */
  static async getUserProgressOverview(userId: number): Promise<{
    success: boolean;
    message?: string;
    progressList?: Array<{
      lessonId: number;
      lessonTitle: string;
      status: UserLessonProgressStatus;
      readTillSentenceId: number;
      lastUpdated: Date;
    }>;
  }> {
    try {
      const progressRecords = await prisma.userLessonProgress.findMany({
        where: {
          user_id: userId,
        },
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: {
          updated_at: 'desc',
        },
      });

      const progressList = progressRecords.map(record => ({
        lessonId: record.lesson_id,
        lessonTitle: record.lesson.title,
        status: record.status,
        readTillSentenceId: record.read_till_sentence_id,
        lastUpdated: record.updated_at,
      }));

      return {
        success: true,
        progressList,
      };
    } catch (error) {
      console.error('Error getting user progress overview:', error);
      return {
        success: false,
        message: 'Failed to get progress overview',
      };
    }
  }

  /**
   * Update user's progress for a lesson using a specific sentence ID (used in video view)
   */
  static async updateProgressBySentence(
    userId: number,
    lessonId: number,
    sentenceId: number,
    finishLesson: boolean = false
  ): Promise<UpdateProgressResponse> {
    try {
      // First, verify the lesson exists and belongs to the user
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

      // Verify the sentence exists and belongs to this lesson
      const sentence = await prisma.sentence.findFirst({
        where: {
          id: sentenceId,
          lesson_id: lessonId,
        },
        select: {
          id: true,
          original_text: true,
          start_time: true,
          end_time: true,
        },
      });

      if (!sentence) {
        return {
          success: false,
          message: 'Sentence not found in this lesson',
        };
      }

      // Determine status based on finishLesson parameter
      let status: UserLessonProgressStatus | undefined;
      if (finishLesson) {
        status = UserLessonProgressStatus.finished;
      } else {
        status = UserLessonProgressStatus.reading;
      }

      // Upsert the progress record
      const progress = await prisma.userLessonProgress.upsert({
        where: {
          user_id_lesson_id: {
            user_id: userId,
            lesson_id: lessonId,
          },
        },
        update: {
          read_till_sentence_id: sentenceId,
          status: status,
        },
        create: {
          user_id: userId,
          lesson_id: lessonId,
          read_till_sentence_id: sentenceId,
          status: status,
        },
        include: {
          sentence: {
            select: {
              id: true,
              original_text: true,
              start_time: true,
              end_time: true,
            },
          },
        },
      });

      return {
        success: true,
        progress: {
          id: progress.id,
          userId: progress.user_id,
          lessonId: progress.lesson_id,
          status: progress.status,
          readTillSentenceId: progress.read_till_sentence_id,
          sentenceInfo: {
            id: progress.sentence.id,
            originalText: progress.sentence.original_text,
            startTime: progress.sentence.start_time
              ? progress.sentence.start_time.toNumber()
              : null,
            endTime: progress.sentence.end_time
              ? progress.sentence.end_time.toNumber()
              : null,
          },
        },
      };
    } catch (error) {
      console.error('Error updating user lesson progress by sentence:', error);
      return {
        success: false,
        message: 'Failed to update progress',
      };
    }
  }

  /**
   * Reset progress for a lesson (start from beginning)
   */
  static async resetProgress(
    userId: number,
    lessonId: number
  ): Promise<UpdateProgressResponse> {
    try {
      // Verify the lesson exists and belongs to the user
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

      // Delete the progress record to start fresh
      await prisma.userLessonProgress.deleteMany({
        where: {
          user_id: userId,
          lesson_id: lessonId,
        },
      });

      return {
        success: true,
        message: 'Progress reset successfully',
      };
    } catch (error) {
      console.error('Error resetting user lesson progress:', error);
      return {
        success: false,
        message: 'Failed to reset progress',
      };
    }
  }
}
