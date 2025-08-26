import { PrismaClient } from '@prisma/client';
import { OpenAIService } from './ai/openaiService';

const prisma = new PrismaClient();

export interface SentenceWithSplitText {
  id: number;
  original_text: string;
  split_text: string[] | null;
  start_time: number | null;
  end_time: number | null;
}

export interface LessonWithSentences {
  id: number;
  title: string;
  languageCode: string;
  sentences: SentenceWithSplitText[];
  totalSentences: number;
}

export interface GetSentencesResponse {
  success: boolean;
  message?: string;
  lesson?: LessonWithSentences;
}

export class SentenceService {
  private static openAIService = new OpenAIService();

  /**
   * Store words and their translations in the database using upsert operations
   * @param words - Array of word translation objects from OpenAI
   * @param sourceLanguage - The source language code
   * @param targetLanguage - The target language code (default: 'en')
   */
  private static async storeWordTranslations(
    words: Array<{ word: string; translation: string; partOfSpeech?: string }>,
    sourceLanguage: string,
    targetLanguage: string = 'en'
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
        // Sentence already has split_text, no need to process
        console.log(
          `Sentence ${sentence.id} already has split_text, skipping processing`
        );
        processedResults.push({
          id: sentence.id,
          original_text: sentence.original_text,
          split_text: splitText,
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
                start_time: sentence.start_time
                  ? Number(sentence.start_time)
                  : null,
                end_time: sentence.end_time ? Number(sentence.end_time) : null,
              };
            }

            // Extract just the words (not translations) for split_text
            const splitText = analysis.words.map(wordObj => wordObj.word);

            // Store words and translations in the database
            await this.storeWordTranslations(
              analysis.words,
              languageCode,
              'en' // Target language is English
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
          start_time: sentence.start_time ? Number(sentence.start_time) : null,
          end_time: sentence.end_time ? Number(sentence.end_time) : null,
        }));
        processedResults.push(...fallbackResults);
      }
    }

    // Sort results by original order (by id)
    processedResults.sort((a, b) => a.id - b.id);

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

      return {
        success: true,
        lesson: {
          id: lesson.id,
          title: lesson.title,
          languageCode: lesson.language_code,
          sentences: processedSentences,
          totalSentences,
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
}
