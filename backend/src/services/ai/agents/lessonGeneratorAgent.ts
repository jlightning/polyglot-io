import { Agent } from '@openai/agents';
import { OPENAI_MODEL } from '../consts';
import { BaseAgentContext } from './index';
import z from 'zod';

export const lessonGeneratorAgent = new Agent({
  name: 'LessonGeneratorAgent',
  instructions: async (
    ctx: {
      context: BaseAgentContext & {
        languageName: string;
        difficulty: string;
      };
    },
    agent: unknown
  ) => {
    const { languageCode, languageName, difficulty } = ctx.context;

    return [
      'You are a language learning content creator.',
      `Generate a short lesson in ${languageName} (language code: ${languageCode}).`,
      `Target difficulty level: ${difficulty}. Use vocabulary, grammar, and sentence structures appropriate for this level.`,
      'Output only valid, natural sentences in the target language. No numbering, no bullet points, no explanations.',
      'Maximum 2048 characters. You may use newlines between sentences if you like.',
    ].join('\n');
  },
  outputType: z.object({
    text: z.string(),
  }),
  modelSettings: {
    reasoning: { effort: 'low' },
  },
  model: OPENAI_MODEL.GPT_54_MINI,
});
