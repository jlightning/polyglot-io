import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAgentRuntimeConfig } from './config';
import { TmuxRuntime, type CommandRunner } from './tmuxRuntime';

test('loadAgentRuntimeConfig parses an allowlisted adapter without shell text', () => {
  const config = loadAgentRuntimeConfig({
    AGENT_TMUX_ENABLED: 'true',
    AGENT_CLI_TYPE: 'codex',
    OPENAI_API_KEY: 'test-key',
    AGENT_CLI_BIN: '/usr/local/bin/codex',
    AGENT_CLI_ARGS_JSON: '["--full-auto"]',
    AGENT_TMUX_MAX_SESSIONS_PER_USER: '2',
  });

  assert.equal(config.enabled, true);
  assert.equal(config.maxSessionsPerUser, 2);
  assert.equal(config.adapters[0]?.apiKeyEnvironmentVariable, 'OPENAI_API_KEY');
  assert.equal(config.adapters[0]?.credentialConfigured, true);
  assert.ok(config.environmentAllowlist.includes('OPENAI_API_KEY'));
  assert.deepEqual(config.adapters[0]?.args, ['--full-auto']);
});

test('TmuxRuntime passes executable and arguments separately', async () => {
  const calls: Array<{ file: string; args: readonly string[] }> = [];
  const runner: CommandRunner = async (file, args) => {
    calls.push({ file, args });
    return { stdout: '', stderr: '', exitCode: 0 };
  };
  const config = loadAgentRuntimeConfig({
    AGENT_TMUX_ENABLED: 'true',
    AGENT_TMUX_BIN: '/opt/bin/tmux',
    AGENT_CLI_TYPE: 'codex',
    AGENT_CLI_BIN: '/opt/bin/codex',
    AGENT_CLI_ARGS_JSON: '["--quiet"]',
    AGENT_CLI_WORKING_DIRECTORY: '/tmp',
  });
  const runtime = new TmuxRuntime(config, runner);

  await runtime.start(
    'polyglot-agent-12345678-1234-1234-1234-123456789abc',
    config.adapters[0]!,
    'Teach me English; $(touch /tmp/nope)'
  );

  assert.equal(calls[0]?.file, '/opt/bin/tmux');
  assert.deepEqual(calls[0]?.args.slice(0, 3), [
    '-L',
    'polyglot-agent-12345678-1234-1234-1234-123456789abc',
    'new-session',
  ]);
  assert.deepEqual(calls[0]?.args.slice(-3), [
    '/opt/bin/codex',
    '--quiet',
    'Teach me English; $(touch /tmp/nope)',
  ]);
  assert.equal(calls[0]?.args.includes('/bin/sh'), false);
});

test('TmuxRuntime rejects unmanaged session names', async () => {
  const runtime = new TmuxRuntime(loadAgentRuntimeConfig({}), async () => ({
    stdout: '',
    stderr: '',
    exitCode: 0,
  }));
  await assert.rejects(() => runtime.stop('user-session'), /Invalid managed/);
});

test('readiness reports the configured CLI without exposing its key', async () => {
  const runtime = new TmuxRuntime(
    loadAgentRuntimeConfig({
      AGENT_TMUX_ENABLED: 'true',
      AGENT_CLI_TYPE: 'codex',
      OPENAI_API_KEY: 'must-not-leak',
    }),
    async file => ({
      stdout: file === 'tmux' ? 'tmux 3.7' : 'codex 1.0',
      stderr: '',
      exitCode: 0,
    })
  );

  const readiness = await runtime.readiness();
  assert.equal(readiness.ready, true);
  assert.equal(readiness.adapters[0]?.type, 'codex');
  assert.equal(JSON.stringify(readiness).includes('must-not-leak'), false);
});
