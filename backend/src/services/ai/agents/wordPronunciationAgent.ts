import { Agent } from '@openai/agents';
import { OPENAI_MODEL } from '../consts';
import { BaseAgentContext } from './index';
import z from 'zod';

// Enum for pronunciation types
export type PronunciationType = 'hiragana' | 'romanization' | 'pinyin' | 'ipa';

export const wordPronunciationAgent = new Agent({
  name: 'WordPronunciationAgent',
  instructions: async (
    ctx: { context: BaseAgentContext & { word: string } },
    agent: unknown
  ) => {
    const { languageCode, word } = ctx.context;

    const getPronunciationInstructions = (language: string) => {
      const lowerLang = language.toLowerCase();

      if (lowerLang.includes('japanese') || lowerLang === 'ja') {
        return {
          instruction: 'Provide pronunciation in hiragana',
          type: 'hiragana' as PronunciationType,
        };
      } else if (lowerLang.includes('korean') || lowerLang === 'ko') {
        return {
          instruction: 'Provide pronunciation in romanized form (romanization)',
          type: 'romanization' as PronunciationType,
        };
      } else if (lowerLang.includes('chinese') || lowerLang === 'zh') {
        return {
          instruction:
            'Provide pronunciation in pinyin with tone marks (e.g. nǐ hǎo, zhōng guó). Use ā, á, ǎ, à for the four tones; no accent for neutral tone (轻声).',
          type: 'pinyin' as PronunciationType,
        };
      }

      // Default case for other languages
      return {
        instruction:
          'Provide pronunciation in IPA (International Phonetic Alphabet) or romanized form',
        type: 'ipa' as PronunciationType,
      };
    };

    const pronunciationInfo = getPronunciationInstructions(languageCode);

    return [
      'You are a language learning assistant that provides pronunciations for words.',
      '',
      `The word is in ${languageCode}.`,
      '',
      'Your task is to:',
      `1. Provide the pronunciation for the word "${word}"`,
      `2. Use the appropriate pronunciation format: ${pronunciationInfo.instruction} in ${pronunciationInfo.type}`,
      '',
      'Guidelines:',
      '- Provide accurate pronunciation based on the language',
      pronunciationInfo.instruction,
      '- Return the pronunciation in the specified format',
    ].join('\n');
  },
  outputType: z.object({
    word: z.string(),
    pronunciation: z.string(),
    pronunciationType: z.enum(['hiragana', 'romanization', 'pinyin', 'ipa']),
  }),
  modelSettings: {
    reasoning: { effort: 'none' },
  },
  model: OPENAI_MODEL.GPT_54_MINI,
});
