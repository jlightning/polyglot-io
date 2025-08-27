import { WordUserMarkSource } from '@prisma/client';
import { WordService } from '../wordService';

interface LingQImportWordData {
  word: string;
  language_code: string;
  mark: number;
  note: string;
  sentences?: Array<{ original_text: string }>;
}

interface LingQCard {
  term: string;
  status: number;
  extended_status?: number;
  notes: string;
  fragment: string;
}

interface LingQResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results?: LingQCard[];
}

export class LingQService {
  /**
   * Fetch LingQs from LingQ API and import them
   */
  static async fetchAndImportFromLingQ(
    userId: number,
    apiKey: string,
    languageCode: string
  ) {
    try {
      // First, validate the API key by fetching languages
      const languagesResponse = await fetch(
        'https://www.lingq.com/api/v2/languages/',
        {
          headers: {
            Authorization: `Token ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!languagesResponse.ok) {
        return {
          success: false,
          message: 'Invalid API key or unable to connect to LingQ',
        };
      }

      // Get LingQs for the selected language with pagination
      const allLingqs: LingQCard[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      const maxRecords = 100000; // Safety limit
      const pageSize = 1000; // Maximum page size according to API docs

      console.log(`Starting LingQ import for language: ${languageCode}`);

      while (hasMorePages && allLingqs.length < maxRecords) {
        console.log(
          `Fetching page ${currentPage} (${allLingqs.length} cards so far)...`
        );

        const lingqsResponse = await fetch(
          `https://www.lingq.com/api/v2/${languageCode}/cards/?page_size=${pageSize}&page=${currentPage}`,
          {
            headers: {
              Authorization: `Token ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!lingqsResponse.ok) {
          return {
            success: false,
            message:
              'Failed to fetch LingQs from LingQ API. Please check your API key and selected language.',
          };
        }

        const lingqsData = (await lingqsResponse.json()) as LingQResponse;
        const pageResults = lingqsData.results || [];

        if (pageResults.length === 0) {
          hasMorePages = false;
          break;
        }

        // Add results to our collection
        allLingqs.push(...pageResults);

        // Check if there are more pages
        hasMorePages =
          lingqsData.next !== null && pageResults.length === pageSize;
        currentPage++;

        // Add a small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(
        `Completed fetching ${allLingqs.length} LingQs from ${currentPage - 1} pages`
      );

      if (allLingqs.length === 0) {
        return {
          success: true,
          data: {
            totalProcessed: 0,
            imported: 0,
            updated: 0,
            errors: 0,
            errorDetails: [],
          },
          message: 'No LingQs found for this language',
        };
      }

      if (allLingqs.length >= maxRecords) {
        console.log(
          `Warning: Reached maximum import limit of ${maxRecords} records`
        );
      }

      // Process and import the LingQs
      const wordsToImport: LingQImportWordData[] = allLingqs.map(lingq => ({
        word: lingq.term,
        language_code: languageCode,
        mark:
          lingq.status +
          1 +
          (lingq.status === 3 && lingq.extended_status === 3 ? 1 : 0),
        note: lingq.notes || '',
        sentences: lingq.fragment ? [{ original_text: lingq.fragment }] : [],
      }));

      // Use WordService to import the processed words
      return await this.importWordsFromLingQ(userId, wordsToImport);
    } catch (error: any) {
      console.error('Error fetching from LingQ API:', error);
      return {
        success: false,
        message:
          error.message ||
          'Failed to fetch data from LingQ. Please check your API key and try again.',
      };
    }
  }

  /**
   * Batch import words from LingQ data using WordService
   */
  static async importWordsFromLingQ(
    userId: number,
    words: LingQImportWordData[]
  ) {
    try {
      let importedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Process words in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < words.length; i += batchSize) {
        const batch = words.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async wordData => {
            try {
              // Validate and normalize mark
              if (wordData.mark < 0 || wordData.mark > 5) {
                // Map LingQ status to our difficulty scale if needed
                wordData.mark = Math.min(5, Math.max(0, wordData.mark));
              }

              // Use WordService to create or update the word mark
              const result = await WordService.createOrUpdateWordUserMark(
                userId,
                {
                  word: wordData.word,
                  languageCode: wordData.language_code,
                  note: wordData.note || '',
                  mark: wordData.mark,
                  source: WordUserMarkSource.ling_q,
                }
              );

              if (result.success) {
                // Check if it was a new word or update based on the result
                // This is a simplified check - in a real scenario, you might want to
                // modify WordService to return more specific information
                importedCount++;
              } else {
                errorCount++;
                errors.push(
                  `Failed to import "${wordData.word}": ${result.message}`
                );
              }
            } catch (error) {
              console.error(`Error importing word "${wordData.word}":`, error);
              errorCount++;
              errors.push(
                `Failed to import "${wordData.word}": ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
          })
        );
      }

      return {
        success: true,
        data: {
          totalProcessed: words.length,
          imported: importedCount,
          updated: updatedCount,
          errors: errorCount,
          errorDetails: errors.slice(0, 10), // Limit error details to first 10
        },
        message: `Import completed: ${importedCount} words processed from ${words.length} LingQ cards${errorCount > 0 ? `, ${errorCount} errors` : ''}`,
      };
    } catch (error) {
      console.error('Error importing words from LingQ:', error);
      return {
        success: false,
        message: 'Failed to import words from LingQ',
      };
    }
  }

  /**
   * Validate LingQ API key by fetching user languages
   */
  static async validateApiKey(apiKey: string) {
    try {
      const response = await fetch('https://www.lingq.com/api/v2/languages/', {
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return {
        success: response.ok,
        message: response.ok ? 'API key is valid' : 'Invalid API key',
      };
    } catch (error) {
      console.error('Error validating LingQ API key:', error);
      return {
        success: false,
        message: 'Failed to validate API key',
      };
    }
  }

  /**
   * Get available languages from LingQ API
   */
  static async getAvailableLanguages(apiKey: string) {
    try {
      const response = await fetch('https://www.lingq.com/api/v2/languages/', {
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          message: 'Failed to fetch languages from LingQ API',
        };
      }

      const languages = await response.json();
      return {
        success: true,
        data: languages,
      };
    } catch (error) {
      console.error('Error fetching languages from LingQ API:', error);
      return {
        success: false,
        message: 'Failed to fetch languages from LingQ API',
      };
    }
  }
}
