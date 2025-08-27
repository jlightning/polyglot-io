import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

export interface UserScoreResponse {
  success: boolean;
  message: string;
  score?: number;
  knownWordsCount?: number;
}

export class UserScoreService {
  /**
   * Get user statistics including user score and known words count
   * User score = sum of all marks for today divided by 2 (rounded up)
   * Known words count = count of words marked 4 or 5
   * Optionally filter by language code
   */
  static async getUserStats(
    userId: number,
    date?: Date,
    languageCode?: string
  ): Promise<UserScoreResponse> {
    try {
      const targetDate = date ? dayjs(date) : dayjs();

      // Get start and end of the target day
      const startOfDay = targetDate.startOf('day').toDate();
      const endOfDay = targetDate.endOf('day').toDate();

      // Build where conditions with optional language filter
      const baseWhereCondition = {
        user_id: userId,
        ...(languageCode && {
          word: {
            language_code: languageCode,
          },
        }),
      };

      // Sum all marks for the user for the target day
      const result = await prisma.wordUserMark.aggregate({
        where: {
          ...baseWhereCondition,
          updated_at: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        _sum: {
          mark: true,
        },
      });

      // Count known words (marks 4 or 5) for this user
      const knownWordsCount = await prisma.wordUserMark.count({
        where: {
          ...baseWhereCondition,
          mark: {
            in: [4, 5],
          },
        },
      });

      const score = Math.ceil((result._sum.mark || 0) / 2);

      return {
        success: true,
        message: 'User statistics retrieved successfully',
        score,
        knownWordsCount,
      };
    } catch (error) {
      console.error('Error retrieving user statistics:', error);
      return {
        success: false,
        message: 'Failed to retrieve user statistics',
      };
    }
  }
}
