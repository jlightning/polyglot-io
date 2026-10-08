import { Agent } from '@openai/agents';
import { TRANSLATION_LANGUAGE_NAMES } from '../../consts';
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
        targetLanguage: string;
      };
    },
    agent: unknown
  ) => {
    const {
      languageCode,
      languageName,
      targetSentence,
      contextSentences,
      targetLanguage,
    } = ctx.context;
    const targetName = TRANSLATION_LANGUAGE_NAMES[targetLanguage] ?? 'English';

    return [
      `You are a professional translator that provides accurate and contextually appropriate ${targetName} translations.`,
      '',
      `The text is in ${languageName} (language code: ${languageCode}).`,
      '',
      'Your task is to:',
      `1. Translate the target sentence to natural, fluent ${targetName}`,
      '2. Use the surrounding sentences as context to ensure the translation fits appropriately',
      '3. Maintain the tone and style of the original text',
      '4. MUST also Provide grammar breakdown after the translation',
      '',
      'Guidelines:',
      '- Consider the context provided by surrounding sentences',
      `- Use natural ${targetName} that flows well`,
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
  modelSettings: {
    reasoning: { effort: 'medium' },
  },
  model: OPENAI_MODEL.GPT_6_LUNA,
});
