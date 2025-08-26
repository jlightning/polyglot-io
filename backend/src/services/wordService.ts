import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CreateWordUserMarkData {
  word: string;
  languageCode: string;
  note: string;
  mark: number;
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

      // First, find or create the word
      let word = await prisma.word.findUnique({
        where: {
          word_language_code: {
            word: data.word,
            language_code: data.languageCode,
          },
        },
      });

      if (!word) {
        // Create the word if it doesn't exist
        word = await prisma.word.create({
          data: {
            word: data.word,
            language_code: data.languageCode,
          },
        });
      }

      // Check if user already has a mark for this word
      const existingMark = await prisma.wordUserMark.findFirst({
        where: {
          user_id: userId,
          word_id: word.id,
        },
      });

      let wordUserMark;
      if (existingMark) {
        // Update existing mark
        wordUserMark = await prisma.wordUserMark.update({
          where: { id: existingMark.id },
          data: {
            note: data.note,
            mark: data.mark,
          },
          include: {
            word: true,
          },
        });
      } else {
        // Create new mark
        wordUserMark = await prisma.wordUserMark.create({
          data: {
            user_id: userId,
            word_id: word.id,
            note: data.note,
            mark: data.mark,
          },
          include: {
            word: true,
          },
        });
      }

      return {
        success: true,
        data: wordUserMark,
        message: existingMark
          ? 'Word mark updated successfully'
          : 'Word mark created successfully',
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
   * Delete word user mark
   */
  static async deleteWordUserMark(
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
      });

      if (!wordUserMark) {
        return {
          success: false,
          message: 'Word mark not found',
        };
      }

      await prisma.wordUserMark.delete({
        where: { id: wordUserMark.id },
      });

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
}
