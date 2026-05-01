import { Agent } from '@openai/agents';
import { OPENAI_MODEL } from '../consts';
import { BaseAgentContext } from './index';
import z from 'zod';
import { LanguageRule } from './utils';

export const isStemSupportedLanguage = (languageCode: string): boolean => {
  return ['ja', 'ko'].includes(languageCode);
};

export const wordStemAgent = new Agent({
  name: 'WordStemAgent',
  instructions: async (
    ctx: { context: BaseAgentContext & { word: string } },
    agent: unknown
  ) => {
    const { languageCode, word } = ctx.context;

    const languageRules = new LanguageRule({
      ja: [
        'For Japanese:',
        '- Provide the dictionary form (辞書形) of the word.',
        '- For verbs, return the plain non-past form (e.g., 食べた -> ["食べる"], 走っている -> ["走る"]).',
        '- For i-adjectives, return the plain form (e.g., 美しかった -> ["美しい"]).',
        '- For nouns and uninflected words, return the word itself.',
      ],
      ko: [
        'For Korean:',
        '- Provide each stem in dictionary form.',
        '- Include Hanja for the stem in parentheses when applicable in the same string (e.g., "학교" -> ["학교(學校)"], "경제" -> ["경제(經濟)"]).',
        '- If no Hanja is commonly used, use only Hangul.',
      ],
      other: [
        'Provide the base/root form of the word.',
        'Include multiple stems if the word has multiple meanings or can be derived from different roots.',
      ],
    });

    return [
      'You are a language learning assistant that provides word stems / dictionary forms.',
      '',
      `The word is in ${languageCode}.`,
      '',
      'Your task is to:',
      `1. Provide the stem(s) / dictionary form(s) for the word "${word}"`,
      '2. Return them as an array of strings.',
      '',
      'Guidelines:',
      languageRules.getRule(languageCode),
      '- Include multiple stems only if the word has multiple plausible roots.',
      '- Return at least one stem.',
    ].join('\n');
  },
  outputType: z.object({
    stems: z.array(z.string()),
  }),
  modelSettings: {
    reasoning: { effort: 'none' },
  },
  model: OPENAI_MODEL.GPT_54_MINI,
});
