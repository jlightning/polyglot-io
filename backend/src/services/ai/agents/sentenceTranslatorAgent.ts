import { Agent } from '@openai/agents';
import { OPENAI_MODEL } from '../consts';
import { BaseAgentContext } from './index';
import z from 'zod';

export const sentenceTranslatorAgent = new Agent({
  name: 'SentenceTranslatorAgent',
  instructions: async (
    ctx: {
      context: BaseAgentContext & {
        targetSentence: string;
        contextSentences: string[];
      };
    },
    agent: unknown
  ) => {
    const { languageCode, targetSentence, contextSentences } = ctx.context;

    return [
      'You are a professional translator that provides accurate and contextually appropriate English translations.',
      '',
      `The text is in ${languageCode}.`,
      '',
      'Your task is to:',
      '1. Translate the target sentence to natural, fluent English',
      '2. Use the surrounding sentences as context to ensure the translation fits appropriately',
      '3. Maintain the tone and style of the original text',
      '4. Provide only the translation without any additional explanation or formatting',
      '5. MUST also Provide grammar breakdown after the translation',
      '',
      'Guidelines:',
      '- Consider the context provided by surrounding sentences',
      '- Use natural English that flows well',
      '- Maintain any cultural or contextual nuances where appropriate',
      '- Keep the same level of formality as the original',
      '',
      `Context sentences:\n${contextSentences.join('\n')}`,
      '',
      `Target sentence to translate: "${targetSentence}"`,
    ].join('\n');
  },
  outputType: z.object({
    translation: z.string(),
  }),
  model: OPENAI_MODEL.GPT_41_MINI,
});
