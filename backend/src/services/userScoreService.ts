import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

import { prisma } from './index';

export interface UserScoreResponse {
  success: boolean;
  message: string;
  score?: number;
  knownWordsCount?: number;
}

export interface DailyScore {
  date: string;
  score: number;
}

export interface ScoreHistoryResponse {
  success: boolean;
  message: string;
  scoreHistory?: DailyScore[];
}

export class UserScoreService {
  /**
   * Get user statistics including user score and known words count
   * User score = sum of (new_mark - old_mark) from user action logs for today
   * Known words count = count of words marked 4 or 5
   * Filtered by language code
   */
  static async getUserStats(
    userId: number,
    languageCode: string,
    date?: Date,
    userTimezone?: string
  ): Promise<UserScoreResponse> {
    try {
      // Use user timezone if provided, otherwise use server timezone
      let targetDate: dayjs.Dayjs;
      if (userTimezone) {
        targetDate = date
          ? dayjs(date).tz(userTimezone)
          : dayjs().tz(userTimezone);
      } else {
        targetDate = date ? dayjs(date) : dayjs();
      }

      // Get start and end of the target day in user's timezone, then convert to UTC
      const startOfDay = targetDate.startOf('day').utc().toDate();
      const endOfDay = targetDate.endOf('day').utc().toDate();

      // Calculate score using raw SQL for better performance
      // Sum of (new_mark - old_mark) from user action logs for the target day
      const scoreResult = await prisma.$queryRaw<{ total_score: number }[]>`
        SELECT COALESCE(SUM(
          CAST(JSON_EXTRACT(action, '$.new_mark') AS SIGNED) - 
          CAST(JSON_EXTRACT(action, '$.old_mark') AS SIGNED)
        ), 0) as total_score
        FROM user_action_log ual
        WHERE ual.user_id = ${userId}
          AND ual.language_code = ${languageCode}
          AND ual.type = 'word_mark'
          AND ual.created_at >= ${startOfDay}
          AND ual.created_at <= ${endOfDay}
      `;

      const score = scoreResult[0]?.total_score || 0;

      // Count known words (marks 4 or 5) for this user
      const knownWordsCount = await prisma.wordUserMark.count({
        where: {
          user_id: userId,
          mark: {
            in: [4, 5],
          },
          word: {
            language_code: languageCode,
          },
        },
      });

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

  /**
   * Get user score history for the last 7 days (including today)
   */
  static async getScoreHistory(
    userId: number,
    languageCode: string,
    userTimezone?: string
  ): Promise<ScoreHistoryResponse> {
    try {
      const scoreHistory: DailyScore[] = [];

      // Get scores for the last 7 days (including today)
      for (let i = 0; i < 7; i++) {
        const targetDate = userTimezone
          ? dayjs().tz(userTimezone).subtract(i, 'days')
          : dayjs().subtract(i, 'days');

        // Get start and end of the target day in user's timezone, then convert to UTC
        const startOfDay = targetDate.startOf('day').utc().toDate();
        const endOfDay = targetDate.endOf('day').utc().toDate();

        // Calculate score for this day
        const scoreResult = await prisma.$queryRaw<{ total_score: number }[]>`
          SELECT COALESCE(SUM(
            CAST(JSON_EXTRACT(action, '$.new_mark') AS SIGNED) - 
            CAST(JSON_EXTRACT(action, '$.old_mark') AS SIGNED)
          ), 0) as total_score
          FROM user_action_log ual
          WHERE ual.user_id = ${userId}
            AND ual.language_code = ${languageCode}
            AND ual.type = 'word_mark'
            AND ual.created_at >= ${startOfDay}
            AND ual.created_at <= ${endOfDay}
        `;

        const score = scoreResult[0]?.total_score || 0;

        scoreHistory.push({
          date: targetDate.format('YYYY-MM-DD'),
          score: Number(score),
        });
      }

      // Reverse array so oldest date comes first
      scoreHistory.reverse();

      return {
        success: true,
        message: 'Score history retrieved successfully',
        scoreHistory,
      };
    } catch (error) {
      console.error('Error retrieving score history:', error);
      return {
        success: false,
        message: 'Failed to retrieve score history',
      };
    }
  }
}
