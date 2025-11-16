import { WordUserMarkSource } from '@prisma/client';
import { UserActionLogService } from './userActionLogService';
import { OpenAIService } from './ai/openaiService';

import { prisma } from './index';
import { NUMBER_OF_TRANSLATION_TO_REDUCE } from './consts';

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
  static async createOrUpdateWordUserMark(
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
      const word = await prisma.word.upsert({
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
      const existingWordUserMark = await prisma.wordUserMark.findUnique({
        where: {
          user_id_word_id: {
            user_id: userId,
            word_id: word.id,
          },
        },
      });

      const oldMark = existingWordUserMark?.mark || 0;

      // Use proper upsert with the unique constraint on user_id + word_id
      const wordUserMark = await prisma.wordUserMark.upsert({
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
      await UserActionLogService.logWordMarkAction(userId, data.languageCode, {
        word_id: word.id,
        old_mark: oldMark,
        new_mark: data.mark,
      });

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
  static async getWordUserMark(
    userId: number,
    word: string,
    languageCode: string
  ) {
    try {
      const wordUserMark = await prisma.wordUserMark.findFirst({
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
  static async getBulkWordUserMarks(
    userId: number,
    words: string[],
    languageCode: string
  ) {
    try {
      const wordUserMarks = await prisma.wordUserMark.findMany({
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

      // Create a map of word -> mark for efficient lookup
      const marksMap: Record<string, number> = {};
      wordUserMarks.forEach(mark => {
        marksMap[mark.word.word] = mark.mark;
      });

      return {
        success: true,
        data: marksMap,
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
   * Delete word user mark
   */
  static async deleteWordUserMark(
    userId: number,
    word: string,
    languageCode: string
  ) {
    try {
      // Use deleteMany to avoid the need for a separate find operation
      const deleteResult = await prisma.wordUserMark.deleteMany({
        where: {
          user_id: userId,
          word: {
            word: word,
            language_code: languageCode,
          },
        },
      });

      if (deleteResult.count === 0) {
        return {
          success: false,
          message: 'Word mark not found',
        };
      }

      return {
        success: true,
        message: 'Word mark deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting word user mark:', error);
      return {
        success: false,
        message: 'Failed to delete word mark',
      };
    }
  }

  /**
   * Get all word user marks for a user
   */
  static async getUserWordMarks(
    userId: number,
    page: number = 1,
    limit: number = 50
  ) {
    try {
      const skip = (page - 1) * limit;

      const [wordUserMarks, total] = await Promise.all([
        prisma.wordUserMark.findMany({
          where: { user_id: userId },
          include: {
            word: true,
          },
          orderBy: { updated_at: 'desc' },
          skip,
          take: limit,
        }),
        prisma.wordUserMark.count({
          where: { user_id: userId },
        }),
      ]);

      return {
        success: true,
        data: {
          wordUserMarks,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      console.error('Error getting user word marks:', error);
      return {
        success: false,
        message: 'Failed to get user word marks',
      };
    }
  }

  /**
   * Get detailed word marks with related sentences and lessons
   */
  static async getUserWordMarksWithDetails(
    userId: number,
    page: number = 1,
    limit: number = 50,
    markFilter?: number,
    languageFilter?: string,
    searchFilter?: string,
    sortBy: string = 'updated_at',
    sortOrder: 'asc' | 'desc' = 'desc'
  ) {
    try {
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = { user_id: userId };
      if (markFilter !== undefined && markFilter >= 0 && markFilter <= 5) {
        whereClause.mark = markFilter;
      }

      // Build word filter conditions
      const wordConditions: any = {};
      if (languageFilter) {
        wordConditions.language_code = languageFilter;
      }

      // Add search filter for word text or user notes
      if (searchFilter) {
        const searchTerm = searchFilter.toLowerCase();
        whereClause.OR = [
          {
            word: {
              ...wordConditions,
              word: {
                contains: searchTerm,
              },
            },
          },
          {
            note: {
              contains: searchTerm,
            },
            ...(Object.keys(wordConditions).length > 0 && {
              word: wordConditions,
            }),
          },
        ];
      } else if (Object.keys(wordConditions).length > 0) {
        whereClause.word = wordConditions;
      }

      // Build orderBy clause
      let orderBy: any = { updated_at: 'desc' }; // default

      switch (sortBy) {
        case 'word':
          orderBy = { word: { word: sortOrder } };
          break;
        case 'mark':
          orderBy = { mark: sortOrder };
          break;
        case 'updated_at':
          orderBy = { updated_at: sortOrder };
          break;
        case 'sentence_count':
          // For sentence count, we'll sort after getting all data
          orderBy = { updated_at: 'desc' };
          break;
        default:
          orderBy = { updated_at: 'desc' };
      }

      // For sentence count sorting, we need to get all data first
      const needsAllData = sortBy === 'sentence_count';

      const [wordUserMarks, total] = await Promise.all([
        prisma.wordUserMark.findMany({
          where: whereClause,
          include: {
            word: {
              include: {
                sentenceWords: {
                  include: {
                    sentence: {
                      include: {
                        lesson: {
                          select: {
                            id: true,
                            title: true,
                            language_code: true,
                          },
                        },
                      },
                    },
                  },
                  take: 3, // Limit to 3 sentences per word
                },
                wordTranslations: {
                  where: {
                    language_code: 'en', // English translations
                  },
                },
                wordPronunciations: true, // Include all pronunciations
              },
            },
          },
          orderBy,
          ...(needsAllData ? {} : { skip, take: limit }), // Skip pagination if we need all data
        }),
        prisma.wordUserMark.count({
          where: whereClause,
        }),
      ]);

      const sentenceCounts = await prisma.sentenceWord.groupBy({
        by: ['word_id'],
        where: {
          sentence: {
            lesson: {
              created_by: userId,
            },
          },
        },
        _count: {
          sentence_id: true,
        },
      });

      const sentenceCountMap = new Map(
        sentenceCounts.map(sc => [sc.word_id, sc._count.sentence_id])
      );

      // Transform the data to include unique lessons per word
      const transformedData = wordUserMarks.map(wordMark => {
        const sentences = wordMark.word.sentenceWords.map(sw => ({
          id: sw.sentence.id,
          original_text: sw.sentence.original_text,
          lesson: sw.sentence.lesson,
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
            totalSentenceCount: sentenceCountMap.get(wordMark.word.id) || 0,
            lessons,
            translations,
            pronunciations,
          },
        };
      });

      // Handle sentence count sorting and pagination
      if (sortBy === 'sentence_count') {
        // Sort by sentence count
        transformedData.sort((a, b) => {
          const countA = a.word.totalSentenceCount;
          const countB = b.word.totalSentenceCount;
          return sortOrder === 'asc' ? countA - countB : countB - countA;
        });

        // Apply pagination after sorting
        const startIndex = skip;
        const endIndex = skip + limit;
        const paginatedData = transformedData.slice(startIndex, endIndex);

        return {
          success: true,
          data: {
            wordUserMarks: paginatedData,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          },
        };
      }

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
  static async getWordTranslations(
    word: string,
    sourceLanguage: string,
    targetLanguage: string = 'en'
  ) {
    try {
      const translations = await prisma.wordTranslation.findMany({
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
          const openaiService = new OpenAIService();
          const generatedTranslations = await openaiService.getWordTranslation(
            word,
            sourceLanguage,
            targetLanguage
          );

          if (generatedTranslations.length > 0) {
            // Ensure the word exists in the database
            const wordRecord = await prisma.word.upsert({
              where: {
                word_language_code: {
                  word: word,
                  language_code: sourceLanguage,
                },
              },
              update: {}, // No updates needed for existing words
              create: {
                word: word,
                language_code: sourceLanguage,
              },
            });

            // Store the translations
            for (const translation of generatedTranslations) {
              const trimmedTranslation = translation.trim();
              if (trimmedTranslation) {
                await prisma.wordTranslation.upsert({
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
              }
            }

            // Return the newly generated translations
            return {
              success: true,
              data: generatedTranslations.map(translation => ({
                word: word,
                translation: translation,
              })),
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
          const openaiService = new OpenAIService();
          const translationTexts = translationData.map(t => t.translation);
          const simplifiedTranslations =
            await openaiService.simplifyTranslations(
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
          await WordService.updateTranslationsInDatabase(
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
   * Get word pronunciations by word and language
   */
  static async getWordPronunciations(word: string, languageCode: string) {
    try {
      const pronunciations = await prisma.wordPronunciation.findMany({
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
          const openaiService = new OpenAIService();
          const pronunciationData = await openaiService.getWordPronunciation(
            word,
            languageCode
          );

          if (pronunciationData) {
            // Ensure the word exists in the database
            const wordRecord = await prisma.word.upsert({
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
              await prisma.wordPronunciation.upsert({
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
                await prisma.wordPronunciation.findUnique({
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
  static async getWordStems(word: string, languageCode: string) {
    try {
      const stems = await prisma.wordStem.findMany({
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

  /**
   * Update translations in database by replacing old ones with simplified ones
   */
  private static async updateTranslationsInDatabase(
    word: string,
    sourceLanguage: string,
    targetLanguage: string,
    simplifiedTranslations: string[]
  ): Promise<void> {
    try {
      // First, get the word ID
      const wordRecord = await prisma.word.findFirst({
        where: {
          word: word,
          language_code: sourceLanguage,
        },
      });

      if (!wordRecord) {
        throw new Error(`Word "${word}" not found in database`);
      }

      // Delete existing translations for this word and target language
      await prisma.wordTranslation.deleteMany({
        where: {
          word_id: wordRecord.id,
          language_code: targetLanguage,
        },
      });

      // Insert the simplified translations
      await prisma.wordTranslation.createMany({
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
