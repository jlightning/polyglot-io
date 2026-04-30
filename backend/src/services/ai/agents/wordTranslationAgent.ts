import { Agent } from '@openai/agents';
import { OPENAI_MODEL } from '../consts';
import { BaseAgentContext } from './index';
import z from 'zod';

export const wordTranslationAgent = new Agent({
  name: 'WordTranslationAgent',
  instructions: async (
    ctx: {
      context: BaseAgentContext & { word: string; targetLanguage: string };
    },
    agent: unknown
  ) => {
    const { languageCode, word, targetLanguage } = ctx.context;

    return [
      'You are a language learning assistant that provides translations for words.',
      '',
      `The word "${word}" is in ${languageCode}.`,
      '',
      'Your task is to:',
      `1. Provide accurate ${targetLanguage} translations for the word "${word}"`,
      '2. Include multiple translations if the word has different meanings or contexts',
      '3. Provide the most common and useful translations',
      '',
      'Guidelines:',
      '- Provide 3-5 translations depending on the word complexity',
      '- Prioritize the most common and useful translations',
      '- Include different meanings or contexts if applicable',
      '- Return translations as an array of strings',
    ].join('\n');
  },
  outputType: z.object({
    word: z.string(),
    translations: z.array(z.string()),
  }),
  model: OPENAI_MODEL.GPT_41_MINI,
});
