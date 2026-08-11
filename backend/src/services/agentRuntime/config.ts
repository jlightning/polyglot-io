import path from 'path';

export interface AgentCliAdapterConfig {
  type: string;
  authMode: 'api_key' | 'login';
  apiKeyEnvironmentVariable: string | null;
  credentialConfigured: boolean;
  binary: string;
  args: string[];
  versionArgs: string[];
  batchArgs: string[] | null;
}

export interface AgentRuntimeConfig {
  enabled: boolean;
  tmuxBinary: string;
  workingDirectory: string;
  maxSessionsPerUser: number;
  batchTimeoutMs: number;
  adapters: AgentCliAdapterConfig[];
  environmentAllowlist: string[];
}

const SAFE_NAME = /^[a-z0-9][a-z0-9_-]{0,49}$/;
const SAFE_ENVIRONMENT_VARIABLE = /^[A-Z][A-Z0-9_]{1,99}$/;

const CLI_API_KEY_ENV: Record<string, string> = {
  codex: 'OPENAI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
  'claude-code': 'ANTHROPIC_API_KEY',
  cursor: 'CURSOR_API_KEY',
};

const CLI_BATCH_ARGS: Record<string, string[]> = {
  codex: ['exec', '--skip-git-repo-check', '--color', 'never'],
  claude: ['--print'],
  'claude-code': ['--print'],
};

function parseStringArray(
  value: string | undefined,
  variable: string
): string[] {
  if (!value) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${variable} must be a JSON array of strings`);
  }

  if (
    !Array.isArray(parsed) ||
    !parsed.every(item => typeof item === 'string')
  ) {
    throw new Error(`${variable} must be a JSON array of strings`);
  }
  return parsed;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error(
      'AGENT_TMUX_MAX_SESSIONS_PER_USER must be between 1 and 100'
    );
  }
  return parsed;
}

function parseBatchTimeout(value: string | undefined): number {
  if (!value) return 120_000;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 5_000 || parsed > 600_000) {
    throw new Error(
      'AGENT_CLI_BATCH_TIMEOUT_MS must be between 5000 and 600000'
    );
  }
  return parsed;
}

export function loadAgentRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): AgentRuntimeConfig {
  const agentType = (env['AGENT_CLI_TYPE'] || 'codex').trim().toLowerCase();
  if (!SAFE_NAME.test(agentType)) {
    throw new Error(
      'AGENT_CLI_TYPE must contain only lowercase letters, digits, _ or -'
    );
  }
  const authMode = env['AGENT_CLI_AUTH_MODE'] || 'api_key';
  if (authMode !== 'api_key' && authMode !== 'login') {
    throw new Error('AGENT_CLI_AUTH_MODE must be api_key or login');
  }
  const apiKeyEnvironmentVariable =
    env['AGENT_CLI_API_KEY_ENV'] || CLI_API_KEY_ENV[agentType] || null;
  if (
    (authMode === 'api_key' && !apiKeyEnvironmentVariable) ||
    (apiKeyEnvironmentVariable !== null &&
      !SAFE_ENVIRONMENT_VARIABLE.test(apiKeyEnvironmentVariable))
  ) {
    throw new Error(
      'AGENT_CLI_API_KEY_ENV is required for custom Agent CLIs and must be an environment variable name'
    );
  }

  const workingDirectory = path.resolve(
    env['AGENT_CLI_WORKING_DIRECTORY'] || process.cwd()
  );
  const extraEnvironment = (env['AGENT_CLI_ENV_ALLOWLIST'] || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const environmentAllowlist = Array.from(
    new Set([
      ...extraEnvironment,
      ...(authMode === 'api_key' && apiKeyEnvironmentVariable
        ? [apiKeyEnvironmentVariable]
        : []),
    ])
  );

  return {
    enabled: env['AGENT_TMUX_ENABLED'] === 'true',
    tmuxBinary: env['AGENT_TMUX_BIN'] || 'tmux',
    workingDirectory,
    maxSessionsPerUser: parsePositiveInt(
      env['AGENT_TMUX_MAX_SESSIONS_PER_USER'],
      3
    ),
    batchTimeoutMs: parseBatchTimeout(env['AGENT_CLI_BATCH_TIMEOUT_MS']),
    adapters: [
      {
        type: agentType,
        authMode,
        apiKeyEnvironmentVariable,
        credentialConfigured:
          authMode === 'login' ||
          Boolean(apiKeyEnvironmentVariable && env[apiKeyEnvironmentVariable]),
        binary: env['AGENT_CLI_BIN'] || agentType,
        args: parseStringArray(
          env['AGENT_CLI_ARGS_JSON'],
          'AGENT_CLI_ARGS_JSON'
        ),
        versionArgs: parseStringArray(
          env['AGENT_CLI_VERSION_ARGS_JSON'] || '["--version"]',
          'AGENT_CLI_VERSION_ARGS_JSON'
        ),
        batchArgs: env['AGENT_CLI_BATCH_ARGS_JSON']
          ? parseStringArray(
              env['AGENT_CLI_BATCH_ARGS_JSON'],
              'AGENT_CLI_BATCH_ARGS_JSON'
            )
          : CLI_BATCH_ARGS[agentType] || null,
      },
    ],
    environmentAllowlist,
  };
}
