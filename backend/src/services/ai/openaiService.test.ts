import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenAIService } from './openaiService';

test('allows a missing OpenAI API key when the tmux Agent runtime is enabled', () => {
  const service = new OpenAIService({
    apiKey: '',
    agentRuntimeEnabled: true,
  });

  assert.equal(service.isConfigured(), false);
  assert.equal(service.useAgentCli(), true);
});

test('AI provider can explicitly select OpenAI or Agent CLI', () => {
  const openai = new OpenAIService({
    apiKey: 'test-key',
    agentRuntimeEnabled: true,
    provider: 'openai',
  });
  const agent = new OpenAIService({
    apiKey: 'test-key',
    agentRuntimeEnabled: true,
    provider: 'agent_cli',
  });

  assert.equal(openai.useAgentCli(), false);
  assert.equal(agent.useAgentCli(), true);
});

test('requires an OpenAI API key when the tmux Agent runtime is disabled', () => {
  assert.throws(
    () =>
      new OpenAIService({
        apiKey: '',
        agentRuntimeEnabled: false,
      }),
    /Configure OPENAI_API_KEY/
  );
});
