import { PrismaClient, WordUserMarkSource } from '@prisma/client';
import { UserActionLogService } from './userActionLogService';

const prisma = new PrismaClient();

interface CreateWordUserMarkData {
  word: string;
  languageCode: string;
  note: string;
  mark: number;
  source?: WordUserMarkSource;
}

export class WordService {
  /**
   * Create or update a word user mark
   * If the word doesn't exist, it will be created first
   */
  static async createOrUpdateWordUserMark(
    userId: number,
    data: CreateWordUserMarkData
  ) {
    try {
      // Validate mark is between 0 and 5
      if (data.mark < 0 || data.mark > 5) {
        return {
          success: false,
          message: 'Mark must be between 0 and 5',
        };
      }

      // Use upsert to find or create the word
      const word = await prisma.word.upsert({
        where: {
          word_language_code: {
            word: data.word,
            language_code: data.languageCode,
          },
        },
        update: {}, // No updates needed for existing words
        create: {
          word: data.word,
          language_code: data.languageCode,
        },
      });

      // Get existing mark value to track changes
      const existingWordUserMark = await prisma.wordUserMark.findUnique({
        where: {
          user_id_word_id: {
            user_id: userId,
            word_id: word.id,
          },
        },
      });

      const oldMark = existingWordUserMark?.mark || 0;

      // Use proper upsert with the unique constraint on user_id + word_id
      const wordUserMark = await prisma.wordUserMark.upsert({
        where: {
          user_id_word_id: {
            user_id: userId,
            word_id: word.id,
          },
        },
        update: {
          note: data.note,
          mark: data.mark,
        },
        create: {
          user_id: userId,
          word_id: word.id,
          note: data.note,
          mark: data.mark,
          ...(data.source ? { source: data.source } : {}),
        },
        include: {
          word: true,
        },
      });

      // Log user action
      await UserActionLogService.logWordMarkAction(userId, data.languageCode, {
        word_id: word.id,
        old_mark: oldMark,
        new_mark: data.mark,
      });

      return {
        success: true,
        data: wordUserMark,
        message: 'Word mark saved successfully',
      };
    } catch (error) {
      console.error('Error creating/updating word user mark:', error);
      return {
        success: false,
        message: 'Failed to create/update word mark',
      };
    }
  }

  /**
   * Get word user mark by word and language
   */
  static async getWordUserMark(
    userId: number,
    word: string,
    languageCode: string
  ) {
    try {
      const wordUserMark = await prisma.wordUserMark.findFirst({
        where: {
          user_id: userId,
          word: {
            word: word,
            language_code: languageCode,
          },
        },
        include: {
          word: true,
        },
      });

      return {
        success: true,
        data: wordUserMark,
      };
    } catch (error) {
      console.error('Error getting word user mark:', error);
      return {
        success: false,
        message: 'Failed to get word mark',
      };
    }
  }

  /**
   * Get bulk word user marks by words and language
   */
  static async getBulkWordUserMarks(
    userId: number,
    words: string[],
    languageCode: string
  ) {
    try {
      const wordUserMarks = await prisma.wordUserMark.findMany({
        where: {
          user_id: userId,
          word: {
            word: {
              in: words,
            },
            language_code: languageCode,
          },
        },
        include: {
          word: true,
        },
      });

      // Create a map of word -> mark for efficient lookup
      const marksMap: Record<string, number> = {};
      wordUserMarks.forEach(mark => {
        marksMap[mark.word.word] = mark.mark;
      });

      return {
        success: true,
        data: marksMap,
      };
    } catch (error) {
      console.error('Error getting bulk word user marks:', error);
      return {
        success: false,
        message: 'Failed to get bulk word marks',
      };
    }
  }

  /**
   * Delete word user mark
   */
  static async deleteWordUserMark(
    userId: number,
    word: string,
    languageCode: string
  ) {
    try {
      // Use deleteMany to avoid the need for a separate find operation
      const deleteResult = await prisma.wordUserMark.deleteMany({
        where: {
          user_id: userId,
          word: {
            word: word,
            language_code: languageCode,
          },
        },
      });

      if (deleteResult.count === 0) {
        return {
          success: false,
          message: 'Word mark not found',
        };
      }

      return {
        success: true,
        message: 'Word mark deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting word user mark:', error);
      return {
        success: false,
        message: 'Failed to delete word mark',
      };
    }
  }

  /**
   * Get all word user marks for a user
   */
  static async getUserWordMarks(
    userId: number,
    page: number = 1,
    limit: number = 50
  ) {
    try {
      const skip = (page - 1) * limit;

      const [wordUserMarks, total] = await Promise.all([
        prisma.wordUserMark.findMany({
          where: { user_id: userId },
          include: {
            word: true,
          },
          orderBy: { updated_at: 'desc' },
          skip,
          take: limit,
        }),
        prisma.wordUserMark.count({
          where: { user_id: userId },
        }),
      ]);

      return {
        success: true,
        data: {
          wordUserMarks,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      console.error('Error getting user word marks:', error);
      return {
        success: false,
        message: 'Failed to get user word marks',
      };
    }
  }

  /**
   * Get detailed word marks with related sentences and lessons
   */
  static async getUserWordMarksWithDetails(
    userId: number,
    page: number = 1,
    limit: number = 50,
    markFilter?: number,
    languageFilter?: string,
    searchFilter?: string
  ) {
    try {
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = { user_id: userId };
      if (markFilter !== undefined && markFilter >= 0 && markFilter <= 5) {
        whereClause.mark = markFilter;
      }

      // Build word filter conditions
      const wordConditions: any = {};
      if (languageFilter) {
        wordConditions.language_code = languageFilter;
      }

      // Add search filter for word text or user notes
      if (searchFilter) {
        const searchTerm = searchFilter.toLowerCase();
        whereClause.OR = [
          {
            word: {
              ...wordConditions,
              word: {
                contains: searchTerm,
              },
            },
          },
          {
            note: {
              contains: searchTerm,
            },
            ...(Object.keys(wordConditions).length > 0 && {
              word: wordConditions,
            }),
          },
        ];
      } else if (Object.keys(wordConditions).length > 0) {
        whereClause.word = wordConditions;
      }

      const [wordUserMarks, total] = await Promise.all([
        prisma.wordUserMark.findMany({
          where: whereClause,
          include: {
            word: {
              include: {
                sentenceWords: {
                  include: {
                    sentence: {
                      include: {
                        lesson: {
                          select: {
                            id: true,
                            title: true,
                            language_code: true,
                          },
                        },
                      },
                    },
                  },
                  take: 3, // Limit to 3 sentences per word
                },
              },
            },
          },
          orderBy: { updated_at: 'desc' },
          skip,
          take: limit,
        }),
        prisma.wordUserMark.count({
          where: whereClause,
        }),
      ]);

      // Transform the data to include unique lessons per word
      const transformedData = wordUserMarks.map(wordMark => {
        const sentences = wordMark.word.sentenceWords.map(sw => ({
          id: sw.sentence.id,
          original_text: sw.sentence.original_text,
          lesson: sw.sentence.lesson,
        }));

        // Get unique lessons from sentences
        const lessonMap = new Map();
        sentences.forEach(sentence => {
          if (sentence.lesson && !lessonMap.has(sentence.lesson.id)) {
            lessonMap.set(sentence.lesson.id, sentence.lesson);
          }
        });
        const lessons = Array.from(lessonMap.values()).slice(0, 3); // Limit to 3 lessons

        return {
          ...wordMark,
          word: {
            ...wordMark.word,
            sentences: sentences.slice(0, 3), // Limit to 3 sentences
            lessons,
          },
        };
      });

      return {
        success: true,
        data: {
          wordUserMarks: transformedData,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      console.error('Error getting user word marks with details:', error);
      return {
        success: false,
        message: 'Failed to get user word marks with details',
      };
    }
  }
}
