import { Agent } from '@openai/agents';
import { OPENAI_MODEL } from '../consts';
import { BaseAgentContext } from './index';
import z from 'zod';
import { LanguageRule } from './utils';

export const wordTranslationAgent = new Agent({
  name: 'WordTranslationAgent',
  instructions: async (
    ctx: {
      context: BaseAgentContext & { word: string; targetLanguage: string };
    },
    agent: unknown
  ) => {
    const { languageCode, word, targetLanguage } = ctx.context;

    const languageRules = new LanguageRule({
      ja: [
        '- If a word is a dialectal form or a colloquial contraction, clearly indicate this and provide the corresponding standard Japanese in the translation.',
      ],
    });

    return [
      'You are a language learning assistant that provides translations for words.',
      '',
      `The word "${word}" is in ${languageCode}.`,
      '',
      'Your task is to:',
      `1. Provide accurate ${targetLanguage} translations for the word "${word}"`,
      '2. Include multiple translations if the word has different meanings or contexts',
      '',
      'Guidelines:',
      '- Provide 3-5 translations depending on the word complexity',
      '- Prioritize the most common and useful translations',
      '- Include different meanings or contexts if applicable',
      '- Return translations as an array of strings',
      ...languageRules.getRule(languageCode),
    ].join('\n');
  },
  outputType: z.object({
    word: z.string(),
    translations: z.array(z.string()),
  }),
  modelSettings: {
    reasoning: { effort: 'none' },
  },
  model: OPENAI_MODEL.GPT_54_MINI,
});
