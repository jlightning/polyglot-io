import z from 'zod';
import {
  AddSentenceResponseSchema,
  GetSentencesResponseSchema,
  SentenceWithSplitTextSchema,
} from '../services/sentenceService';

export { SentenceWithSplitTextSchema };

export const PaginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

const MarkSchema = z
  .number()
  .int()
  .min(0)
  .max(5)
  .describe(
    "0=Ignore, 1=Don't remember, 2=Hard to remember, 3=Remembered, 4=Easy to remember, 5=No problem"
  );

export const CreateLessonInputSchema = z.object({
  title: z.string().min(1),
  languageCode: z.string().min(1),
  sentences: z.array(z.string().min(1)).optional(),
});

export const CreateLessonOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  lesson: z
    .object({
      id: z.number(),
      title: z.string(),
      languageCode: z.string(),
      processingStatus: z.string(),
      imageUrl: z.string().optional(),
      audioUrl: z.string().optional(),
      createdWithPrompt: z.string().optional(),
      createdAt: z.string(),
    })
    .optional(),
});

export const AddSentenceInputSchema = z.object({
  lessonId: z.number().int().positive(),
  text: z.string().min(1),
});

export const AddSentenceOutputSchema = AddSentenceResponseSchema;

export const MarkWordInputSchema = z.object({
  words: z
    .array(
      z.object({
        word: z.string().min(1),
        languageCode: z.string().min(1),
        mark: MarkSchema,
        note: z.string().optional(),
      })
    )
    .min(1),
});

export const MarkWordOutputSchema = z.object({
  success: z.boolean(),
  results: z.array(
    z.object({
      success: z.boolean(),
      message: z.string().optional(),
      data: z
        .object({
          id: z.number(),
          user_id: z.number(),
          word_id: z.number(),
          note: z.string(),
          mark: z.number(),
          source: z.string().optional(),
          created_at: z.string(),
          updated_at: z.string(),
          word: z
            .object({
              id: z.number(),
              word: z.string(),
              language_code: z.string(),
            })
            .passthrough()
            .optional(),
        })
        .passthrough()
        .optional(),
    })
  ),
});

export const ListLessonsInputSchema = z.object({
  languageCode: z.string().min(1),
  search: z.string().optional(),
  status: z.enum(['reading', 'finished']).optional(),
  type: z.enum(['text', 'subtitle', 'manga', 'manual', 'generated']).optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(1000).optional(),
});

export const ListLessonsOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  lessons: z
    .array(
      z.object({
        id: z.number(),
        title: z.string(),
        languageCode: z.string(),
        lessonType: z.string().optional(),
        processingStatus: z.string(),
        imageUrl: z.string().optional(),
        fileUrl: z.string().optional(),
        audioUrl: z.string().optional(),
        isPinned: z.boolean().optional(),
        createdAt: z.string(),
        userProgress: z
          .object({
            status: z.string(),
            readTillSentenceId: z.number().nullable().optional(),
          })
          .passthrough()
          .optional(),
        createdWithPrompt: z.string().optional(),
        isSplittingSentences: z.boolean().optional(),
        hasUnsplitSentences: z.boolean().optional(),
      })
    )
    .optional(),
  pagination: PaginationSchema.optional(),
});

export const ListSentencesInputSchema = z.object({
  lessonId: z.number().int().positive(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(1000).optional(),
});

export const ListSentencesOutputSchema = GetSentencesResponseSchema;

export const ListWordsInputSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(1000).optional(),
  languageCode: z.string().optional(),
  mark: MarkSchema.optional(),
  words: z.array(z.string().min(1)).optional(),
});

export const ListWordsOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z
    .object({
      wordUserMarks: z.array(
        z
          .object({
            id: z.number(),
            user_id: z.number(),
            word_id: z.number(),
            note: z.string(),
            mark: z.number(),
            source: z.string(),
            created_at: z.string(),
            updated_at: z.string(),
            word: z
              .object({
                id: z.number(),
                word: z.string(),
                language_code: z.string(),
                totalSentenceCount: z.number().optional(),
                translations: z
                  .array(
                    z.object({
                      word: z.string(),
                      translation: z.string(),
                    })
                  )
                  .optional(),
                pronunciations: z
                  .array(
                    z.object({
                      word: z.string(),
                      pronunciation: z.string(),
                      pronunciationType: z.string(),
                    })
                  )
                  .optional(),
              })
              .passthrough(),
          })
          .passthrough()
      ),
      pagination: PaginationSchema,
    })
    .optional(),
});
