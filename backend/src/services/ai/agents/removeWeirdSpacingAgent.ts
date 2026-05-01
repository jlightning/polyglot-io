import { Agent } from '@openai/agents';
import { OPENAI_MODEL } from '../consts';
import { BaseAgentContext } from './index';
import z from 'zod';
import { LanguageRule } from './utils';

export const removeWeirdSpacingAgent = new Agent({
  name: 'RemoveWeirdSpacingAgent',
  instructions: async (ctx: { context: BaseAgentContext }, agent: unknown) => {
    return [
      'You remove weird space from sentence so that it become more natural',
      'You return exactly the original sentence with removed space only, nothing else',
    ].join('\n');
  },
  modelSettings: {
    reasoning: { effort: 'low' },
  },
  model: OPENAI_MODEL.GPT_54_MINI,
});
