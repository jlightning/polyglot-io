import { Prisma, UserActionType } from '@prisma/client';

import { prisma } from './index';

interface WordMarkActionData {
  word_id: number;
  old_mark: number;
  new_mark: number;
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
}
