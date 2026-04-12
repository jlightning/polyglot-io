import { Prisma, UserActionType } from '@prisma/client';

import type { Context } from './index';
import { wrapInTransaction } from './db';

interface WordMarkActionData {
  word_id: number;
  old_mark: number;
  new_mark: number;
}

interface ReadActionData {
  word: string;
  sentence_id: number;
}

export class UserActionLogService {
  /**
   * Log a word mark action when a user marks or updates a word
   */
  async logWordMarkAction(
    ctx: Context,
    userId: number,
    languageCode: string,
    actionData: WordMarkActionData
  ) {
    try {
      const userAction = await ctx.prisma.userActionLog.create({
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
  async logReadAction(
    ctx: Context,
    userId: number,
    languageCode: string,
    actionData: ReadActionData
  ) {
    try {
      // Look up or create the word to get word_id
      const word = await ctx.prisma.word.findUnique({
        where: {
          word_language_code: {
            word: actionData.word,
            language_code: languageCode,
          },
        },
      });

      if (!word) return { success: true, data: null };

      const userAction = await ctx.prisma.userActionLog.upsert({
        where: {
          is_read_user_id_word_id_sentence_id: {
            is_read: true,
            user_id: userId,
            sentence_id: actionData.sentence_id,
            word_id: word.id,
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
  async getActionHistoryByWord(
    ctx: Context,
    userId: number,
    word: string,
    languageCode: string
  ) {
    try {
      const wordRecord = await ctx.prisma.word.findUnique({
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

      const logs = await ctx.prisma.userActionLog.findMany({
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

  async cleanUpDuplicatedLog(ctx: Context) {
    console.log('cleanUpDuplicatedLog: starting');

    const tmp = await ctx.prisma.$queryRaw<
      { ids: string; user_id: number; word_id: number; created_date: string }[]
    >`
      SELECT
        GROUP_CONCAT(id) AS ids,
        user_id,
        word_id,
        DATE_FORMAT(CONVERT_TZ(created_at, 'UTC', 'Asia/Singapore'), '%Y-%m-%d') AS created_date
      FROM user_action_log ual
      WHERE type = ${UserActionType.word_mark}
      GROUP BY user_id, word_id, DATE_FORMAT(CONVERT_TZ(created_at, 'UTC', 'Asia/Singapore'), '%Y-%m-%d')
      HAVING COUNT(1) > 1
    `;

    const data = tmp
      .map(i => ({ ...i, ids: i.ids.split(',').map(Number) }))
      .filter(i => i.ids?.length > 1);

    console.log('cleanUpDuplicatedLog: duplicate groups to process', {
      count: data.length,
    });

    for (const item of data) {
      const logs = await ctx.prisma.userActionLog.findMany({
        where: {
          id: { in: item.ids },
        },
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      });

      const firstLog = logs[0];
      const lastLog = logs[logs.length - 1];

      if (!firstLog || !lastLog) continue;

      const oldMark = (firstLog.action as unknown as WordMarkActionData)
        ?.old_mark;
      const newMark = (lastLog.action as unknown as WordMarkActionData)
        ?.new_mark;

      if (typeof oldMark !== 'number' || typeof newMark !== 'number') continue;

      await wrapInTransaction(ctx, async ctx => {
        if (oldMark === newMark) {
          await ctx.prisma.userActionLog.deleteMany({
            where: {
              id: { in: logs.map(l => l.id) },
            },
          });

          console.log(
            'cleanUpDuplicatedLog: removed redundant word_mark logs (same old/new)',
            {
              user_id: item.user_id,
              word_id: item.word_id,
              created_date: item.created_date,
              removedCount: logs.length,
            }
          );

          return;
        }

        await ctx.prisma.userActionLog.update({
          where: {
            id: lastLog.id,
          },
          data: {
            action: {
              ...(lastLog?.action as unknown as WordMarkActionData),
              old_mark: oldMark,
              new_mark: newMark,
            },
          },
        });

        await ctx.prisma.userActionLog.deleteMany({
          where: {
            id: { in: logs.map(l => l.id).filter(lid => lid !== lastLog.id) },
          },
        });

        console.log(
          'cleanUpDuplicatedLog: merged word_mark logs into one entry',
          {
            user_id: item.user_id,
            word_id: item.word_id,
            created_date: item.created_date,
            keptLogId: lastLog.id,
            removedCount: logs.length - 1,
            oldMark,
            newMark,
          }
        );
      });
    }

    console.log('cleanUpDuplicatedLog: finished');
  }
}
