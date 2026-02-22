import { Prisma, UserActionType } from '@prisma/client';

import { prisma } from './index';

interface WordMarkActionData {
  word_id: number;
  old_mark: number;
  new_mark: number;
}

interface ReadActionData {
  word_id: number;
  sentence_id: number;
}

export class UserActionLogService {
  /**
   * Log a word mark action when a user marks or updates a word
   */
  static async logWordMarkAction(
    userId: number,
    languageCode: string,
    actionData: WordMarkActionData
  ) {
    try {
      const userAction = await prisma.userActionLog.create({
        data: {
          user_id: userId,
          language_code: languageCode,
          type: UserActionType.word_mark,
          action: actionData as unknown as Prisma.JsonObject,
        },
      });

      console.log(`Word mark action logged for user ${userId}:`, {
        userActionId: userAction.id,
        actionData,
      });

      return {
        success: true,
        data: userAction,
      };
    } catch (error) {
      console.error('Error logging word mark action:', error);
      return {
        success: false,
        message: 'Failed to log word mark action',
      };
    }
  }

  /**
   * Log a read action when a user clicks on a word
   */
  static async logReadAction(
    userId: number,
    languageCode: string,
    actionData: ReadActionData
  ) {
    try {
      const userAction = await prisma.userActionLog.upsert({
        where: {
          is_read_user_id_word_id_sentence_id: {
            is_read: true,
            user_id: userId,
            sentence_id: actionData.sentence_id,
            word_id: actionData.word_id,
          },
        },
        create: {
          user_id: userId,
          language_code: languageCode,
          type: UserActionType.read,
          action: actionData as unknown as Prisma.JsonObject,
        },
        update: {},
      });

      console.log(`Read action logged for user ${userId}:`, {
        userActionId: userAction.id,
        actionData,
      });

      return {
        success: true,
        data: userAction,
      };
    } catch (error) {
      console.error('Error logging read action:', error);
      return {
        success: false,
        message: 'Failed to log read action',
      };
    }
  }

  /**
   * Get action history for a word for the current user (word_mark and read entries)
   */
  static async getActionHistoryByWord(
    userId: number,
    word: string,
    languageCode: string
  ) {
    try {
      const wordRecord = await prisma.word.findUnique({
        where: {
          word_language_code: {
            word,
            language_code: languageCode,
          },
        },
      });

      if (!wordRecord) {
        return { success: true, data: [] };
      }

      const logs = await prisma.userActionLog.findMany({
        where: {
          user_id: userId,
          word_id: wordRecord.id,
        },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          type: true,
          action: true,
          created_at: true,
          sentence_id: true,
        },
      });

      return {
        success: true,
        data: logs,
      };
    } catch (error) {
      console.error('Error getting action history by word:', error);
      return {
        success: false,
        message: 'Failed to get action history',
        data: [],
      };
    }
  }
}
