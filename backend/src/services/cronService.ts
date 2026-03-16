import cron from 'node-cron';
import type { Context } from './index';
import { wrapInTransaction } from './db';
import { NUMBER_OF_TRANSLATION_TO_REDUCE } from './consts';
import {
  halfWidthToFullWidthKatakana,
  voicedMarkMap,
} from './textProcessingService';

export class CronService {
  registerCron(ctx: Context): void {
    this.registerWordTranslationCleaningCron(ctx);
    this.registerKatakanaNormalizationCron(ctx);
  }

  registerWordTranslationCleaningCron(ctx: Context): void {
    let isRunning = false;

    cron.schedule('*/30 * * * *', async () => {
      if (isRunning) return;
      isRunning = true;

      console.log('Running registerWordTranslationCleaningCron');

      try {
        const wordIdsToProcess = await ctx.prisma.wordTranslation.groupBy({
          by: 'word_id',
          _count: {
            id: true,
          },
          having: {
            translation: {
              _count: {
                gt: NUMBER_OF_TRANSLATION_TO_REDUCE,
              },
            },
          },
        });

        const words = await ctx.prisma.word.findMany({
          where: {
            id: { in: wordIdsToProcess.map(w => w.word_id) },
          },
        });

        for (let i = 0; i < words.length; i++) {
          const word = words[i]!;
          console.log(
            `Processing word translations (${i + 1}/${words.length}) for: ${word.word} (${word.language_code}) that has ${wordIdsToProcess.find(w => w.word_id === word.id)?._count} translations`
          );
          await ctx.wordService.getWordTranslations(
            ctx,
            word.word,
            word.language_code
          );
        }
      } finally {
        isRunning = false;
      }
    });
  }

  /**
   * Normalize katakana words: convert half-width to full-width and merge related data
   */
  private async normalizeKatakanaWords(ctx: Context): Promise<void> {
    // Get all half-width katakana characters from exported constants
    const halfWidthChars = [
      ...Object.keys(halfWidthToFullWidthKatakana),
      ...Object.keys(voicedMarkMap),
    ];

    // Build OR conditions for Prisma contains filter
    const orConditions = halfWidthChars.map(char => ({
      word: { contains: char },
    }));

    // Find all Japanese words containing half-width katakana using Prisma contains
    const wordsToNormalize = await ctx.prisma.word.findMany({
      where: {
        language_code: 'ja',
        OR: orConditions,
      },
      select: {
        id: true,
        word: true,
        language_code: true,
      },
    });

    console.log(
      `Found ${wordsToNormalize.length} words with half-width katakana to normalize`
    );

    for (let i = 0; i < wordsToNormalize.length; i++) {
      const halfWidthWord = wordsToNormalize[i]!;
      const normalizedWordText = ctx.textProcessingService.normalizeKatakana(
        ctx,
        halfWidthWord.word
      );

      // Skip if normalization didn't change the word
      if (normalizedWordText === halfWidthWord.word) {
        continue;
      }

      console.log(
        `Processing (${i + 1}/${wordsToNormalize.length}): "${halfWidthWord.word}" -> "${normalizedWordText}"`
      );

      try {
        await wrapInTransaction(ctx, async ctx => {
          // Find or create the full-width word
          const fullWidthWord = await ctx.prisma.word.upsert({
            where: {
              word_language_code: {
                word: normalizedWordText,
                language_code: 'ja',
              },
            },
            update: {
              word: normalizedWordText,
            },
            create: {
              word: normalizedWordText,
              language_code: 'ja',
            },
          });

          // If the full-width word is the same as half-width word (same ID), skip
          if (fullWidthWord.id === halfWidthWord.id) {
            return;
          }

          // Merge WordStem records
          const halfWidthStems = await ctx.prisma.wordStem.findMany({
            where: { word_id: halfWidthWord.id },
          });

          for (const stem of halfWidthStems) {
            const existingStem = await ctx.prisma.wordStem.findUnique({
              where: {
                word_id_stem: {
                  word_id: fullWidthWord.id,
                  stem: stem.stem,
                },
              },
            });

            if (!existingStem) {
              await ctx.prisma.wordStem.create({
                data: {
                  word_id: fullWidthWord.id,
                  stem: stem.stem,
                },
              });
            }
          }

          // Merge WordPronunciation records
          const halfWidthPronunciations =
            await ctx.prisma.wordPronunciation.findMany({
              where: { word_id: halfWidthWord.id },
            });

          for (const pronunciation of halfWidthPronunciations) {
            // Check if pronunciation already exists
            const existing = await ctx.prisma.wordPronunciation.findFirst({
              where: {
                word_id: fullWidthWord.id,
                pronunciation: pronunciation.pronunciation,
                pronunciation_type: pronunciation.pronunciation_type,
              },
            });

            if (!existing) {
              await ctx.prisma.wordPronunciation.create({
                data: {
                  word_id: fullWidthWord.id,
                  pronunciation: pronunciation.pronunciation,
                  pronunciation_type: pronunciation.pronunciation_type,
                },
              });
            }
          }

          // Merge WordTranslation records
          const halfWidthTranslations =
            await ctx.prisma.wordTranslation.findMany({
              where: { word_id: halfWidthWord.id },
            });

          for (const translation of halfWidthTranslations) {
            const existingTranslation =
              await ctx.prisma.wordTranslation.findUnique({
                where: {
                  word_id_language_code_translation: {
                    word_id: fullWidthWord.id,
                    language_code: translation.language_code,
                    translation: translation.translation,
                  },
                },
              });

            if (!existingTranslation) {
              await ctx.prisma.wordTranslation.create({
                data: {
                  word_id: fullWidthWord.id,
                  language_code: translation.language_code,
                  translation: translation.translation,
                },
              });
            }
          }

          // Merge WordUserMark records
          const halfWidthUserMarks = await ctx.prisma.wordUserMark.findMany({
            where: { word_id: halfWidthWord.id },
          });

          for (const userMark of halfWidthUserMarks) {
            // Check if full-width word already has a mark from this user
            const existingMark = await ctx.prisma.wordUserMark.findUnique({
              where: {
                user_id_word_id: {
                  user_id: userMark.user_id,
                  word_id: fullWidthWord.id,
                },
              },
            });

            if (existingMark) {
              // Keep the one with higher mark, or most recent if marks are equal
              if (
                userMark.mark > existingMark.mark ||
                (userMark.mark === existingMark.mark &&
                  userMark.updated_at > existingMark.updated_at)
              ) {
                await ctx.prisma.wordUserMark.update({
                  where: {
                    user_id_word_id: {
                      user_id: userMark.user_id,
                      word_id: fullWidthWord.id,
                    },
                  },
                  data: {
                    mark: userMark.mark,
                    note: userMark.note,
                    source: userMark.source,
                    updated_at: userMark.updated_at,
                  },
                });
              }
            } else {
              // No existing mark, create new one
              await ctx.prisma.wordUserMark.create({
                data: {
                  user_id: userMark.user_id,
                  word_id: fullWidthWord.id,
                  mark: userMark.mark,
                  note: userMark.note,
                  source: userMark.source,
                },
              });
            }
          }

          // Update SentenceWord references
          const halfWidthSentenceWords = await ctx.prisma.sentenceWord.findMany(
            {
              where: { word_id: halfWidthWord.id },
            }
          );

          for (const sentenceWord of halfWidthSentenceWords) {
            const existingSentenceWord =
              await ctx.prisma.sentenceWord.findUnique({
                where: {
                  word_id_sentence_id: {
                    word_id: fullWidthWord.id,
                    sentence_id: sentenceWord.sentence_id,
                  },
                },
              });

            if (!existingSentenceWord) {
              await ctx.prisma.sentenceWord.create({
                data: {
                  word_id: fullWidthWord.id,
                  sentence_id: sentenceWord.sentence_id,
                },
              });
            }
          }

          // Delete old SentenceWord records
          await ctx.prisma.sentenceWord.deleteMany({
            where: { word_id: halfWidthWord.id },
          });

          // Delete all related records for the half-width word before deleting the word
          await ctx.prisma.wordStem.deleteMany({
            where: { word_id: halfWidthWord.id },
          });

          await ctx.prisma.wordPronunciation.deleteMany({
            where: { word_id: halfWidthWord.id },
          });

          await ctx.prisma.wordTranslation.deleteMany({
            where: { word_id: halfWidthWord.id },
          });

          await ctx.prisma.wordUserMark.deleteMany({
            where: { word_id: halfWidthWord.id },
          });

          // Now delete the half-width word
          await ctx.prisma.word.delete({
            where: { id: halfWidthWord.id },
          });
        });

        console.log(
          `Successfully normalized "${halfWidthWord.word}" to "${normalizedWordText}"`
        );
      } catch (error) {
        console.error(`Error normalizing word "${halfWidthWord.word}":`, error);
      }
    }
  }

  registerKatakanaNormalizationCron(ctx: Context): void {
    let isRunning = false;

    cron.schedule('*/30 * * * *', async () => {
      if (isRunning) return;
      isRunning = true;

      console.log('Running katakana normalization cron');

      try {
        await this.normalizeKatakanaWords(ctx);
      } catch (error) {
        console.error('Error in katakana normalization cron:', error);
      } finally {
        isRunning = false;
      }
    });
  }
}
