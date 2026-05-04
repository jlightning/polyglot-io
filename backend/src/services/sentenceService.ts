import type { Context } from './index';
import { wrapInTransaction } from './db';

export interface WordWithTranslation {
  word: string;
  translation: string;
}

export interface WordWithPronunciation {
  word: string;
  pronunciation: string;
  pronunciationType: string;
}

export interface WordWithStems {
  word: string;
  stems: string[];
}

export interface SentenceWithSplitText {
  id: number;
  original_text: string;
  split_text: string[] | null;
  word_translations?: WordWithTranslation[] | null;
  word_pronunciations?: WordWithPronunciation[] | null;
  word_stems?: WordWithStems[] | null;
  start_time: number | null;
  end_time: number | null;
  translation?: string | null;
}

export interface LessonWithSentences {
  id: number;
  title: string;
  languageCode: string;
  lessonType: string;
  sentences: SentenceWithSplitText[];
  totalSentences: number;
  audioUrl?: string;
  lessonFiles?: {
    id: number;
    fileS3Key: string;
    imageUrl?: string;
  }[];
  userProgress?: {
    status: string;
    readTillSentenceId: number;
    shouldNavigateToPage: number;
  } | null;
}

export interface GetSentencesResponse {
  success: boolean;
  message?: string;
  lesson?: LessonWithSentences;
}

export interface AddSentenceResponse {
  success: boolean;
  message?: string;
  sentence?: SentenceWithSplitText;
  totalSentences?: number;
}

export interface DeleteSentenceResponse {
  success: boolean;
  message?: string;
}

export class SentenceService {
  /**
   * Store words, their translations, and pronunciations in the database using upsert operations
   * @param ctx - Context (use transaction ctx inside wrapInTransaction)
   * @param words - Array of word translation objects from OpenAI
   * @param sourceLanguage - The source language code
   * @param targetLanguage - The target language code (default: 'en')
   * @param sentenceId - Optional sentence ID to link words to the sentence via SentenceWord
   */
  private async storeWordTranslations(
    ctx: Context,
    words: Array<{
      word: string;
      translation: string;
      pronunciation?: string;
      pronunciationType?: string;
      partOfSpeech?: string;
      stems?: string[];
    }>,
    sourceLanguage: string,
    targetLanguage: string = 'en',
    sentenceId?: number
  ): Promise<void> {
    try {
      for (const wordObj of words) {
        // Trim whitespace from word and translation
        const trimmedWord = wordObj.word?.trim();
        const trimmedTranslation = wordObj.translation?.trim();

        // Skip empty words after trimming
        if (!trimmedWord || !trimmedTranslation) {
          continue;
        }

        // Upsert the word in the source language
        const word = await ctx.prisma.word.upsert({
          where: {
            word_language_code: {
              word: trimmedWord,
              language_code: sourceLanguage,
            },
          },
          update: {},
          create: {
            word: trimmedWord,
            language_code: sourceLanguage,
          },
        });

        // Upsert the translation
        await ctx.prisma.wordTranslation.upsert({
          where: {
            word_id_language_code_translation: {
              word_id: word.id,
              language_code: targetLanguage,
              translation: trimmedTranslation,
            },
          },
          update: {},
          create: {
            word_id: word.id,
            language_code: targetLanguage,
            translation: trimmedTranslation,
          },
        });

        // Store pronunciation if provided
        if (wordObj.pronunciation && wordObj.pronunciationType) {
          const trimmedPronunciation = wordObj.pronunciation.trim();
          const trimmedPronunciationType = wordObj.pronunciationType.trim();

          if (trimmedPronunciation && trimmedPronunciationType) {
            await ctx.prisma.wordPronunciation.upsert({
              where: {
                word_id_pronunciation_pronunciation_type: {
                  word_id: word.id,
                  pronunciation: trimmedPronunciation,
                  pronunciation_type: trimmedPronunciationType,
                },
              },
              update: {},
              create: {
                word_id: word.id,
                pronunciation: trimmedPronunciation,
                pronunciation_type: trimmedPronunciationType,
              },
            });
          }
        }

        // Store word stems if provided (skip if stem is same as original word)
        if (
          wordObj.stems &&
          Array.isArray(wordObj.stems) &&
          wordObj.stems.length > 0
        ) {
          for (const stem of wordObj.stems) {
            const trimmedStem = stem.trim();
            // Skip storing if stem is the same as the original word
            if (trimmedStem && trimmedStem !== trimmedWord) {
              await ctx.prisma.wordStem.upsert({
                where: {
                  word_id_stem: {
                    word_id: word.id,
                    stem: trimmedStem,
                  },
                },
                update: {},
                create: {
                  word_id: word.id,
                  stem: trimmedStem,
                },
              });
            }
          }
        }

        // Link word to sentence if sentenceId is provided
        if (sentenceId) {
          try {
            await ctx.prisma.sentenceWord.upsert({
              where: {
                word_id_sentence_id: {
                  word_id: word.id,
                  sentence_id: sentenceId,
                },
              },
              update: {}, // No updates needed, just ensure the link exists
              create: {
                word_id: word.id,
                sentence_id: sentenceId,
              },
            });
          } catch (linkError) {
            // Log error but continue - word linking shouldn't break word storage
            console.error('Error linking word to sentence:', linkError);
          }
        }
      }
    } catch (error) {
      // Log error but don't throw - we don't want word storage to break sentence processing
      console.error('Error storing word translations:', error);
    }
  }

  /**
   * Process multiple sentences to ensure split_text is populated for all
   * @param sentences - Array of sentence data from database
   * @param languageCode - Language code for OpenAI processing
   * @param orderById - Sort order for result by id ('asc' | 'desc'), default 'asc'
   * @returns Array of processed sentences with split_text
   */
  async processSentenceSplitText(
    ctx: Context,
    sentences: Array<{
      id: number;
      original_text: string;
      split_text: any;
      start_time: any;
      end_time: any;
    }>,
    languageCode: string,
    orderById: 'asc' | 'desc' = 'asc'
  ): Promise<SentenceWithSplitText[]> {
    // Separate sentences that need processing from those that don't
    const sentencesToProcess: Array<{
      id: number;
      original_text: string;
      split_text: any;
      start_time: any;
      end_time: any;
    }> = [];
    const processedResults: SentenceWithSplitText[] = [];

    // First pass: identify sentences that need processing
    for (const sentence of sentences) {
      const splitText = sentence.split_text as string[] | null;

      if (!splitText || !Array.isArray(splitText) || splitText.length === 0) {
        sentencesToProcess.push(sentence);
      } else {
        // Sentence already has split_text, fetch word translations from database
        console.log(
          `Sentence ${sentence.id} already has split_text, fetching word translations`
        );

        // Fetch word translations, pronunciations, and stems for existing split_text
        const wordTranslations: WordWithTranslation[] = [];
        const wordPronunciations: WordWithPronunciation[] = [];
        const wordStems: WordWithStems[] = [];

        for (const word of splitText) {
          const trimmedWord = word.trim();
          if (!trimmedWord) continue;

          // Find the word translation in the database
          const wordRecord = await ctx.prisma.word.findFirst({
            where: {
              word: trimmedWord,
              language_code: languageCode,
            },
            include: {
              wordTranslations: {
                where: {
                  language_code: 'en', // English translations
                },
              },
              wordPronunciations: true, // Include all pronunciations
              stems: true, // Include all stems
            },
          });

          if (wordRecord && wordRecord.wordTranslations.length > 0) {
            wordTranslations.push({
              word: trimmedWord,
              translation: wordRecord.wordTranslations[0]?.translation || '',
            });
          } else {
            wordTranslations.push({
              word: trimmedWord,
              translation: '', // Empty translation indicates not found
            });
          }

          // Add pronunciations separately
          if (wordRecord && wordRecord.wordPronunciations.length > 0) {
            wordRecord.wordPronunciations.forEach(pronunciation => {
              wordPronunciations.push({
                word: trimmedWord,
                pronunciation: pronunciation.pronunciation,
                pronunciationType:
                  pronunciation.pronunciation_type || 'unknown',
              });
            });
          }

          // Add stems separately
          if (wordRecord && wordRecord.stems.length > 0) {
            const stems = wordRecord.stems.map(stem => stem.stem);
            wordStems.push({
              word: trimmedWord,
              stems: stems,
            });
          }
        }

        processedResults.push({
          id: sentence.id,
          original_text: sentence.original_text,
          split_text: splitText,
          word_translations: wordTranslations,
          word_pronunciations: wordPronunciations,
          word_stems: wordStems,
          start_time:
            sentence.start_time != null ? Number(sentence.start_time) : null,
          end_time:
            sentence.end_time != null ? Number(sentence.end_time) : null,
        });
      }
    }

    // Process sentences that need split_text in batch
    if (sentencesToProcess.length > 0) {
      try {
        console.log(
          `Processing ${sentencesToProcess.length} sentences for split_text in batch`
        );

        // Extract text for batch processing
        const textsToProcess = sentencesToProcess.map(s => s.original_text);

        // Use batch processing for better performance
        const analyses =
          await ctx.openaiService.splitMultipleSentencesAndTranslate(
            ctx,
            textsToProcess,
            languageCode
          );

        // Process results and update database
        const updatePromises = sentencesToProcess.map(
          async (sentence, index) => {
            const analysis = analyses[index];
            if (!analysis) {
              console.error(`No analysis result for sentence ${sentence.id}`);
              return {
                id: sentence.id,
                original_text: sentence.original_text,
                split_text: null,
                word_translations: null,
                start_time:
                  sentence.start_time != null
                    ? Number(sentence.start_time)
                    : null,
                end_time:
                  sentence.end_time != null ? Number(sentence.end_time) : null,
              };
            }

            // Extract just the words (not translations) for split_text
            const splitText = analysis.words.map(wordObj => wordObj.word);

            // Create word translations array from analysis
            const wordTranslations: WordWithTranslation[] = analysis.words.map(
              wordObj => ({
                word: wordObj.word,
                translation: wordObj.translation,
              })
            );

            // Create word pronunciations array from analysis
            const wordPronunciations: WordWithPronunciation[] = analysis.words
              .filter(
                wordObj => wordObj.pronunciation && wordObj.pronunciationType
              )
              .map(wordObj => ({
                word: wordObj.word,
                pronunciation: wordObj.pronunciation!,
                pronunciationType: wordObj.pronunciationType!,
              }));

            // Create word stems array from analysis
            const wordStems: WordWithStems[] = analysis.words
              .filter(
                wordObj =>
                  wordObj.stems &&
                  Array.isArray(wordObj.stems) &&
                  wordObj.stems.length > 0
              )
              .map(wordObj => ({
                word: wordObj.word,
                stems: wordObj.stems!,
              }));

            // Store words and translations in the database (inside transaction)
            await wrapInTransaction(ctx, async ctx => {
              await this.storeWordTranslations(
                ctx,
                analysis.words,
                languageCode,
                'en',
                sentence.id
              );
              await ctx.prisma.sentence.update({
                where: { id: sentence.id },
                data: { split_text: splitText },
              });
            });

            const reloadedSentence = await ctx.prisma.sentence.findUnique({
              where: {
                id: sentence.id,
              },
            });

            return {
              id: sentence.id,
              original_text: sentence.original_text,
              split_text: splitText,
              word_translations: wordTranslations,
              word_pronunciations: wordPronunciations,
              word_stems: wordStems,
              start_time:
                (
                  reloadedSentence?.start_time || sentence?.start_time
                )?.toNumber() || null,
              end_time:
                (
                  reloadedSentence?.end_time || sentence?.end_time
                )?.toNumber() || null,
            };
          }
        );

        const batchResults = await Promise.all(updatePromises);
        processedResults.push(...batchResults);
      } catch (error) {
        console.error(`Error processing sentences in batch:`, error);
        // Fallback: add sentences with null split_text if batch processing fails
        const fallbackResults = sentencesToProcess.map(sentence => ({
          id: sentence.id,
          original_text: sentence.original_text,
          split_text: null as string[] | null,
          word_translations: null as WordWithTranslation[] | null,
          word_pronunciations: null as WordWithPronunciation[] | null,
          word_stems: null as WordWithStems[] | null,
          start_time:
            sentence.start_time != null ? Number(sentence.start_time) : null,
          end_time:
            sentence.end_time != null ? Number(sentence.end_time) : null,
        }));
        processedResults.push(...fallbackResults);
      }
    }

    // Sort results by id in requested order
    processedResults.sort((a, b) =>
      orderById === 'desc' ? b.id - a.id : a.id - b.id
    );

    // Deduplicate word_translations, word_pronunciations, and word_stems for each sentence
    processedResults.forEach(sentence => {
      if (sentence.word_translations) {
        // Deduplicate translations by word + translation combination
        const uniqueTranslations = new Map<string, WordWithTranslation>();
        sentence.word_translations.forEach(translation => {
          const key = `${translation.word}|${translation.translation}`;
          if (!uniqueTranslations.has(key)) {
            uniqueTranslations.set(key, translation);
          }
        });
        sentence.word_translations = Array.from(uniqueTranslations.values());
      }

      if (sentence.word_pronunciations) {
        // Deduplicate pronunciations by word + pronunciation combination
        const uniquePronunciations = new Map<string, WordWithPronunciation>();
        sentence.word_pronunciations.forEach(pronunciation => {
          const key = `${pronunciation.word}|${pronunciation.pronunciation}`;
          if (!uniquePronunciations.has(key)) {
            uniquePronunciations.set(key, pronunciation);
          }
        });
        sentence.word_pronunciations = Array.from(
          uniquePronunciations.values()
        );
      }

      if (sentence.word_stems) {
        // Deduplicate stems by word + stems combination
        const uniqueStems = new Map<string, WordWithStems>();
        sentence.word_stems.forEach(stemObj => {
          const key = `${stemObj.word}|${stemObj.stems.sort().join(',')}`;
          if (!uniqueStems.has(key)) {
            uniqueStems.set(key, stemObj);
          }
        });
        sentence.word_stems = Array.from(uniqueStems.values());
      }
    });

    return processedResults;
  }

  /**
   * Get sentences for a lesson with pagination, ensuring split_text is populated
   */
  async getLessonSentences(
    ctx: Context,
    lessonId: number,
    userId: number,
    page: number = 1,
    limit: number = 10,
    lessonFileId?: number
  ): Promise<GetSentencesResponse> {
    try {
      // First, verify the lesson exists and belongs to the user
      const lesson = await ctx.prisma.lesson.findFirst({
        where: {
          id: lessonId,
          created_by: userId,
        },
        select: {
          id: true,
          title: true,
          language_code: true,
          lesson_type: true,
          audio_s3_key: true,
          created_with_prompt: true,
        },
      });

      if (!lesson) {
        return {
          success: false,
          message: 'Lesson not found or access denied',
        };
      }

      // Get total count of sentences for pagination
      const totalSentences = await ctx.prisma.sentence.count({
        where: lessonFileId
          ? { lesson_id: lessonId, lesson_file_id: lessonFileId }
          : { lesson_id: lessonId },
      });

      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // Manual lessons: newest first (desc); others including generated: ascending
      const orderDirection = lesson.lesson_type === 'manual' ? 'desc' : 'asc';

      // Get sentences with pagination
      const sentences = await ctx.prisma.sentence.findMany({
        where: lessonFileId
          ? { lesson_id: lessonId, lesson_file_id: lessonFileId }
          : { lesson_id: lessonId },
        orderBy: { id: orderDirection },
        skip: offset,
        take: limit,
        select: {
          id: true,
          original_text: true,
          split_text: true,
          start_time: true,
          end_time: true,
        },
      });

      // Process all sentences in batch to ensure split_text is populated (preserve order)
      const processedSentences = await this.processSentenceSplitText(
        ctx,
        sentences,
        lesson.language_code,
        orderDirection as 'asc' | 'desc'
      );

      // Get user progress for this lesson
      const progressResult = await ctx.userLessonProgressService.getProgress(
        ctx,
        userId,
        lessonId,
        limit
      );

      let userProgress = null;
      if (progressResult.success && progressResult.progress) {
        userProgress = {
          status: progressResult.progress.status,
          readTillSentenceId: progressResult.progress.readTillSentenceId,
          shouldNavigateToPage: progressResult.shouldNavigateToPage || 1,
        };
      }

      // Generate audio URL if audio_s3_key exists
      let audioUrl: string | undefined;
      if (lesson.audio_s3_key) {
        try {
          audioUrl = await ctx.s3Service.getDownloadUrl(
            ctx,
            lesson.audio_s3_key
          );
        } catch (error) {
          console.error('Error generating audio download URL:', error);
          audioUrl = undefined;
        }
      }

      // Get lesson files for manga lessons
      let lessonFiles: any[] = [];
      if (lesson.lesson_type === 'manga') {
        try {
          const files = await ctx.prisma.lessonFile.findMany({
            where: { lesson_id: lessonId },
            select: {
              id: true,
              file_s3_key: true,
            },
            orderBy: { id: 'asc' },
          });

          // Generate download URLs for each manga page
          lessonFiles = await Promise.all(
            files.map(async file => {
              let imageUrl: string | undefined;
              if (file.file_s3_key) {
                try {
                  imageUrl = await ctx.s3Service.getDownloadUrl(
                    ctx,
                    file.file_s3_key
                  );
                } catch (error) {
                  console.error('Error generating image download URL:', error);
                }
              }
              return {
                id: file.id,
                fileS3Key: file.file_s3_key,
                ...(imageUrl && { imageUrl }),
              };
            })
          );
        } catch (error) {
          console.error('Error fetching lesson files:', error);
        }
      }

      return {
        success: true,
        lesson: {
          id: lesson.id,
          title: lesson.title,
          languageCode: lesson.language_code,
          lessonType: lesson.lesson_type,
          sentences: processedSentences,
          totalSentences,
          ...(audioUrl && { audioUrl }),
          ...(lessonFiles.length > 0 && { lessonFiles }),
          userProgress,
          ...(lesson.created_with_prompt && {
            createdWithPrompt: lesson.created_with_prompt,
          }),
        },
      };
    } catch (error) {
      console.error('Error in getLessonSentences:', error);
      return {
        success: false,
        message: 'Failed to retrieve lesson sentences',
      };
    }
  }

  /**
   * Add a sentence to a manual lesson: split/translate via OpenAI, then persist in a transaction
   */
  async addSentenceToLesson(
    ctx: Context,
    lessonId: number,
    userId: number,
    text: string
  ): Promise<AddSentenceResponse> {
    let trimmedText = text?.trim();
    if (!trimmedText) {
      return {
        success: false,
        message: 'Sentence text is required and cannot be empty',
      };
    }

    try {
      const lesson = await ctx.prisma.lesson.findFirst({
        where: {
          id: lessonId,
          created_by: userId,
        },
        include: {
          lessonFiles: true,
        },
      });

      if (!lesson) {
        return {
          success: false,
          message: 'Lesson not found or access denied',
        };
      }

      if (lesson.lesson_type !== 'manual') {
        return {
          success: false,
          message: 'Only manual lessons support adding sentences',
        };
      }

      const lessonFile = lesson.lessonFiles[0];
      if (!lessonFile) {
        return {
          success: false,
          message: 'Lesson has no lesson file for sentences',
        };
      }

      if (lesson.language_code === 'zh') {
        trimmedText = trimmedText
          .replace(/ /g, '')
          .replace(/,/g, '，')
          .replace(/;/g, '；');
      } else if (lesson.language_code === 'ja') {
        trimmedText = trimmedText.replace(/,/g, '、').replace(/;/g, '；');
      } else if (lesson.language_code === 'ko') {
        trimmedText = trimmedText.replace(/,/g, '，').replace(/;/g, '；');
      }

      const analysis = await ctx.openaiService.splitSentenceAndTranslate(
        ctx,
        trimmedText,
        lesson.language_code
      );
      const splitText = analysis.words.map(w => w.word);

      const result = await wrapInTransaction(ctx, async ctx => {
        const sentence = await ctx.prisma.sentence.create({
          data: {
            lesson_id: lessonId,
            lesson_file_id: lessonFile.id,
            original_text: trimmedText,
            split_text: splitText,
            start_time: null,
            end_time: null,
          },
        });

        await this.storeWordTranslations(
          ctx,
          analysis.words,
          lesson.language_code,
          'en',
          sentence.id
        );

        const totalSentences = await ctx.prisma.sentence.count({
          where: { lesson_id: lessonId },
        });

        return { sentence, totalSentences };
      });

      return {
        success: true,
        sentence: {
          id: result.sentence.id,
          original_text: result.sentence.original_text,
          split_text: result.sentence.split_text as string[] | null,
          word_translations: analysis.words.map(w => ({
            word: w.word,
            translation: w.translation,
          })),
          word_pronunciations: analysis.words
            .filter(
              (
                w
              ): w is typeof w & {
                pronunciation: string;
                pronunciationType: string;
              } => !!w.pronunciation && !!w.pronunciationType
            )
            .map(w => ({
              word: w.word,
              pronunciation: w.pronunciation,
              pronunciationType: w.pronunciationType,
            })),
          word_stems: analysis.words
            .filter(
              (w): w is typeof w & { stems: string[] } =>
                !!w.stems && Array.isArray(w.stems) && w.stems.length > 0
            )
            .map(w => ({ word: w.word, stems: w.stems })),
          start_time: null,
          end_time: null,
        },
        totalSentences: result.totalSentences,
      };
    } catch (error) {
      console.error('Error in addSentenceToLesson:', error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to add sentence',
      };
    }
  }

  /**
   * Delete a sentence from a manual or manga lesson. Updates or removes UserLessonProgress that point at this sentence,
   * then deletes SentenceWord, SentenceTranslation, and the Sentence.
   */
  async deleteSentenceFromLesson(
    ctx: Context,
    lessonId: number,
    sentenceId: number,
    userId: number
  ): Promise<DeleteSentenceResponse> {
    try {
      const lesson = await ctx.prisma.lesson.findFirst({
        where: {
          id: lessonId,
          created_by: userId,
        },
      });

      if (!lesson) {
        return {
          success: false,
          message: 'Lesson not found or access denied',
        };
      }

      if (lesson.lesson_type !== 'manual' && lesson.lesson_type !== 'manga') {
        return {
          success: false,
          message: 'This lesson type does not support deleting sentences',
        };
      }

      const sentence = await ctx.prisma.sentence.findFirst({
        where: {
          id: sentenceId,
          lesson_id: lessonId,
        },
      });

      if (!sentence) {
        return {
          success: false,
          message: 'Sentence not found',
        };
      }

      const orderedIds = await ctx.prisma.sentence.findMany({
        where: { lesson_id: lessonId },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      const ids = orderedIds.map(s => s.id);
      const onlyOneSentence = ids.length === 1;

      await wrapInTransaction(ctx, async ctx => {
        const progressRows = await ctx.prisma.userLessonProgress.findMany({
          where: {
            lesson_id: lessonId,
            read_till_sentence_id: sentenceId,
          },
        });

        for (const row of progressRows) {
          if (onlyOneSentence) {
            await ctx.prisma.userLessonProgress.delete({
              where: {
                user_id_lesson_id: {
                  user_id: row.user_id,
                  lesson_id: lessonId,
                },
              },
            });
          } else {
            const idx = ids.indexOf(sentenceId);
            const prevId = idx > 0 ? ids[idx - 1] : ids[idx + 1];
            if (prevId === undefined) {
              throw new Error(
                'Cannot determine previous/next sentence for progress'
              );
            }
            await ctx.prisma.userLessonProgress.update({
              where: {
                user_id_lesson_id: {
                  user_id: row.user_id,
                  lesson_id: lessonId,
                },
              },
              data: { read_till_sentence_id: prevId },
            });
          }
        }

        await ctx.prisma.sentenceWord.deleteMany({
          where: { sentence_id: sentenceId },
        });
        await ctx.prisma.sentenceTranslation.deleteMany({
          where: { sentence_id: sentenceId },
        });
        await ctx.prisma.sentence.delete({
          where: { id: sentenceId },
        });
      });

      return { success: true };
    } catch (error) {
      console.error('Error in deleteSentenceFromLesson:', error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to delete sentence',
      };
    }
  }

  /**
   * Add multiple sentences to a manual lesson: batch split/translate via OpenAI, then persist in a transaction
   */
  async addSentencesToLesson(
    ctx: Context,
    lessonId: number,
    userId: number,
    texts: string[]
  ): Promise<{ success: boolean; message?: string; totalSentences?: number }> {
    const trimmed = (texts || [])
      .map(t => (typeof t === 'string' ? t.trim() : ''))
      .filter(t => t.length > 0);
    if (trimmed.length === 0) {
      return { success: false, message: 'At least one sentence is required' };
    }

    try {
      const lesson = await ctx.prisma.lesson.findFirst({
        where: {
          id: lessonId,
          created_by: userId,
        },
        include: { lessonFiles: true },
      });

      if (!lesson) {
        return { success: false, message: 'Lesson not found or access denied' };
      }
      // Bulk add: allowed for manual (empty lesson) and generated (initial AI content)
      if (
        lesson.lesson_type !== 'manual' &&
        lesson.lesson_type !== 'generated'
      ) {
        return {
          success: false,
          message:
            'Only manual and generated lessons support bulk adding sentences',
        };
      }

      const lessonFile = lesson.lessonFiles[0];
      if (!lessonFile) {
        return {
          success: false,
          message: 'Lesson has no lesson file for sentences',
        };
      }

      const analyses =
        await ctx.openaiService.splitMultipleSentencesAndTranslate(
          ctx,
          trimmed,
          lesson.language_code
        );

      await wrapInTransaction(ctx, async ctx => {
        for (let i = 0; i < trimmed.length; i++) {
          const text = trimmed[i]!;
          const analysis = analyses[i];
          const splitText: string[] = analysis
            ? analysis.words.map(w => w.word)
            : [text];

          const sentence = await ctx.prisma.sentence.create({
            data: {
              lesson_id: lessonId,
              lesson_file_id: lessonFile.id,
              original_text: text,
              split_text: splitText,
              start_time: null,
              end_time: null,
            },
          });

          if (analysis) {
            await this.storeWordTranslations(
              ctx,
              analysis.words,
              lesson.language_code,
              'en',
              sentence.id
            );
          }
        }
      });

      const totalSentences = await ctx.prisma.sentence.count({
        where: { lesson_id: lessonId },
      });
      return { success: true, totalSentences };
    } catch (error) {
      console.error('Error in addSentencesToLesson:', error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to add sentences to lesson',
      };
    }
  }

  /**
   * Get a single sentence by ID with split_text populated
   */
  async getSentenceById(
    ctx: Context,
    sentenceId: number,
    userId: number
  ): Promise<{
    success: boolean;
    message?: string;
    sentence?: SentenceWithSplitText;
  }> {
    try {
      // Get sentence and verify user has access via lesson ownership
      const sentence = await ctx.prisma.sentence.findFirst({
        where: {
          id: sentenceId,
          lesson: {
            created_by: userId,
          },
        },
        select: {
          id: true,
          original_text: true,
          split_text: true,
          start_time: true,
          end_time: true,
          lesson: {
            select: {
              language_code: true,
            },
          },
        },
      });

      if (!sentence) {
        return {
          success: false,
          message: 'Sentence not found or access denied',
        };
      }

      // Process the sentence to ensure split_text is populated (wrap in array for batch processing)
      const processedSentences = await this.processSentenceSplitText(
        ctx,
        [sentence],
        sentence.lesson.language_code,
        'asc'
      );
      const processedSentence = processedSentences[0];

      if (!processedSentence) {
        return {
          success: false,
          message: 'Failed to process sentence',
        };
      }

      return {
        success: true,
        sentence: processedSentence,
      };
    } catch (error) {
      console.error('Error in getSentenceById:', error);
      return {
        success: false,
        message: 'Failed to retrieve sentence',
      };
    }
  }

  /**
   * Get translation for a sentence with context from surrounding sentences
   */
  async getSentenceTranslation(
    ctx: Context,
    sentenceId: number,
    userId: number
  ): Promise<{
    success: boolean;
    message?: string;
    translation?: string;
  }> {
    try {
      // Get sentence and verify user has access via lesson ownership
      const sentence = await ctx.prisma.sentence.findFirst({
        where: {
          id: sentenceId,
          lesson: {
            created_by: userId,
          },
        },
        select: {
          id: true,
          original_text: true,
          lesson_id: true,
          lesson: {
            select: {
              language_code: true,
            },
          },
        },
      });

      if (!sentence) {
        return {
          success: false,
          message: 'Sentence not found or access denied',
        };
      }

      // Check if translation already exists
      const existingTranslation =
        await ctx.prisma.sentenceTranslation.findFirst({
          where: {
            sentence_id: sentenceId,
            language_code: 'en', // English translation
          },
        });

      if (existingTranslation) {
        return {
          success: true,
          translation: existingTranslation.translation,
        };
      }

      // Get all sentences from the lesson ordered by ID to get context
      const allSentences = await ctx.prisma.sentence.findMany({
        where: { lesson_id: sentence.lesson_id },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          original_text: true,
        },
      });

      // Find the index of the current sentence
      const currentIndex = allSentences.findIndex(s => s.id === sentenceId);
      if (currentIndex === -1) {
        return {
          success: false,
          message: 'Sentence not found in lesson',
        };
      }

      // Get context: previous 3 and next 3 sentences
      const contextStart = Math.max(0, currentIndex - 3);
      const contextEnd = Math.min(allSentences.length, currentIndex + 4); // +4 because slice is exclusive
      const contextSentences = allSentences
        .slice(contextStart, contextEnd)
        .map(s => s.original_text);

      // Generate translation using OpenAI with context
      const translation = await ctx.openaiService.translateSentenceWithContext(
        ctx,
        sentence.original_text,
        contextSentences,
        sentence.lesson.language_code
      );

      // Store the translation in the database using upsert
      await ctx.prisma.sentenceTranslation.upsert({
        where: {
          sentence_id_language_code: {
            sentence_id: sentenceId,
            language_code: 'en',
          },
        },
        update: {
          translation: translation,
        },
        create: {
          sentence_id: sentenceId,
          language_code: 'en',
          translation: translation,
        },
      });

      return {
        success: true,
        translation: translation,
      };
    } catch (error) {
      console.error('Error in getSentenceTranslation:', error);
      return {
        success: false,
        message: 'Failed to get sentence translation',
      };
    }
  }

  /**
   * Update sentence timing (start_time and end_time) with optional cascade to subsequent sentences
   */
  async updateSentenceTiming(
    ctx: Context,
    sentenceId: number,
    userId: number,
    timeOffset: number,
    moveSubsequent: boolean
  ): Promise<{
    success: boolean;
    message?: string;
    sentence?: {
      id: number;
      start_time: number | null;
      end_time: number | null;
    };
  }> {
    try {
      // Get sentence and verify user has access via lesson ownership
      const sentence = await ctx.prisma.sentence.findFirst({
        where: {
          id: sentenceId,
          lesson: {
            created_by: userId,
          },
        },
      });

      if (!sentence) {
        return {
          success: false,
          message: 'Sentence not found or access denied',
        };
      }

      // Validate that sentence has timing data
      if (sentence.start_time === null || sentence.end_time === null) {
        return {
          success: false,
          message: 'Sentence does not have timing data to adjust',
        };
      }

      // Use transaction to ensure atomicity
      const result = await wrapInTransaction(ctx, async ctx => {
        // Update sentences: if moveSubsequent is true, update all subsequent sentences;
        // otherwise, update only the target sentence
        await ctx.prisma.sentence.updateMany({
          where: {
            ...(moveSubsequent
              ? {
                  lesson_id: sentence.lesson_id,
                  ...(sentence.start_time
                    ? {
                        start_time: {
                          gte: sentence.start_time,
                        },
                      }
                    : {
                        id: {
                          gte: sentenceId,
                        },
                      }),
                }
              : {
                  id: sentenceId,
                }),
          },
          data: {
            start_time: {
              increment: timeOffset,
            },
            end_time: {
              increment: timeOffset,
            },
          },
        });

        // Fetch the updated sentence
        const updatedSentence = await ctx.prisma.sentence.findUnique({
          where: {
            id: sentenceId,
          },
        });

        return updatedSentence;
      });

      if (!result) {
        return {
          success: false,
          message: 'Failed to update sentence timing',
        };
      }

      return {
        success: true,
        sentence: {
          id: result.id,
          start_time:
            result.start_time != null ? Number(result.start_time) : null,
          end_time: result.end_time != null ? Number(result.end_time) : null,
        },
      };
    } catch (error) {
      console.error('Error in updateSentenceTiming:', error);
      return {
        success: false,
        message: 'Failed to update sentence timing',
      };
    }
  }
}
