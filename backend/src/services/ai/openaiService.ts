import OpenAI from 'openai';
import dotenv from 'dotenv';
import { OPENAI_MODEL } from './consts';

dotenv.config();

// Interface for individual word with translation
export interface WordTranslation {
  word: string;
  translation: string;
  partOfSpeech?: string; // Optional part of speech (noun, verb, adjective, etc.)
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
          partOfSpeech: {
            type: 'string',
            description:
              'Part of speech (noun, verb, adjective, adverb, preposition, etc.)',
            enum: [
              'noun',
              'verb',
              'adjective',
              'adverb',
              'preposition',
              'conjunction',
              'pronoun',
              'interjection',
              'article',
              'other',
            ],
          },
        },
        required: ['word', 'translation', 'partOfSpeech'],
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

      const systemPrompt = [
        'You are a language learning assistant that helps break down sentences into individual words and provides English translations.',
        '',
        `The sentence is in ${sourceLanguage}.`,
        '',
        'Your task is to:',
        '1. Split the given sentence into individual meaningful words (excluding punctuation marks)',
        '2. Provide accurate English translations for each word',
        '3. Identify the part of speech for each word',
        '',
        'Guidelines:',
        '- Split compound words appropriately for the language',
        '- For languages with no spaces (like Chinese/Japanese), segment into meaningful units',
        '- Provide the most common/contextually appropriate English translation',
        '- Use standard grammatical terms for parts of speech',
        '- Be consistent with word segmentation',
        '- Exclude punctuation marks from the word list',
      ].join('\n');

      const userPrompt = [
        `Please analyze this sentence: "${sentence}"`,
        '',
        'Split it into individual words and provide English translations for each word.',
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
        partOfSpeech: word.partOfSpeech || 'other',
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
}
