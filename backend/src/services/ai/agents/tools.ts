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

export const listUserWordsTool = tool({
  name: 'list_user_words',
  description:
    "List this user's marked words in the lesson language. Filter by mark, search by word substring, and sort by last mark date (updated_at) ascending or descending.",
  parameters: z.object({
    marks: z
      .array(z.number().int().min(0).max(5))
      .describe(
        "Marks to include (0=Ignore, 1=Don't remember, 2=Hard to remember, 3=Remembered, 4=Easy to remember, 5=No problem). Empty array means all marks."
      ),
    search: z
      .string()
      .describe(
        'Substring matched against the word surface form. Empty string means no search.'
      ),
    sort: z
      .enum(['asc', 'desc'])
      .describe(
        'Sort by last mark date. asc = oldest mark first, desc = newest mark first.'
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .describe('Maximum words to return (1-100).'),
  }),
  execute: async (
    { marks, search, sort, limit },
    runContext?: RunContext<CheckUserWordMarksContext>
  ) => {
    const ctx = runContext?.context;
    if (!ctx) {
      console.log('list_user_words', { missingContext: true });
      return { words: [] };
    }

    const trimmedSearch = search.trim();
    const wordUserMarks = await ctx.prisma.wordUserMark.findMany({
      where: {
        user_id: ctx.userId,
        ...(marks.length > 0 ? { mark: { in: marks } } : {}),
        word: {
          language_code: ctx.languageCode,
          ...(trimmedSearch ? { word: { contains: trimmedSearch } } : {}),
        },
      },
      include: { word: true },
      orderBy: { updated_at: sort },
      take: limit,
    });
    const words = wordUserMarks.map(m => ({
      word: m.word.word,
      mark: m.mark,
      lastMarkDate: m.updated_at.toISOString(),
    }));

    console.log('list_user_words', {
      userId: ctx.userId,
      languageCode: ctx.languageCode,
      marks,
      search: trimmedSearch,
      sort,
      words,
    });

    return { words };
  },
});
