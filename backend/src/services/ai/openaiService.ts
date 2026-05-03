import OpenAI from 'openai';
import dotenv from 'dotenv';
import { OPENAI_MODEL } from './consts';
import type { Context } from '../index';
import { Runner } from '@openai/agents';
import {
  imageTextExtractorAgent,
  isStemSupportedLanguage,
  lessonGeneratorAgent,
  PronunciationType,
  sentenceSplitterAgent,
  sentenceTranslatorAgent,
  simplifyTranslationsAgent,
  wordPronunciationAgent,
  wordStemAgent,
  wordTranslationAgent,
} from './agents';
import pLimit from 'p-limit';
import { removeWeirdSpacingAgent } from './agents/removeWeirdSpacingAgent';

dotenv.config();

// Interface for individual word with translation and pronunciation
export interface WordTranslation {
  word: string;
  translation: string;
  pronunciation?: string;
  pronunciationType?: PronunciationType;
  stems?: string[];
}

// Interface for the complete sentence analysis
export interface SentenceAnalysis {
  originalSentence: string;
  words: WordTranslation[];
  language: string; // Source language
}

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
   * Split a sentence into words and read translation/pronunciation/stems for
   * each word from the database when available; fall back to AI agents when
   * data is missing.
   *
   * This method is read-only on the database. Persistence is the caller's
   * responsibility (see `storeWordTranslations` in sentenceService).
   *
   * - Uses sentenceSplitterAgent to split the sentence into words.
   * - Per word: looks up Word + translations/pronunciations/stems in DB.
   *   - Word found and slice exists -> use DB row.
   *   - Word found but slice missing -> call the corresponding agent.
   *   - Word not found at all -> call every relevant agent and use those.
   * - Stems are only requested for Japanese/Korean.
   */
  async splitSentenceAndTranslate(
    ctx: Context,
    sentence: string,
    sourceLanguage: string,
    targetLanguage: string = 'en'
  ): Promise<SentenceAnalysis> {
    if (!sentence || sentence.trim().length === 0) {
      throw new Error('Sentence cannot be empty');
    }

    const runner = new Runner();

    const splitResult = await runner.run(
      sentenceSplitterAgent,
      `Split this sentence: "${sentence}"`,
      {
        context: { languageCode: sourceLanguage, sentence },
      }
    );
    if (!splitResult) {
      throw new Error('Error while running sentenceSplitterAgent');
    }

    const splitWords = (splitResult.finalOutput?.words ?? []).filter(
      w => w.word?.length
    );

    const stemSupported = isStemSupportedLanguage(sourceLanguage);

    const limit = pLimit(5);
    const hydratedWords: WordTranslation[] = await Promise.all(
      splitWords.map(word =>
        limit(async () => {
          const wordRecord = await ctx.prisma.word.findUnique({
            where: {
              word_language_code: {
                word: word.word,
                language_code: sourceLanguage,
              },
            },
            include: {
              stems: true,
            },
          });

          // Translation: use first DB row if any, else call agent.
          let translation = word.englishTranslation;
          if (!translation) {
            const translationResult = await runner.run(
              wordTranslationAgent,
              'Give translations now',
              {
                context: {
                  languageCode: sourceLanguage,
                  word,
                  targetLanguage,
                },
              }
            );
            translation =
              (translationResult?.finalOutput?.translations ?? [])
                .map(t => t.trim())
                .find(t => t.length > 0) ?? '';
          }

          // Pronunciation: use existing DB row if any, else call agent.
          let pronunciation = word.pronunciation;
          let pronunciationType = word.pronunciationType;

          if (!pronunciation || !pronunciationType) {
            const generated = await this.getWordPronunciation(
              ctx,
              word.word,
              sourceLanguage
            );
            if (generated?.pronunciation && generated.pronunciationType) {
              pronunciation = generated.pronunciation.trim();
              pronunciationType = generated.pronunciationType;
            }
          }

          // Stems: only for Japanese/Korean. Use existing DB rows if any, else call agent.
          let stems: string[] = wordRecord?.stems.map(s => s.stem) ?? [];
          if (stemSupported && !stems?.length) {
            const stemResult = await runner.run(
              wordStemAgent,
              'Give stems now',
              {
                context: { languageCode: sourceLanguage, word: word.word },
              }
            );
            stems = (stemResult?.finalOutput?.stems ?? [])
              .map(s => s.trim())
              .filter(s => s.length > 0);

            if (!stems.length) stems = [word.word];
          }

          return {
            word: word.word,
            translation,
            ...(pronunciation && { pronunciation }),
            ...(pronunciationType && { pronunciationType }),
            ...(stems.length > 0 && { stems }),
          };
        })
      )
    );

    return {
      originalSentence: sentence,
      words: hydratedWords,
      language: sourceLanguage,
    };
  }

  /**
   * Get pronunciation for a single word
   * @param word - The word to get pronunciation for
   * @param languageCode - The language code of the word
   * @returns Promise<{ pronunciation: string; pronunciationType: PronunciationType } | null> - Pronunciation data or null if generation fails
   */
  async getWordPronunciation(
    ctx: Context,
    word: string,
    languageCode: string
  ): Promise<{
    pronunciation: string;
    pronunciationType: PronunciationType;
  } | null> {
    try {
      if (!word || word.trim().length === 0) {
        throw new Error('Word cannot be empty');
      }

      const runner = new Runner();

      const pronunciationData = await runner.run(
        wordPronunciationAgent,
        'Give pronunciation now',
        {
          context: { languageCode, word },
        }
      );
      if (!pronunciationData)
        throw new Error('Error while running wordPronunciationAgent');

      return {
        pronunciation: pronunciationData.finalOutput!.pronunciation.trim(),
        pronunciationType: pronunciationData.finalOutput!.pronunciationType,
      };
    } catch (error) {
      console.error('Error in getWordPronunciation:', error);

      if (error instanceof Error) {
        // Re-throw known errors
        if (
          error.message.includes('OPENAI_API_KEY') ||
          error.message.includes('Word cannot be empty') ||
          error.message.includes('Invalid response') ||
          error.message.includes('No response received')
        ) {
          return null;
        }
      }

      // Handle OpenAI API errors
      if (error && typeof error === 'object' && 'error' in error) {
        const openaiError = error as {
          error: { message: string; type: string };
        };
        console.error(`OpenAI API error: ${openaiError.error.message}`);
        return null;
      }

      // Generic error fallback
      return null;
    }
  }

  /**
   * Get translations for a single word
   * @param word - The word to get translations for
   * @param sourceLanguage - The source language code of the word
   * @param targetLanguage - The target language code (default: 'en')
   * @returns Promise<string[]> - Array of translations or empty array if generation fails
   */
  async getWordTranslation(
    ctx: Context,
    word: string,
    sourceLanguage: string,
    targetLanguage: string = 'en'
  ): Promise<string[]> {
    try {
      if (!word || word.trim().length === 0) {
        throw new Error('Word cannot be empty');
      }

      const runner = new Runner();

      const translationData = await runner.run(
        wordTranslationAgent,
        'Give translations now',
        {
          context: {
            languageCode: sourceLanguage,
            word,
            targetLanguage,
          },
        }
      );
      if (!translationData)
        throw new Error('Error while running wordTranslationAgent');

      const translations = translationData.finalOutput?.translations ?? [];

      const cleanedTranslations = translations
        .map(t => t.trim())
        .filter(t => t.length > 0);

      return cleanedTranslations;
    } catch (error) {
      console.error('Error in getWordTranslation:', error);

      if (error instanceof Error) {
        // Return empty array for known errors
        if (
          error.message.includes('OPENAI_API_KEY') ||
          error.message.includes('Word cannot be empty') ||
          error.message.includes('Invalid response') ||
          error.message.includes('No response received')
        ) {
          return [];
        }
      }

      // Handle OpenAI API errors
      if (error && typeof error === 'object' && 'error' in error) {
        const openaiError = error as {
          error: { message: string; type: string };
        };
        console.error(`OpenAI API error: ${openaiError.error.message}`);
        return [];
      }

      // Generic error fallback
      return [];
    }
  }

  /**
   * Extract text from manga image using OpenAI Vision API
   * @param imageBase64 - Base64 encoded image data
   * @param sourceLanguage - The source language expected in the image
   * @returns Promise<string[]> - Array of extracted sentences/text lines
   */
  async extractTextFromImage(
    ctx: Context,
    imageBase64: string,
    sourceLanguage: string
  ): Promise<string[]> {
    if (!imageBase64 || imageBase64.trim().length === 0) {
      throw new Error('Image data cannot be empty');
    }

    const runner = new Runner();

    const result = await runner.run(
      imageTextExtractorAgent,
      [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image: `data:image/jpeg;base64,${imageBase64}`,
            },
            {
              type: 'input_text',
              text: 'Extract all text from this manga image, in reading order. Return each text segment as a separate item.',
            },
          ],
        },
      ],
      {
        context: { languageCode: sourceLanguage },
      }
    );
    if (!result) {
      throw new Error('Error while running imageTextExtractorAgent');
    }

    const sentence = result.finalOutput?.extractedTexts?.trim();
    if (!sentence) return [];

    const result2 = await runner.run(removeWeirdSpacingAgent, sentence);

    return result2.finalOutput?.trim().length
      ? [result2.finalOutput.trim()]
      : [];
  }

  /**
   * Process multiple sentences in batch
   * @param sentences - Array of sentences to analyze
   * @param sourceLanguage - The source language of the sentences
   * @returns Promise<SentenceAnalysis[]> - Array of sentence analyses
   */
  async splitMultipleSentencesAndTranslate(
    ctx: Context,
    sentences: string[],
    sourceLanguage: string
  ): Promise<SentenceAnalysis[]> {
    if (!sentences || sentences.length === 0) {
      return [];
    }

    const limit = pLimit(5);
    return Promise.all(
      sentences.map(sentence =>
        limit(async () => {
          return this.splitSentenceAndTranslate(ctx, sentence, sourceLanguage);
        })
      )
    );
  }

  /**
   * Generate a short lesson in the target language from a user prompt; returns a single text (max 2048 chars).
   * @param prompt - User prompt (topic, level, style, etc.)
   * @param languageCode - Target language code (e.g. ja, es, fr)
   * @param difficulty - Optional: Beginner, Easy, Intermediate, Advanced, Native
   * @returns Promise<{ text: string }> - Lesson content in the target language
   */
  async generateLessonFromPrompt(
    ctx: Context,
    prompt: string,
    languageCode: string,
    difficulty: string = 'Intermediate'
  ): Promise<{ text: string }> {
    const code = languageCode.trim().toLowerCase();
    const configured = ctx.configService.getLanguageByCode(ctx, code);
    const languageName = configured?.name ?? languageCode;

    const runner = new Runner();

    const result = await runner.run(
      lessonGeneratorAgent,
      `Generate a lesson in ${languageName} at ${difficulty} level based on this request: ${prompt}`,
      {
        context: { languageCode, languageName, difficulty },
      }
    );
    if (!result) {
      throw new Error('Error while running lessonGeneratorAgent');
    }

    return { text: (result.finalOutput?.text ?? '').trim() };
  }

  /**
   * Translate a sentence to English with context from surrounding sentences
   * @param targetSentence - The sentence to translate
   * @param contextSentences - Array of surrounding sentences for context (previous 3 + next 3)
   * @param sourceLanguage - The source language of the sentences
   * @returns Promise<string> - The English translation
   */
  async translateSentenceWithContext(
    ctx: Context,
    targetSentence: string,
    contextSentences: string[],
    sourceLanguage: string
  ): Promise<string> {
    if (!targetSentence || targetSentence.trim().length === 0) {
      throw new Error('Target sentence cannot be empty');
    }

    const runner = new Runner();

    const result = await runner.run(sentenceTranslatorAgent, 'Translate now', {
      context: {
        languageCode: sourceLanguage,
        targetSentence,
        contextSentences,
      },
    });
    if (!result) {
      throw new Error('Error while running sentenceTranslatorAgent');
    }

    return (result.finalOutput?.translation ?? '')
      .trim()
      .replace(/^["']|["']$/g, '');
  }

  /**
   * Extract text from a selected region of a manga image using OpenAI Vision API
   * @param imageBase64 - Base64 encoded image data
   * @param sourceLanguage - The source language expected in the image
   * @param selection - Selection coordinates {x, y, width, height} as percentages (0-1)
   * @returns Promise<string[]> - Array of extracted sentences/text lines
   */
  async extractTextFromImageRegion(
    ctx: Context,
    imageBase64: string,
    sourceLanguage: string,
    selection: { x: number; y: number; width: number; height: number }
  ): Promise<string[]> {
    if (!imageBase64 || imageBase64.trim().length === 0) {
      throw new Error('Image data cannot be empty');
    }

    const croppedImageBase64 = await this.cropImageToRegion(
      imageBase64,
      selection
    );

    return this.extractTextFromImage(ctx, croppedImageBase64, sourceLanguage);
  }

  /**
   * Simplify translations by selecting the most important ones
   * @param word - The word being translated
   * @param translations - Array of all translations
   * @param sourceLanguage - Source language of the word
   * @param targetLanguage - Target language (default: 'en')
   * @returns Promise<string[]> - Array of simplified translations
   */
  async simplifyTranslations(
    ctx: Context,
    word: string,
    translations: string[],
    sourceLanguage: string,
    targetLanguage: string = 'en'
  ): Promise<string[]> {
    try {
      const runner = new Runner();

      const simplifyData = await runner.run(
        simplifyTranslationsAgent,
        'Simplify translations now',
        {
          context: {
            languageCode: sourceLanguage,
            word,
            translations,
            targetLanguage,
          },
        }
      );
      if (!simplifyData)
        throw new Error('Error while running simplifyTranslationsAgent');

      const simplified = simplifyData.finalOutput?.simplifiedTranslations ?? [];

      const simplifiedTranslations = simplified
        .map(t => t.trim())
        .filter(t => t.length > 0);

      return simplifiedTranslations;
    } catch (error) {
      console.error('Error simplifying translations:', error);
      // Fallback to first 3 translations if OpenAI fails
      return translations.slice(0, 3);
    }
  }

  /**
   * Crop image to specified region using sharp
   * @param imageBase64 - Base64 encoded image data
   * @param selection - Selection coordinates {x, y, width, height} as percentages (0-1)
   * @returns Promise<string> - Base64 encoded cropped image
   */
  private async cropImageToRegion(
    imageBase64: string,
    selection: { x: number; y: number; width: number; height: number }
  ): Promise<string> {
    const sharp = require('sharp');

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Could not determine image dimensions');
    }

    const left = Math.round(selection.x * metadata.width);
    const top = Math.round(selection.y * metadata.height);
    const width = Math.round(selection.width * metadata.width);
    const height = Math.round(selection.height * metadata.height);

    const clampedLeft = Math.max(0, Math.min(left, metadata.width - 1));
    const clampedTop = Math.max(0, Math.min(top, metadata.height - 1));
    const clampedWidth = Math.max(
      1,
      Math.min(width, metadata.width - clampedLeft)
    );
    const clampedHeight = Math.max(
      1,
      Math.min(height, metadata.height - clampedTop)
    );

    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: clampedLeft,
        top: clampedTop,
        width: clampedWidth,
        height: clampedHeight,
      })
      .jpeg({ quality: 70 })
      .toBuffer();

    return croppedBuffer.toString('base64');
  }

  /**
   * Generate speech from text using OpenAI gpt-4o-mini-tts.
   * @param text - The text to speak
   * @param languageCode - Source language code (e.g. 'ja', 'ko') for pronunciation
   * @returns Promise<Buffer> - MP3 audio buffer
   */
  async generateSpeech(
    ctx: Context,
    text: string,
    languageCode: string
  ): Promise<Buffer> {
    const langConfig = ctx.configService.getLanguageByCode(ctx, languageCode);
    const languageName = langConfig?.name ?? languageCode;
    const instructions = `Speak in ${languageName}.`;

    const response = await this.client.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'marin',
      input: text,
      instructions,
      response_format: 'mp3',
    });

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
