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
  type: z
    .enum(['manual', 'text', 'subtitle'])
    .describe(
      'manual → createManualLesson; text|subtitle → createLesson with that lesson_type'
    ),
  sentences: z
    .array(z.string().min(1))
    .optional()
    .describe(
      'Required for text|subtitle. Do not send for manual (use add_sentence after create).'
    ),
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
  sentences: z.array(z.string().min(1)).min(1),
});

export const AddSentenceOutputSchema = z.object({
  success: z.boolean(),
  results: z.array(AddSentenceResponseSchema),
});

export const DeleteSentenceInputSchema = z.object({
  lessonId: z.number().int().positive(),
  sentenceIds: z.array(z.number().int().positive()).min(1),
});

export const DeleteSentenceOutputSchema = z.object({
  success: z.boolean(),
  results: z.array(
    z.object({
      sentenceId: z.number(),
      success: z.boolean(),
      message: z.string().optional(),
    })
  ),
});

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
  languageCode: z.string().min(1),
  marks: z
    .array(MarkSchema)
    .max(6)
    .optional()
    .describe(
      'Filter by difficulty marks (0–5). Omit or [] for all marks. Example: [1, 2]'
    ),
  words: z.array(z.string().min(1)).optional(),
  lessonId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Only marked words that appear in at least one sentence of this lesson'
    ),
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
