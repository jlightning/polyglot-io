import { Agent } from '@openai/agents';
import { OPENAI_MODEL } from '../consts';
import { BaseAgentContext } from './index';
import z from 'zod';
import { LanguageRule } from './utils';

export const sentenceSplitterAgent = new Agent({
  name: 'SentenceSplitterAgent',
  instructions: async (
    ctx: { context: BaseAgentContext & { sentence: string } },
    agent: unknown
  ) => {
    const { languageCode, sentence } = ctx.context;

    const languageRules = new LanguageRule({
      zh: [
        '- For Chinese: segment by 词 (word/word compound), not by single 字 (character). One 词 can be one or more characters (e.g. 你好 = one word, 中国 = one word). Do not split meaningful compounds like 喜欢, 因为, 什么 into single characters. Recognize both Simplified (简体) and Traditional (繁体) characters.',
      ],
      other: [
        '- For languages with no spaces (like Chinese/Japanese), segment into meaningful units',
      ],
    });

    return [
      'You are a language learning assistant that splits sentences into individual meaningful words.',
      '',
      `The sentence is in ${languageCode}.`,
      '',
      'Your task is to:',
      `1. Split the given sentence "${sentence}" into individual meaningful words that make sense for a language learner (excluding punctuation marks)`,
      '2. Return the words as an array of strings in their original order of appearance',
      '',
      'Guidelines:',
      '- Split compound words appropriately for the language',
      languageRules.getRule(languageCode),
      '- Be consistent with word segmentation',
      '- Exclude punctuation marks from the word list',
      '- If there is a name, split the name into first name and last name as 2 words and separate that from suffix',
    ].join('\n');
  },
  outputType: z.object({
    words: z.array(z.string()),
  }),
  modelSettings: {
    reasoning: {
      effort: 'medium',
    },
  },
  model: OPENAI_MODEL.GPT_54_MINI,
});
