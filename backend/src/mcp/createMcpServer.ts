import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Context } from '../services';
import {
  AddSentenceInputSchema,
  AddSentenceOutputSchema,
  CreateLessonInputSchema,
  CreateLessonOutputSchema,
  ListLessonsInputSchema,
  ListLessonsOutputSchema,
  ListSentencesInputSchema,
  ListSentencesOutputSchema,
  ListWordsInputSchema,
  ListWordsOutputSchema,
  MarkWordInputSchema,
  MarkWordOutputSchema,
} from './schemas';

function toolResult(data: unknown) {
  const structuredContent = JSON.parse(JSON.stringify(data)) as Record<
    string,
    unknown
  >;
  return {
    structuredContent,
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(structuredContent, null, 2),
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
      inputSchema: CreateLessonInputSchema,
      outputSchema: CreateLessonOutputSchema,
    },
    async ({ title, languageCode, sentences }) => {
      const result = await ctx.lessonService.createManualLesson(ctx, userId, {
        title,
        languageCode,
        ...(sentences && sentences.length > 0 ? { sentences } : {}),
      });
      return toolResult(result);
    }
  );

  server.registerTool(
    'add_sentence',
    {
      description:
        'Add a sentence to an existing manual lesson. Word-splitting is performed server-side.',
      inputSchema: AddSentenceInputSchema,
      outputSchema: AddSentenceOutputSchema,
    },
    async ({ lessonId, text }) => {
      const result = await ctx.sentenceService.addSentenceToLesson(
        ctx,
        lessonId,
        userId,
        text
      );
      return toolResult(result);
    }
  );

  server.registerTool(
    'mark_word',
    {
      description:
        "Create or update a word mark. Scale: 0=Ignore, 1=Don't remember, 2=Hard to remember, 3=Remembered, 4=Easy to remember, 5=No problem.",
      inputSchema: MarkWordInputSchema,
      outputSchema: MarkWordOutputSchema,
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
      return toolResult(result);
    }
  );

  server.registerTool(
    'list_lessons',
    {
      description:
        'List lessons for a language with optional search/status/type filters. Paginated (default limit 100).',
      inputSchema: ListLessonsInputSchema,
      outputSchema: ListLessonsOutputSchema,
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
      return toolResult(result);
    }
  );

  server.registerTool(
    'list_sentences',
    {
      description:
        'List sentences for a lesson (paginated, default limit 100). May trigger server-side word-splitting for unsplit sentences.',
      inputSchema: ListSentencesInputSchema,
      outputSchema: ListSentencesOutputSchema,
    },
    async ({ lessonId, page, limit }) => {
      const result = await ctx.sentenceService.getLessonSentences(
        ctx,
        lessonId,
        userId,
        page ?? 1,
        limit ?? 100
      );
      return toolResult(result);
    }
  );

  server.registerTool(
    'list_words',
    {
      description:
        'List marked words with pagination (default limit 100). No search. Optional exact-match words list, language, and mark filter.',
      inputSchema: ListWordsInputSchema,
      outputSchema: ListWordsOutputSchema,
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
      return toolResult(result);
    }
  );

  return server;
}
