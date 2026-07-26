import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import z from 'zod';
import type { Context } from '../services';

function textResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function createPolyglotMcpServer(
  ctx: Context,
  userId: number
): McpServer {
  const enabledLanguages = ctx.configService.getEnabledLanguages(ctx);
  const languageCodeList = enabledLanguages
    .map(lang => `${lang.code} (${lang.name})`)
    .join(', ');

  const server = new McpServer(
    {
      name: 'polyglot',
      version: '1.0.0',
    },
    {
      instructions: [
        'Polyglot is a language-learning app for reading lessons and tracking word knowledge.',
        "This MCP server lets you manage the authenticated user's lessons, sentences, and word marks.",
        '',
        'Lessons: create_lesson always creates a manual lesson. Pass optional sentences[] to seed content (server word-splits each sentence). Omit sentences for an empty shell, then use add_sentence. Manga/file/generated lesson creation is not supported here.',
        'Sentences: list_sentences returns paginated sentences for a lesson (may trigger server-side splitting). add_sentence works only on manual lessons.',
        "Words: mark_word sets difficulty 0–5 (0=Ignore, 1=Don't remember, 2=Hard to remember, 3=Remembered, 4=Easy to remember, 5=No problem). list_words is paginated, supports exact words[] match and mark/language filters — no free-text search.",
        `List tools default to limit 100. languageCode must be one of the enabled languages: ${languageCodeList}.`,
      ].join('\n'),
    }
  );

  server.registerTool(
    'create_lesson',
    {
      description:
        'Create a manual lesson. Optionally include sentences (word-splitting is server-side). Omitting sentences creates an empty manual lesson.',
      inputSchema: {
        title: z.string().min(1),
        languageCode: z.string().min(1),
        sentences: z.array(z.string().min(1)).optional(),
      },
    },
    async ({ title, languageCode, sentences }) => {
      const result = await ctx.lessonService.createManualLesson(ctx, userId, {
        title,
        languageCode,
        ...(sentences && sentences.length > 0 ? { sentences } : {}),
      });
      return textResult(result);
    }
  );

  server.registerTool(
    'add_sentence',
    {
      description:
        'Add a sentence to an existing manual lesson. Word-splitting is performed server-side.',
      inputSchema: {
        lessonId: z.number().int().positive(),
        text: z.string().min(1),
      },
    },
    async ({ lessonId, text }) => {
      const result = await ctx.sentenceService.addSentenceToLesson(
        ctx,
        lessonId,
        userId,
        text
      );
      return textResult(result);
    }
  );

  server.registerTool(
    'mark_word',
    {
      description:
        "Create or update a word mark. Scale: 0=Ignore, 1=Don't remember, 2=Hard to remember, 3=Remembered, 4=Easy to remember, 5=No problem.",
      inputSchema: {
        word: z.string().min(1),
        languageCode: z.string().min(1),
        mark: z
          .number()
          .int()
          .min(0)
          .max(5)
          .describe(
            "0=Ignore, 1=Don't remember, 2=Hard to remember, 3=Remembered, 4=Easy to remember, 5=No problem"
          ),
        note: z.string().optional(),
      },
    },
    async ({ word, languageCode, mark, note }) => {
      const result = await ctx.wordService.createOrUpdateWordUserMark(
        ctx,
        userId,
        {
          word,
          languageCode,
          mark,
          note: note ?? '',
        }
      );
      return textResult(result);
    }
  );

  server.registerTool(
    'list_lessons',
    {
      description:
        'List lessons for a language with optional search/status/type filters. Paginated (default limit 100).',
      inputSchema: {
        languageCode: z.string().min(1),
        search: z.string().optional(),
        status: z.enum(['reading', 'finished']).optional(),
        type: z
          .enum(['text', 'subtitle', 'manga', 'manual', 'generated'])
          .optional(),
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(1000).optional(),
      },
    },
    async ({ languageCode, search, status, type, page, limit }) => {
      const result = await ctx.lessonService.getLessonsByLanguage(
        ctx,
        userId,
        languageCode,
        {
          page: page ?? 1,
          limit: limit ?? 100,
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
          ...(type ? { type } : {}),
        }
      );
      return textResult(result);
    }
  );

  server.registerTool(
    'list_sentences',
    {
      description:
        'List sentences for a lesson (paginated, default limit 100). May trigger server-side word-splitting for unsplit sentences.',
      inputSchema: {
        lessonId: z.number().int().positive(),
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(1000).optional(),
      },
    },
    async ({ lessonId, page, limit }) => {
      const result = await ctx.sentenceService.getLessonSentences(
        ctx,
        lessonId,
        userId,
        page ?? 1,
        limit ?? 100
      );
      return textResult(result);
    }
  );

  server.registerTool(
    'list_words',
    {
      description:
        'List marked words with pagination (default limit 100). No search. Optional exact-match words list, language, and mark filter.',
      inputSchema: {
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(1000).optional(),
        languageCode: z.string().optional(),
        mark: z
          .number()
          .int()
          .min(0)
          .max(5)
          .optional()
          .describe(
            "Filter by mark: 0=Ignore, 1=Don't remember, 2=Hard to remember, 3=Remembered, 4=Easy to remember, 5=No problem"
          ),
        words: z.array(z.string().min(1)).optional(),
      },
    },
    async ({ page, limit, languageCode, mark, words }) => {
      const result = await ctx.wordService.getUserWordMarksWithDetails(
        ctx,
        userId,
        page ?? 1,
        limit ?? 100,
        mark,
        languageCode,
        undefined,
        'updated_at',
        'desc',
        words
      );
      return textResult(result);
    }
  );

  return server;
}
