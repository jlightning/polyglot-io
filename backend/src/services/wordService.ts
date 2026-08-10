import { WordUserMarkSource } from '@prisma/client';

import { withKysely, type Context } from './index';
import { NUMBER_OF_TRANSLATION_TO_REDUCE } from './consts';
import { join } from '@prisma/client/runtime/binary';

interface CreateWordUserMarkData {
  word: string;
  languageCode: string;
  note: string;
  mark: number;
  source?: WordUserMarkSource;
}

export class WordService {
  /**
   * Create or update a word user mark
   * If the word doesn't exist, it will be created first
   */
  async createOrUpdateWordUserMark(
    ctx: Context,
    userId: number,
    data: CreateWordUserMarkData
  ) {
    try {
      // Validate mark is between 0 and 5
      if (data.mark < 0 || data.mark > 5) {
        return {
          success: false,
          message: 'Mark must be between 0 and 5',
        };
      }

      // Use upsert to find or create the word
      const word = await ctx.prisma.word.upsert({
        where: {
          word_language_code: {
            word: data.word,
            language_code: data.languageCode,
          },
        },
        update: {}, // No updates needed for existing words
        create: {
          word: data.word,
          language_code: data.languageCode,
        },
      });

      // Get existing mark value to track changes
      const existingWordUserMark = await ctx.prisma.wordUserMark.findUnique({
        where: {
          user_id_word_id: {
            user_id: userId,
            word_id: word.id,
          },
        },
      });

      const oldMark = existingWordUserMark?.mark || 0;

      if (oldMark === data.mark && existingWordUserMark?.note == data.note)
        return {
          success: true,
          data: existingWordUserMark,
          message: 'Word mark saved successfully',
        };

      // Use proper upsert with the unique constraint on user_id + word_id
      const wordUserMark = await ctx.prisma.wordUserMark.upsert({
        where: {
          user_id_word_id: {
            user_id: userId,
            word_id: word.id,
          },
        },
        update: {
          note: data.note,
          mark: data.mark,
        },
        create: {
          user_id: userId,
          word_id: word.id,
          note: data.note,
          mark: data.mark,
          ...(data.source ? { source: data.source } : {}),
        },
        include: {
          word: true,
        },
      });

      // Log user action
      await ctx.userActionLogService.logWordMarkAction(
        ctx,
        userId,
        data.languageCode,
        {
          word_id: word.id,
          old_mark: oldMark,
          new_mark: data.mark,
        }
      );

      return {
        success: true,
        data: wordUserMark,
        message: 'Word mark saved successfully',
      };
    } catch (error) {
      console.error('Error creating/updating word user mark:', error);
      return {
        success: false,
        message: 'Failed to create/update word mark',
      };
    }
  }

  /**
   * Get word user mark by word and language
   */
  async getWordUserMark(
    ctx: Context,
    userId: number,
    word: string,
    languageCode: string
  ) {
    try {
      const wordUserMark = await ctx.prisma.wordUserMark.findFirst({
        where: {
          user_id: userId,
          word: {
            word: word,
            language_code: languageCode,
          },
        },
        include: {
          word: true,
        },
      });

      return {
        success: true,
        data: wordUserMark,
      };
    } catch (error) {
      console.error('Error getting word user mark:', error);
      return {
        success: false,
        message: 'Failed to get word mark',
      };
    }
  }

  /**
   * Get bulk word user marks by words and language
   */
  async getBulkWordUserMarks(
    ctx: Context,
    userId: number,
    words: string[],
    languageCode: string
  ) {
    try {
      const wordUserMarks = await ctx.prisma.wordUserMark.findMany({
        where: {
          user_id: userId,
          word: {
            word: {
              in: words,
            },
            language_code: languageCode,
          },
        },
        include: {
          word: true,
        },
      });

      const data = wordUserMarks.map(m => ({
        word: m.word.word,
        mark: m.mark,
      }));

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error getting bulk word user marks:', error);
      return {
        success: false,
        message: 'Failed to get bulk word marks',
      };
    }
  }

  /**
   * Get detailed word marks with related sentences and lessons
   */
  async getUserWordMarksWithDetails(
    ctx: Context,
    userId: number,
    page: number = 1,
    limit: number = 50,
    markFilters: number[] | undefined,
    languageFilter: string,
    searchFilter?: string,
    sortBy: string = 'updated_at',
    sortOrder: 'asc' | 'desc' = 'desc',
    words?: string[],
    lessonId?: number
  ) {
    if (!languageFilter) {
      throw new Error('languageFilter is required');
    }

    try {
      let query = withKysely(ctx)
        .selectFrom('word_user_mark as wum')
        .innerJoin('word as w', 'w.id', 'wum.word_id')
        .innerJoin(
          eb =>
            eb
              .selectFrom('sentence_word')
              .innerJoin('sentence', 'sentence.id', 'sentence_word.sentence_id')
              .select('word_id')
              .select(eb =>
                eb.fn
                  .count('sentence.original_text')
                  .distinct()
                  .as('sentence_count')
              )
              .groupBy('word_id')
              .as('word_sentence_count'),
          join => join.onRef('word_sentence_count.word_id', '=', 'wum.word_id')
        )
        .where('wum.user_id', '=', userId)
        .where('w.language_code', '=', languageFilter);

      const skip = (page - 1) * limit;

      if (markFilters !== undefined && markFilters.length > 0) {
        query = query.where('mark', 'in', markFilters);
      }
      if (words && words.length > 0) {
        query = query.where('w.word', 'in', words);
      } else if (searchFilter) {
        query = query.where('w.word', 'like', `%${searchFilter}%`);
      }
      if (lessonId !== undefined) {
        query = query.where(eb =>
          eb(
            'wum.word_id',
            'in',
            eb
              .selectFrom('sentence_word')
              .innerJoin('sentence', 'sentence.id', 'sentence_word.sentence_id')
              .select('sentence_word.word_id')
              .where('sentence.lesson_id', '=', lessonId)
          )
        );
      }

      switch (sortBy) {
        case 'word':
          query = query.orderBy('w.word', sortOrder);
          break;
        case 'mark':
          query = query.orderBy('wum.mark', sortOrder);
          break;

        case 'sentence_count':
          query = query.orderBy(
            'word_sentence_count.sentence_count',
            sortOrder
          );
          break;
        case 'updated_at':
        default:
          query = query.orderBy('wum.updated_at', sortOrder);
      }

      const total = Number(
        (
          await query
            .select(eb => eb.fn.countAll().as('total'))
            .executeTakeFirst()
        )?.total || 0
      );
      const pageData = await query
        .select(['wum.id', 'wum.word_id', 'word_sentence_count.sentence_count'])
        .limit(limit)
        .offset(skip)
        .execute();

      const wordUserMarks = await ctx.prisma.wordUserMark.findMany({
        where: {
          id: { in: pageData.map(i => i.id) },
        },
        include: {
          word: {
            include: {
              wordTranslations: {
                where: {
                  language_code: 'en', // English translations
                },
              },
              wordPronunciations: true, // Include all pronunciations
            },
          },
        },
      });

      const sentenceDataFromDb = await withKysely(ctx)
        .selectFrom('sentence')
        .innerJoin('sentence_word', join =>
          join.onRef('sentence.id', '=', 'sentence_word.sentence_id').on(
            'sentence_word.word_id',
            'in',
            pageData.map(p => p.word_id)
          )
        )
        .innerJoin('lesson', 'lesson.id', 'sentence.lesson_id')
        .select([
          'sentence.original_text',
          'sentence.split_text',
          'sentence_word.word_id',
          'lesson.id as lessonId',
          'lesson.title as lessonTitle',
          'lesson.language_code as lessonLanguageCode',
        ])
        .select(eb => eb.fn.max<number>('sentence.id').as('id'))
        .groupBy([
          'sentence.original_text',
          'sentence.split_text',
          'sentence_word.word_id',
          'sentence.lesson_id',
        ])
        .execute();

      // Prisma `in` does not preserve order — re-sort to match pageData
      const pageOrder = new Map(pageData.map((p, i) => [p.id, i]));
      const transformedData = wordUserMarks
        .sort((a, b) => (pageOrder.get(a.id) ?? 0) - (pageOrder.get(b.id) ?? 0))
        .map(wordMark => {
          const sentences = sentenceDataFromDb
            .filter(i => Number(i.word_id) === Number(wordMark.word.id))
            .map(sw => ({
              id: sw.id,
              original_text: sw.original_text,
              split_text: Array.isArray(sw.split_text)
                ? sw.split_text.filter(
                    (part): part is string => typeof part === 'string'
                  )
                : null,
              lesson: {
                id: sw.lessonId,
                title: sw.lessonTitle,
                language_code: sw.lessonLanguageCode,
              },
            }));

          // Get unique lessons from sentences
          const lessonMap = new Map();
          sentences.forEach(sentence => {
            if (sentence.lesson && !lessonMap.has(sentence.lesson.id)) {
              lessonMap.set(sentence.lesson.id, sentence.lesson);
            }
          });
          const lessons = Array.from(lessonMap.values()).slice(0, 3); // Limit to 3 lessons

          // Transform translations and pronunciations
          const translations = wordMark.word.wordTranslations.map(wt => ({
            word: wordMark.word.word,
            translation: wt.translation,
          }));

          const pronunciations = wordMark.word.wordPronunciations.map(wp => ({
            word: wordMark.word.word,
            pronunciation: wp.pronunciation,
            pronunciationType: wp.pronunciation_type || 'unknown',
          }));

          return {
            ...wordMark,
            word: {
              ...wordMark.word,
              sentences: sentences.slice(0, 3), // Limit to 3 sentences
              totalSentenceCount:
                Number(
                  pageData.find(p => p.id === wordMark.id)?.sentence_count
                ) || 0,
              lessons,
              translations,
              pronunciations,
            },
          };
        });

      return {
        success: true,
        data: {
          wordUserMarks: transformedData,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      console.error('Error getting user word marks with details:', error);
      return {
        success: false,
        message: 'Failed to get user word marks with details',
      };
    }
  }

  /**
   * Get word translations by word and language
   */
  async getWordTranslations(
    ctx: Context,
    word: string,
    sourceLanguage: string,
    targetLanguage: string = 'en'
  ) {
    try {
      const translations = await ctx.prisma.wordTranslation.findMany({
        where: {
          word: {
            word: word,
            language_code: sourceLanguage,
          },
          language_code: targetLanguage,
        },
        include: {
          word: true,
        },
      });

      const translationData = translations.map(t => ({
        word: t.word.word,
        translation: t.translation,
      }));

      // If no translations exist, try to generate them using AI
      if (translationData.length === 0) {
        try {
          const generatedTranslations =
            await ctx.openaiService.getWordTranslation(
              ctx,
              word,
              sourceLanguage,
              targetLanguage
            );

          if (generatedTranslations.length > 0) {
            const data = await this.saveWordTranslations(
              ctx,
              word,
              sourceLanguage,
              targetLanguage,
              generatedTranslations
            );

            return {
              success: true,
              data,
              simplified: false,
            };
          }
        } catch (aiError) {
          console.error('Error generating translations with AI:', aiError);
          // If AI generation fails, return empty array with success: true
          return {
            success: true,
            data: [],
            simplified: false,
          };
        }
      }

      // If there are more than NUMBER_OF_TRANSLATION_TO_REDUCE translations, simplify them using OpenAI
      if (translationData.length >= NUMBER_OF_TRANSLATION_TO_REDUCE) {
        try {
          const translationTexts = translationData.map(t => t.translation);
          const simplifiedTranslations =
            await ctx.openaiService.simplifyTranslations(
              ctx,
              word,
              translationTexts,
              sourceLanguage,
              targetLanguage
            );

          if (!simplifiedTranslations?.length) {
            return {
              success: true,
              data: translationData,
              simplified: false,
            };
          }

          // Update the database with simplified translations
          await this.updateTranslationsInDatabase(
            ctx,
            word,
            sourceLanguage,
            targetLanguage,
            simplifiedTranslations
          );

          // Return the simplified translations
          return {
            success: true,
            data: simplifiedTranslations.map(translation => ({
              word: word,
              translation: translation,
            })),
            simplified: true,
          };
        } catch (simplifyError) {
          console.error('Error simplifying translations:', simplifyError);
          // If simplification fails, return the original translations
          return {
            success: true,
            data: translationData,
            simplified: false,
          };
        }
      }

      return {
        success: true,
        data: translationData,
        simplified: false,
      };
    } catch (error) {
      console.error('Error getting word translations:', error);
      return {
        success: false,
        message: 'Failed to get word translations',
      };
    }
  }

  /**
   * Regenerate word translations using AI, replacing any existing ones
   */
  async reloadWordTranslations(
    ctx: Context,
    word: string,
    sourceLanguage: string,
    targetLanguage: string = 'en'
  ) {
    try {
      const wordRecord = await ctx.prisma.word.findFirst({
        where: {
          word: word,
          language_code: sourceLanguage,
        },
      });

      if (wordRecord) {
        await ctx.prisma.wordTranslation.deleteMany({
          where: {
            word_id: wordRecord.id,
            language_code: targetLanguage,
          },
        });
      }

      const generatedTranslations = await ctx.openaiService.getWordTranslation(
        ctx,
        word,
        sourceLanguage,
        targetLanguage
      );

      if (generatedTranslations.length === 0) {
        return {
          success: true,
          data: [],
          simplified: false,
        };
      }

      const data = await this.saveWordTranslations(
        ctx,
        word,
        sourceLanguage,
        targetLanguage,
        generatedTranslations
      );

      return {
        success: true,
        data,
        simplified: false,
      };
    } catch (error) {
      console.error('Error reloading word translations:', error);
      return {
        success: false,
        message: 'Failed to reload word translations',
      };
    }
  }

  /**
   * Get word pronunciations by word and language
   */
  async getWordPronunciations(
    ctx: Context,
    word: string,
    languageCode: string
  ) {
    try {
      const pronunciations = await ctx.prisma.wordPronunciation.findMany({
        where: {
          word: {
            word: word,
            language_code: languageCode,
          },
        },
        include: {
          word: true,
        },
      });

      // If no pronunciations exist, try to generate one using AI
      if (pronunciations.length === 0) {
        try {
          const pronunciationData =
            await ctx.openaiService.getWordPronunciation(
              ctx,
              word,
              languageCode
            );

          if (pronunciationData) {
            // Ensure the word exists in the database
            const wordRecord = await ctx.prisma.word.upsert({
              where: {
                word_language_code: {
                  word: word,
                  language_code: languageCode,
                },
              },
              update: {}, // No updates needed for existing words
              create: {
                word: word,
                language_code: languageCode,
              },
            });

            // Store the pronunciation
            const trimmedPronunciation = pronunciationData.pronunciation.trim();
            const trimmedPronunciationType =
              pronunciationData.pronunciationType.trim();

            if (trimmedPronunciation && trimmedPronunciationType) {
              await ctx.prisma.wordPronunciation.upsert({
                where: {
                  word_id_pronunciation_pronunciation_type: {
                    word_id: wordRecord.id,
                    pronunciation: trimmedPronunciation,
                    pronunciation_type: trimmedPronunciationType,
                  },
                },
                update: {},
                create: {
                  word_id: wordRecord.id,
                  pronunciation: trimmedPronunciation,
                  pronunciation_type: trimmedPronunciationType,
                },
              });

              // Fetch the newly created pronunciation to return
              const newPronunciation =
                await ctx.prisma.wordPronunciation.findUnique({
                  where: {
                    word_id_pronunciation_pronunciation_type: {
                      word_id: wordRecord.id,
                      pronunciation: trimmedPronunciation,
                      pronunciation_type: trimmedPronunciationType,
                    },
                  },
                  include: {
                    word: true,
                  },
                });

              if (newPronunciation) {
                return {
                  success: true,
                  data: [
                    {
                      word: newPronunciation.word.word,
                      pronunciation: newPronunciation.pronunciation,
                      pronunciationType:
                        newPronunciation.pronunciation_type || 'unknown',
                    },
                  ],
                };
              }
            }
          }
        } catch (aiError) {
          console.error('Error generating pronunciation with AI:', aiError);
          // If AI generation fails, return empty array with success: true
          return {
            success: true,
            data: [],
          };
        }
      }

      return {
        success: true,
        data: pronunciations.map(p => ({
          word: p.word.word,
          pronunciation: p.pronunciation,
          pronunciationType: p.pronunciation_type || 'unknown',
        })),
      };
    } catch (error) {
      console.error('Error getting word pronunciations:', error);
      return {
        success: false,
        message: 'Failed to get word pronunciations',
      };
    }
  }

  /**
   * Get word stems by word and language
   */
  async getWordStems(ctx: Context, word: string, languageCode: string) {
    try {
      const stems = await ctx.prisma.wordStem.findMany({
        where: {
          word: {
            word: word,
            language_code: languageCode,
          },
        },
        include: {
          word: true,
        },
      });

      return {
        success: true,
        data: stems.map(s => ({
          word: s.word.word,
          stems: [s.stem],
        })),
      };
    } catch (error) {
      console.error('Error getting word stems:', error);
      return {
        success: false,
        message: 'Failed to get word stems',
      };
    }
  }

  private async saveWordTranslations(
    ctx: Context,
    word: string,
    sourceLanguage: string,
    targetLanguage: string,
    translations: string[]
  ): Promise<Array<{ word: string; translation: string }>> {
    const wordRecord = await ctx.prisma.word.upsert({
      where: {
        word_language_code: {
          word: word,
          language_code: sourceLanguage,
        },
      },
      update: {},
      create: {
        word: word,
        language_code: sourceLanguage,
      },
    });

    const savedTranslations: string[] = [];

    for (const translation of translations) {
      const trimmedTranslation = translation.trim();
      if (trimmedTranslation) {
        await ctx.prisma.wordTranslation.upsert({
          where: {
            word_id_language_code_translation: {
              word_id: wordRecord.id,
              language_code: targetLanguage,
              translation: trimmedTranslation,
            },
          },
          update: {},
          create: {
            word_id: wordRecord.id,
            language_code: targetLanguage,
            translation: trimmedTranslation,
          },
        });
        savedTranslations.push(trimmedTranslation);
      }
    }

    return savedTranslations.map(translation => ({
      word,
      translation,
    }));
  }

  /**
   * Update translations in database by replacing old ones with simplified ones
   */
  private async updateTranslationsInDatabase(
    ctx: Context,
    word: string,
    sourceLanguage: string,
    targetLanguage: string,
    simplifiedTranslations: string[]
  ): Promise<void> {
    try {
      // First, get the word ID
      const wordRecord = await ctx.prisma.word.findFirst({
        where: {
          word: word,
          language_code: sourceLanguage,
        },
      });

      if (!wordRecord) {
        throw new Error(`Word "${word}" not found in database`);
      }

      // Delete existing translations for this word and target language
      await ctx.prisma.wordTranslation.deleteMany({
        where: {
          word_id: wordRecord.id,
          language_code: targetLanguage,
        },
      });

      // Insert the simplified translations
      await ctx.prisma.wordTranslation.createMany({
        data: simplifiedTranslations.map(translation => ({
          word_id: wordRecord.id,
          language_code: targetLanguage,
          translation: translation,
        })),
      });
    } catch (error) {
      console.error('Error updating translations in database:', error);
      throw error;
    }
  }
}
