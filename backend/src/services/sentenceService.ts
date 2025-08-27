import { PrismaClient } from '@prisma/client';
import { OpenAIService } from './ai/openaiService';
import { UserLessonProgressService } from './userLessonProgressService';

const prisma = new PrismaClient();

export interface WordWithTranslation {
  word: string;
  translation: string;
}

export interface WordWithPronunciation {
  word: string;
  pronunciation: string;
  pronunciationType: string;
}

export interface SentenceWithSplitText {
  id: number;
  original_text: string;
  split_text: string[] | null;
  word_translations?: WordWithTranslation[] | null;
  word_pronunciations?: WordWithPronunciation[] | null;
  start_time: number | null;
  end_time: number | null;
  translation?: string | null;
}

export interface LessonWithSentences {
  id: number;
  title: string;
  languageCode: string;
  sentences: SentenceWithSplitText[];
  totalSentences: number;
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

export class SentenceService {
  private static openAIService = new OpenAIService();

  /**
   * Store words, their translations, and pronunciations in the database using upsert operations
   * @param words - Array of word translation objects from OpenAI
   * @param sourceLanguage - The source language code
   * @param targetLanguage - The target language code (default: 'en')
   * @param sentenceId - Optional sentence ID to link words to the sentence via SentenceWord
   */
  private static async storeWordTranslations(
    words: Array<{
      word: string;
      translation: string;
      pronunciation?: string;
      pronunciationType?: string;
      partOfSpeech?: string;
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
        const word = await prisma.word.upsert({
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
        await prisma.wordTranslation.upsert({
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
            await prisma.wordPronunciation.upsert({
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

        // Link word to sentence if sentenceId is provided
        if (sentenceId) {
          try {
            await prisma.sentenceWord.upsert({
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
   * @returns Array of processed sentences with split_text
   */
  private static async processSentenceSplitText(
    sentences: Array<{
      id: number;
      original_text: string;
      split_text: any;
      start_time: any;
      end_time: any;
    }>,
    languageCode: string
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

        // Fetch word translations and pronunciations for existing split_text
        const wordTranslations: WordWithTranslation[] = [];
        const wordPronunciations: WordWithPronunciation[] = [];

        for (const word of splitText) {
          const trimmedWord = word.trim();
          if (!trimmedWord) continue;

          // Find the word translation in the database
          const wordRecord = await prisma.word.findFirst({
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
        }

        processedResults.push({
          id: sentence.id,
          original_text: sentence.original_text,
          split_text: splitText,
          word_translations: wordTranslations,
          word_pronunciations: wordPronunciations,
          start_time: sentence.start_time ? Number(sentence.start_time) : null,
          end_time: sentence.end_time ? Number(sentence.end_time) : null,
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
          await this.openAIService.splitMultipleSentencesAndTranslate(
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
                start_time: sentence.start_time
                  ? Number(sentence.start_time)
                  : null,
                end_time: sentence.end_time ? Number(sentence.end_time) : null,
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

            // Store words and translations in the database
            await this.storeWordTranslations(
              analysis.words,
              languageCode,
              'en', // Target language is English
              sentence.id // Link words to this sentence
            );

            // Update the database with the split_text
            await prisma.sentence.update({
              where: { id: sentence.id },
              data: { split_text: splitText },
            });

            return {
              id: sentence.id,
              original_text: sentence.original_text,
              split_text: splitText,
              word_translations: wordTranslations,
              word_pronunciations: wordPronunciations,
              start_time: sentence.start_time
                ? Number(sentence.start_time)
                : null,
              end_time: sentence.end_time ? Number(sentence.end_time) : null,
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
          start_time: sentence.start_time ? Number(sentence.start_time) : null,
          end_time: sentence.end_time ? Number(sentence.end_time) : null,
        }));
        processedResults.push(...fallbackResults);
      }
    }

    // Sort results by original order (by id)
    processedResults.sort((a, b) => a.id - b.id);

    // Deduplicate word_translations and word_pronunciations for each sentence
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
    });

    return processedResults;
  }

  /**
   * Get sentences for a lesson with pagination, ensuring split_text is populated
   */
  static async getLessonSentences(
    lessonId: number,
    userId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<GetSentencesResponse> {
    try {
      // First, verify the lesson exists and belongs to the user
      const lesson = await prisma.lesson.findFirst({
        where: {
          id: lessonId,
          created_by: userId,
        },
        select: {
          id: true,
          title: true,
          language_code: true,
        },
      });

      if (!lesson) {
        return {
          success: false,
          message: 'Lesson not found or access denied',
        };
      }

      // Get total count of sentences for pagination
      const totalSentences = await prisma.sentence.count({
        where: { lesson_id: lessonId },
      });

      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // Get sentences with pagination
      const sentences = await prisma.sentence.findMany({
        where: { lesson_id: lessonId },
        orderBy: { id: 'asc' },
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

      // Process all sentences in batch to ensure split_text is populated
      const processedSentences = await this.processSentenceSplitText(
        sentences,
        lesson.language_code
      );

      // Get user progress for this lesson
      const progressResult = await UserLessonProgressService.getProgress(
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

      return {
        success: true,
        lesson: {
          id: lesson.id,
          title: lesson.title,
          languageCode: lesson.language_code,
          sentences: processedSentences,
          totalSentences,
          userProgress,
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
   * Get a single sentence by ID with split_text populated
   */
  static async getSentenceById(
    sentenceId: number,
    userId: number
  ): Promise<{
    success: boolean;
    message?: string;
    sentence?: SentenceWithSplitText;
  }> {
    try {
      // Get sentence and verify user has access via lesson ownership
      const sentence = await prisma.sentence.findFirst({
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
        [sentence],
        sentence.lesson.language_code
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
  static async getSentenceTranslation(
    sentenceId: number,
    userId: number
  ): Promise<{
    success: boolean;
    message?: string;
    translation?: string;
  }> {
    try {
      // Get sentence and verify user has access via lesson ownership
      const sentence = await prisma.sentence.findFirst({
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
      const existingTranslation = await prisma.sentenceTranslation.findFirst({
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
      const allSentences = await prisma.sentence.findMany({
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
      const translation = await this.openAIService.translateSentenceWithContext(
        sentence.original_text,
        contextSentences,
        sentence.lesson.language_code
      );

      // Store the translation in the database using upsert
      await prisma.sentenceTranslation.upsert({
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
}
