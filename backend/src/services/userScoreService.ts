import { PrismaClient } from '@prisma/client';

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
      const targetDate = date || new Date();

      // Get start and end of the target day
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

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

      const score = result._sum.mark || 0;

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
