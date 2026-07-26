import { Agent } from '@openai/agents';
import { OPENAI_MODEL } from '../consts';
import { BaseAgentContext } from './index';
import {
  checkUserWordMarksTool,
  type CheckUserWordMarksContext,
} from './tools';
import z from 'zod';

export type LessonGeneratorContext = BaseAgentContext &
  CheckUserWordMarksContext & { difficulty: string };

export const lessonGeneratorAgent = new Agent({
  name: 'LessonGeneratorAgent',
  instructions: async (
    ctx: {
      context: LessonGeneratorContext;
    },
    agent: unknown
  ) => {
    const { languageCode, languageName, difficulty } = ctx.context;

    return [
      'You are a language learning content creator.',
      `Generate a short lesson in ${languageName} (language code: ${languageCode}).`,
      `Target difficulty level: ${difficulty}. Use vocabulary, grammar, and sentence structures appropriate for this level.`,
      '',
      'Before writing, plan candidate vocabulary for the topic and call check_user_word_marks once with those words.',
      "Mark scale: 0=Ignore, 1=Don't remember, 2=Hard to remember, 3=Remembered, 4=Easy to remember, 5=No problem; null=unmarked.",
      'Use marks to generate a better lesson. Scale new/unmarked load by difficulty (unique content words, not particles/function words):',
      '- Beginner: mostly mark 4–5 scaffolding; ~10–20% unmarked or mark 1. Keep sentences simple.',
      '- Easy: heavy known scaffolding; ~20–35% unmarked or mark 1–2.',
      '- Intermediate: mix known + practice; ~35–50% unmarked or mark 1–2; include some mark 2–3.',
      '- Advanced: known words as glue only; ~50–70% unmarked or mark 1–2; richer grammar/vocab.',
      '- Native: challenge heavily; ~70–90% unmarked; keep only essential known words for cohesion.',
      '- Prefer recycling mark 4–5 as scaffolding; use mark 2–3 for practice.',
      `- Current target difficulty is ${difficulty} — match that unmarked/new-word share.`,
      '',
      'Output only valid, natural sentences in the target language. No numbering, no bullet points, no explanations.',
      'Maximum 2048 characters. You may use newlines between sentences if you like.',
    ].join('\n');
  },
  tools: [checkUserWordMarksTool],
  outputType: z.object({
    text: z.string(),
  }),
  modelSettings: {
    reasoning: { effort: 'low' },
  },
  model: OPENAI_MODEL.GPT_54_MINI,
});
