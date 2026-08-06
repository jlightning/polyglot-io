import { RunContext, tool } from '@openai/agents';
import { PrismaClient } from '@prisma/client';
import z from 'zod';

export type CheckUserWordMarksContext = {
  languageCode: string;
  userId: number;
  prisma: PrismaClient;
};

export const checkUserWordMarksTool = tool({
  name: 'check_user_word_marks',
  description:
    'Look up the current user mark (0-5) for candidate word surface forms. Pass all candidates in one call. Returns mark per word, or null if the user has no mark for that word.',
  parameters: z.object({
    words: z
      .array(z.string())
      .describe('Candidate word surface forms to look up in one batch'),
  }),
  execute: async (
    { words },
    runContext?: RunContext<CheckUserWordMarksContext>
  ) => {
    const ctx = runContext?.context;
    if (!ctx) {
      const results = words.map(word => ({ word, mark: null }));
      console.log('check_user_word_marks', { missingContext: true, results });
      return { results };
    }

    const wordUserMarks = await ctx.prisma.wordUserMark.findMany({
      where: {
        user_id: ctx.userId,
        word: {
          word: { in: words },
          language_code: ctx.languageCode,
        },
      },
      include: { word: true },
    });
    const markByWord = new Map(wordUserMarks.map(m => [m.word.word, m.mark]));
    const results = words.map(word => ({
      word,
      mark: markByWord.get(word) ?? null,
    }));

    console.log('check_user_word_marks', {
      userId: ctx.userId,
      languageCode: ctx.languageCode,
      results,
    });

    return { results };
  },
});
