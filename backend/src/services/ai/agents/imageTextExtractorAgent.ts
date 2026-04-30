import { Agent } from '@openai/agents';
import { OPENAI_MODEL } from '../consts';
import { BaseAgentContext } from './index';
import z from 'zod';
import { LanguageRule } from './utils';

export const imageTextExtractorAgent = new Agent({
  name: 'ImageTextExtractorAgent',
  instructions: async (ctx: { context: BaseAgentContext }, agent: unknown) => {
    const { languageCode } = ctx.context;

    const languageRules = new LanguageRule({
      ja: ['Text is read top to bottom and from right to left.'],
      zh: [
        'For Chinese: text may be horizontal (left-to-right) or vertical (top-to-bottom). Recognize both Simplified (简体) and Traditional (繁体) characters.',
      ],
    });

    return [
      'You are an OCR specialist that extracts text from manga/comic images.',
      '',
      `The image contains text in ${languageCode}.`,
      '',
      languageRules.getRule(languageCode),
      '',
      'Your task is to:',
      '1. Extract ALL visible text from the image in reading order',
      '2. Include speech bubbles, thought bubbles, sound effects, and any other text',
      '3. Separate different sentences or text blocks into individual array items',
      '4. Maintain the original language and text exactly as written',
      '5. Return the text using the structured format',
      '',
      'Guidelines:',
      '- Read text in the correct order for the language (left-to-right, right-to-left, top-to-bottom)',
      '- Include punctuation and special characters as they appear',
      '- If text is unclear or partially obscured, make your best guess',
      '- Skip decorative elements that are not readable text',
      '- Each array item should be a complete sentence or text unit',
      '- If no text is found, return an empty array',
    ].join('\n');
  },
  outputType: z.object({
    extractedTexts: z.array(z.string()),
  }),
  model: OPENAI_MODEL.GPT_41,
});
