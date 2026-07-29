import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import pLimit from 'p-limit';
import type { Context } from '../services';
import { PLIMIT_CONCURRENCY } from '../services/consts';
import {
  AddSentenceInputSchema,
  AddSentenceOutputSchema,
  CreateLessonInputSchema,
  CreateLessonOutputSchema,
  DeleteSentenceInputSchema,
  DeleteSentenceOutputSchema,
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
        'Lessons:',
        '- create_lesson requires type: "manual" | "text" | "subtitle".',
        '- type=manual → createManualLesson (empty shell only):',
        '  - Do not send sentences[]; add content later with add_sentence.',
        '- type=text|subtitle → createLesson with that lesson_type:',
        '  - sentences[] required (raw sentence strings).',
        '- Manga/file upload is not supported here.',
        '',
        'Sentences:',
        '- list_sentences returns paginated sentences for a lesson (may trigger server-side splitting).',
        '- add_sentence accepts sentences[] on manual lessons only.',
        '- delete_sentence removes sentenceIds[] from a lesson (manual/manga only).',
        '',
        'Words:',
        '- mark_word sets difficulty 0–5:',
        "  0=Ignore, 1=Don't remember, 2=Hard to remember,",
        '  3=Remembered, 4=Easy to remember, 5=No problem.',
        '- list_words is paginated; supports exact words[] match and mark/language filters.',
        '- No free-text search on list_words.',
        '',
        'After add_sentence:',
        '- Always show the returned words as a numbered list for marking.',
        '- Skip words already marked 5.',
        '- For each shown word display: surface form + hiragana + current mark',
        '  (null = unmarked). Format: 食べる（たべる） — mark 2.',
        '- Prefer hiragana from pronunciations[] when present;',
        '  if missing, infer hiragana yourself (do not leave it blank).',
        '- Ask which marks to change, then call mark_word once with words[].',
        '',
        `List tools default to limit 100.`,
        `languageCode must be one of: ${languageCodeList}.`,
      ].join('\n'),
    }
  );

  server.registerTool(
    'create_lesson',
    {
      description: [
        'Create a lesson. Requires type: "manual" | "text" | "subtitle".',
        'manual → createManualLesson empty shell; do not send sentences[] (use add_sentence).',
        'text|subtitle → createLesson with that lesson_type; sentences[] required.',
        'Manga/file upload not supported.',
      ].join(' '),
      inputSchema: CreateLessonInputSchema,
      outputSchema: CreateLessonOutputSchema,
    },
    async ({ title, languageCode, type, sentences }) => {
      if (type === 'text' || type === 'subtitle') {
        if (!sentences || sentences.length === 0) {
          return toolResult({
            success: false,
            message: `sentences[] is required when type is ${type}`,
          });
        }

        const result = await ctx.lessonService.createLesson(ctx, userId, {
          title,
          languageCode,
          sentences,
          lessonType: type,
        });
        return toolResult(result);
      }

      if (sentences?.length) {
        return toolResult({
          success: false,
          message:
            'sentences[] is not allowed for type=manual; create empty shell then use add_sentence',
        });
      }

      const result = await ctx.lessonService.createManualLesson(ctx, userId, {
        title,
        languageCode,
      });
      return toolResult(result);
    }
  );

  server.registerTool(
    'add_sentence',
    {
      description: [
        'Add one or more sentences to an existing manual lesson (sentences[]).',
        'Word-splitting is performed server-side.',
        'After success, always show the returned words as a numbered list for marking.',
        'Skip words already marked 5.',
        'For each shown word: surface form + hiragana + current mark (null = unmarked).',
        'Format example: 食べる（たべる） — mark 2.',
        'Prefer hiragana from pronunciations[]; if missing, infer it yourself.',
        'Ask which marks to change, then call mark_word once with words[].',
      ].join('\n'),
      inputSchema: AddSentenceInputSchema,
      outputSchema: AddSentenceOutputSchema,
    },
    async ({ lessonId, sentences }) => {
      const limit = pLimit(PLIMIT_CONCURRENCY);
      const results = await Promise.all(
        sentences.map(text =>
          limit(() =>
            ctx.sentenceService.addSentenceToLesson(ctx, lessonId, userId, text)
          )
        )
      );
      return toolResult({
        success: results.every(r => r.success),
        results,
      });
    }
  );

  server.registerTool(
    'delete_sentence',
    {
      description:
        'Delete one or more sentences from a lesson by sentenceIds[]. Supported for manual and manga lessons only.',
      inputSchema: DeleteSentenceInputSchema,
      outputSchema: DeleteSentenceOutputSchema,
    },
    async ({ lessonId, sentenceIds }) => {
      const results = [];
      for (const sentenceId of sentenceIds) {
        const result = await ctx.sentenceService.deleteSentenceFromLesson(
          ctx,
          lessonId,
          sentenceId,
          userId
        );
        results.push({ sentenceId, ...result });
      }
      return toolResult({
        success: results.every(r => r.success),
        results,
      });
    }
  );

  server.registerTool(
    'mark_word',
    {
      description:
        "Create or update word marks (one or many). Scale: 0=Ignore, 1=Don't remember, 2=Hard to remember, 3=Remembered, 4=Easy to remember, 5=No problem.",
      inputSchema: MarkWordInputSchema,
      outputSchema: MarkWordOutputSchema,
    },
    async ({ words }) => {
      const results: Array<{
        success: boolean;
        message?: string;
        data?: Record<string, unknown>;
      }> = [];
      for (const item of words) {
        results.push(
          await ctx.wordService.createOrUpdateWordUserMark(ctx, userId, {
            word: item.word,
            languageCode: item.languageCode,
            mark: item.mark,
            note: item.note ?? '',
          })
        );
      }
      return toolResult({
        success: results.every(r => r.success),
        results,
      });
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
