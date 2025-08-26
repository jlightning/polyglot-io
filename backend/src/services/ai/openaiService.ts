import OpenAI from 'openai';
import dotenv from 'dotenv';
import { OPENAI_MODEL } from './consts';

dotenv.config();

// Enum for pronunciation types
export type PronunciationType = 'hiragana' | 'romanization' | 'pinyin' | 'ipa';

// Interface for individual word with translation and pronunciation
export interface WordTranslation {
  word: string;
  translation: string;
  pronunciation?: string;
  pronunciationType?: PronunciationType;
}

// Interface for the complete sentence analysis
export interface SentenceAnalysis {
  originalSentence: string;
  words: WordTranslation[];
  language: string; // Source language
}

// OpenAI structured output schema for word translations
const wordTranslationSchema = {
  type: 'object',
  properties: {
    originalSentence: {
      type: 'string',
      description: 'The original sentence that was analyzed',
    },
    language: {
      type: 'string',
      description:
        "The source language of the original sentence (e.g., 'Spanish', 'French', 'German')",
    },
    words: {
      type: 'array',
      description: 'Array of words with their English translations',
      items: {
        type: 'object',
        properties: {
          word: {
            type: 'string',
            description: 'The original word from the sentence',
          },
          translation: {
            type: 'string',
            description: 'English translation of the word',
          },
          pronunciation: {
            type: 'string',
            description:
              'Pronunciation of the word (hiragana for Japanese, romanji for Korean)',
          },
          pronunciationType: {
            type: 'string',
            enum: ['hiragana', 'romanization', 'pinyin', 'ipa'],
            description: 'Type of pronunciation provided',
          },
        },
        required: ['word', 'translation'],
        additionalProperties: false,
      },
    },
  },
  required: ['originalSentence', 'language', 'words'],
  additionalProperties: false,
} as const;

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey: apiKey,
    });
  }

  /**
   * Split a sentence into words and translate each word to English using GPT-4 with structured output
   * @param sentence - The sentence to analyze
   * @param sourceLanguage - The source language of the sentence
   * @returns Promise<SentenceAnalysis> - Structured analysis with word translations
   */
  async splitSentenceAndTranslate(
    sentence: string,
    sourceLanguage: string
  ): Promise<SentenceAnalysis> {
    try {
      if (!sentence || sentence.trim().length === 0) {
        throw new Error('Sentence cannot be empty');
      }

      // Determine pronunciation instructions based on source language
      const getPronunciationInstructions = (language: string) => {
        const lowerLang = language.toLowerCase();

        if (lowerLang.includes('japanese') || lowerLang === 'ja') {
          return {
            instruction: '   - For Japanese: provide pronunciation in hiragana',
            guideline:
              '- For Japanese words, always provide hiragana pronunciation',
            type: 'hiragana',
          };
        } else if (lowerLang.includes('korean') || lowerLang === 'ko') {
          return {
            instruction:
              '   - For Korean: provide pronunciation in romanized form (romanization)',
            guideline:
              '- For Korean words, always provide romanized pronunciation',
            type: 'romanization',
          };
        } else if (lowerLang.includes('chinese') || lowerLang === 'zh') {
          return {
            instruction: '   - For Chinese: provide pronunciation in pinyin',
            guideline:
              '- For Chinese words, always provide pinyin pronunciation',
            type: 'pinyin',
          };
        }

        // Default case for other languages
        return {
          instruction:
            '   - Provide pronunciation in IPA (International Phonetic Alphabet) or romanized form',
          guideline: '- Provide clear pronunciation guidance when possible',
          type: 'ipa',
        };
      };

      const pronunciationInfo = getPronunciationInstructions(sourceLanguage);

      const systemPrompt = [
        'You are a language learning assistant that helps break down sentences into individual words and provides English translations and pronunciations.',
        '',
        `The sentence is in ${sourceLanguage}.`,
        '',
        'Your task is to:',
        '1. Split the given sentence into individual meaningful words (excluding punctuation marks)',
        '2. Provide accurate English translations for each word',
        '3. Provide pronunciations for each word based on the language:',
        pronunciationInfo.instruction,
        '',
        'Guidelines:',
        '- Split compound words appropriately for the language',
        '- For languages with no spaces (like Chinese/Japanese), segment into meaningful units',
        '- Provide English translation for the word in the context of the sentence',
        '- Be consistent with word segmentation',
        '- Exclude punctuation marks from the word list',
        pronunciationInfo.guideline,
      ].join('\n');

      const userPrompt = [
        `Please analyze this sentence: "${sentence}"`,
        '',
        'Split it into individual words and provide English translations and pronunciations for each word.',
      ].join('\n');

      const completion = await this.client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'sentence_analysis',
            schema: wordTranslationSchema,
          },
        },
        temperature: 0.1, // Low temperature for consistent results
      });

      const responseContent = completion.choices[0]?.message?.content;

      if (!responseContent) {
        throw new Error('No response received from OpenAI');
      }

      let analysis: SentenceAnalysis;
      try {
        analysis = JSON.parse(responseContent);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', parseError);
        throw new Error('Invalid response format from OpenAI');
      }

      // Validate the response structure
      if (
        !analysis.originalSentence ||
        !analysis.words ||
        !Array.isArray(analysis.words)
      ) {
        throw new Error('Invalid response structure from OpenAI');
      }

      // Ensure all required fields are present and set the correct language
      analysis.words = analysis.words.map(word => ({
        word: word.word || '',
        translation: word.translation || '',
        ...(word.pronunciation && { pronunciation: word.pronunciation }),
        ...(word.pronunciationType && {
          pronunciationType: word.pronunciationType,
        }),
      }));

      // Override the language with the provided source language
      analysis.language = sourceLanguage;

      return analysis;
    } catch (error) {
      console.error('Error in splitSentenceAndTranslate:', error);

      if (error instanceof Error) {
        // Re-throw known errors
        if (
          error.message.includes('OPENAI_API_KEY') ||
          error.message.includes('Sentence cannot be empty') ||
          error.message.includes('Invalid response')
        ) {
          throw error;
        }
      }

      // Handle OpenAI API errors
      if (error && typeof error === 'object' && 'error' in error) {
        const openaiError = error as {
          error: { message: string; type: string };
        };
        throw new Error(`OpenAI API error: ${openaiError.error.message}`);
      }

      // Generic error fallback
      throw new Error('Failed to analyze sentence with OpenAI');
    }
  }

  /**
   * Process multiple sentences in batch
   * @param sentences - Array of sentences to analyze
   * @param sourceLanguage - The source language of the sentences
   * @returns Promise<SentenceAnalysis[]> - Array of sentence analyses
   */
  async splitMultipleSentencesAndTranslate(
    sentences: string[],
    sourceLanguage: string
  ): Promise<SentenceAnalysis[]> {
    if (!sentences || sentences.length === 0) {
      return [];
    }

    // Process sentences in parallel with a reasonable concurrency limit
    const batchSize = 5; // Limit concurrent requests to avoid rate limiting
    const results: SentenceAnalysis[] = [];

    for (let i = 0; i < sentences.length; i += batchSize) {
      const batch = sentences.slice(i, i + batchSize);
      const batchPromises = batch.map(sentence =>
        this.splitSentenceAndTranslate(sentence, sourceLanguage)
      );

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error(`Error processing batch ${i / batchSize + 1}:`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Translate a sentence to English with context from surrounding sentences
   * @param targetSentence - The sentence to translate
   * @param contextSentences - Array of surrounding sentences for context (previous 3 + next 3)
   * @param sourceLanguage - The source language of the sentences
   * @returns Promise<string> - The English translation
   */
  async translateSentenceWithContext(
    targetSentence: string,
    contextSentences: string[],
    sourceLanguage: string
  ): Promise<string> {
    try {
      if (!targetSentence || targetSentence.trim().length === 0) {
        throw new Error('Target sentence cannot be empty');
      }

      const systemPrompt = [
        'You are a professional translator that provides accurate and contextually appropriate English translations.',
        '',
        `The text is in ${sourceLanguage}.`,
        '',
        'Your task is to:',
        '1. Translate the target sentence to natural, fluent English',
        '2. Use the surrounding sentences as context to ensure the translation fits appropriately',
        '3. Maintain the tone and style of the original text',
        '4. Provide only the translation without any additional explanation or formatting',
        '',
        'Guidelines:',
        '- Consider the context provided by surrounding sentences',
        '- Use natural English that flows well',
        '- Maintain any cultural or contextual nuances where appropriate',
        '- Keep the same level of formality as the original',
      ].join('\n');

      let userPrompt = `Context sentences:\n${contextSentences.join('\n')}\n\nTarget sentence to translate: "${targetSentence}"\n\nProvide only the English translation:`;

      const completion = await this.client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.3, // Slightly higher for more natural translations
        max_tokens: 500, // Reasonable limit for sentence translations
      });

      const responseContent = completion.choices[0]?.message?.content;

      if (!responseContent) {
        throw new Error('No translation received from OpenAI');
      }

      // Clean up the response (remove quotes if present and trim)
      const translation = responseContent.trim().replace(/^["']|["']$/g, '');

      return translation;
    } catch (error) {
      console.error('Error in translateSentenceWithContext:', error);

      if (error instanceof Error) {
        // Re-throw known errors
        if (
          error.message.includes('OPENAI_API_KEY') ||
          error.message.includes('Target sentence cannot be empty') ||
          error.message.includes('No translation received')
        ) {
          throw error;
        }
      }

      // Handle OpenAI API errors
      if (error && typeof error === 'object' && 'error' in error) {
        const openaiError = error as {
          error: { message: string; type: string };
        };
        throw new Error(`OpenAI API error: ${openaiError.error.message}`);
      }

      // Generic error fallback
      throw new Error('Failed to translate sentence with OpenAI');
    }
  }
}
