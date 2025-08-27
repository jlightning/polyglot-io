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
   * Get user statistics including daily score and known words count
   * Daily score = sum of all marks for today divided by 2 (rounded up)
   * Known words count = count of words marked 4 or 5
   */
  static async getUserStats(
    userId: number,
    date?: Date
  ): Promise<UserScoreResponse> {
    try {
      const targetDate = date ? dayjs(date) : dayjs();

      // Get start and end of the target day
      const startOfDay = targetDate.startOf('day').toDate();
      const endOfDay = targetDate.endOf('day').toDate();

      // Sum all marks for the user for the target day
      const result = await prisma.wordUserMark.aggregate({
        where: {
          user_id: userId,
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
          user_id: userId,
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
