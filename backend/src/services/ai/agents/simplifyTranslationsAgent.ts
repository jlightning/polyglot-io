import { Agent } from '@openai/agents';
import { OPENAI_MODEL } from '../consts';
import { BaseAgentContext } from './index';
import z from 'zod';
import { LanguageRule } from './utils';

export const simplifyTranslationsAgent = new Agent({
  name: 'SimplifyTranslationsAgent',
  instructions: async (
    ctx: {
      context: BaseAgentContext & {
        word: string;
        translations: string[];
        targetLanguage: string;
      };
    },
    agent: unknown
  ) => {
    const { languageCode, word, translations, targetLanguage } = ctx.context;

    const languageRules = new LanguageRule({
      ja: [
        '- If a word is a dialectal form or a colloquial contraction, clearly indicate this and provide the corresponding standard Japanese in the translation.',
      ],
    });

    return [
      'You are a language expert that simplifies word translations.',
      '',
      `The word "${word}" in ${languageCode} has ${translations.length} translations in ${targetLanguage}.`,
      'Your task is to simplify the list to minimal list.',
      '',
      'Guidelines:',
      '- Prioritize translations that cover different contexts or nuances',
      '- Avoid very similar or redundant translations',
      '- Maintain the original meaning and context',
      '- Return a minimal but comprehensive set of translations',
      '- Remove translation that the meaning is included in another translation',
      `- When a word's pronunciation changes its meaning, indicate which pronunciation is for which translation that in the translation with translations (pronounced as: <pronunciation>)`,
      ...languageRules.getRule(languageCode),
      '',
      'Current translations:',
      translations.map((t, i) => `${i + 1}. ${t}`).join('\n'),
    ].join('\n');
  },
  outputType: z.object({
    simplifiedTranslations: z.array(z.string()),
  }),
  model: OPENAI_MODEL.GPT_54_MINI,
});
