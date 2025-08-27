import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

export interface UserScoreResponse {
  success: boolean;
  message: string;
  score?: number;
}

export class UserScoreService {
  /**
   * Calculate user's daily score based on word_user_mark entries for today
   * Score for each day = sum of all marks for that day
   */
  static async getDailyScore(
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

      const score = Math.ceil((result._sum.mark || 0) / 2);

      return {
        success: true,
        message: 'Daily score retrieved successfully',
        score,
      };
    } catch (error) {
      console.error('Error calculating daily score:', error);
      return {
        success: false,
        message: 'Failed to calculate daily score',
      };
    }
  }
}
