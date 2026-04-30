import { Agent } from '@openai/agents';
import { OPENAI_MODEL } from '../consts';
import { BaseAgentContext } from './index';
import z from 'zod';

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
      '',
      'Current translations:',
      translations.map((t, i) => `${i + 1}. ${t}`).join('\n'),
    ].join('\n');
  },
  outputType: z.object({
    simplifiedTranslations: z.array(z.string()),
  }),
  model: OPENAI_MODEL.GPT_41_MINI,
});
