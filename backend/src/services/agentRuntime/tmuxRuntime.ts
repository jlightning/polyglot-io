import { execFile } from 'child_process';
import type { IPty } from 'node-pty';
import * as pty from 'node-pty';
import type { AgentCliAdapterConfig, AgentRuntimeConfig } from './config';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CommandRunner = (
  file: string,
  args: readonly string[],
  options: { cwd?: string; env: NodeJS.ProcessEnv; timeoutMs: number }
) => Promise<CommandResult>;

const BASE_ENVIRONMENT_KEYS = [
  'HOME',
  'LANG',
  'LC_ALL',
  'LOGNAME',
  'PATH',
  'SHELL',
  'TERM',
  'TMPDIR',
  'USER',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
];

export const runCommand: CommandRunner = (file, args, options) =>
  new Promise(resolve => {
    execFile(
      file,
      [...args],
      {
        cwd: options.cwd,
        env: options.env,
        timeout: options.timeoutMs,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const rawCode = error && 'code' in error ? error.code : 0;
        resolve({
          stdout: String(stdout),
          stderr: String(stderr),
          exitCode: typeof rawCode === 'number' ? rawCode : error ? 1 : 0,
        });
      }
    );
  });

export interface RuntimeReadiness {
  enabled: boolean;
  platformSupported: boolean;
  ready: boolean;
  tmux: { available: boolean; version?: string; error?: string };
  adapters: Array<{
    type: string;
    available: boolean;
    version?: string;
    error?: string;
  }>;
  workingDirectory: string;
}

export class TmuxRuntime {
  constructor(
    readonly config: AgentRuntimeConfig,
    private readonly runner: CommandRunner = runCommand
  ) {}

  private safeEnvironment(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    for (const key of [
      ...BASE_ENVIRONMENT_KEYS,
      ...this.config.environmentAllowlist,
    ]) {
      const value = process.env[key];
      if (value !== undefined) env[key] = value;
    }
    env['TERM'] = 'xterm-256color';
    return env;
  }

  getAdapter(type: string): AgentCliAdapterConfig | undefined {
    return this.config.adapters.find(adapter => adapter.type === type);
  }

  async readiness(): Promise<RuntimeReadiness> {
    const platformSupported =
      process.platform === 'darwin' || process.platform === 'linux';
    if (!this.config.enabled || !platformSupported) {
      return {
        enabled: this.config.enabled,
        platformSupported,
        ready: false,
        tmux: { available: false },
        adapters: this.config.adapters.map(adapter => ({
          type: adapter.type,
          available: false,
        })),
        workingDirectory: this.config.workingDirectory,
      };
    }

    const env = this.safeEnvironment();
    const tmuxResult = await this.runner(this.config.tmuxBinary, ['-V'], {
      env,
      timeoutMs: 3000,
    });
    const adapters = await Promise.all(
      this.config.adapters.map(async adapter => {
        if (!adapter.credentialConfigured) {
          return {
            type: adapter.type,
            available: false,
            error: `${adapter.apiKeyEnvironmentVariable} is not configured`,
          };
        }
        const result = await this.runner(adapter.binary, adapter.versionArgs, {
          env,
          timeoutMs: 5000,
        });
        return result.exitCode === 0
          ? {
              type: adapter.type,
              available: true,
              version: (result.stdout || result.stderr).trim(),
            }
          : {
              type: adapter.type,
              available: false,
              error: this.cleanError(result.stderr || result.stdout),
            };
      })
    );
    const tmux =
      tmuxResult.exitCode === 0
        ? {
            available: true,
            version: (tmuxResult.stdout || tmuxResult.stderr).trim(),
          }
        : {
            available: false,
            error: this.cleanError(tmuxResult.stderr || tmuxResult.stdout),
          };

    return {
      enabled: true,
      platformSupported,
      ready: tmux.available && adapters.some(adapter => adapter.available),
      tmux,
      adapters,
      workingDirectory: this.config.workingDirectory,
    };
  }

  async start(
    sessionName: string,
    adapter: AgentCliAdapterConfig,
    prompt: string
  ): Promise<void> {
    this.assertSessionName(sessionName);
    const result = await this.runner(
      this.config.tmuxBinary,
      [
        '-L',
        sessionName,
        'new-session',
        '-d',
        '-s',
        sessionName,
        '-c',
        this.config.workingDirectory,
        '-x',
        '120',
        '-y',
        '32',
        '--',
        adapter.binary,
        ...adapter.args,
        prompt,
      ],
      {
        cwd: this.config.workingDirectory,
        env: this.safeEnvironment(),
        timeoutMs: 10000,
      }
    );
    if (result.exitCode !== 0) {
      throw new Error(
        this.cleanError(result.stderr || result.stdout) || 'tmux start failed'
      );
    }
  }

  async hasSession(sessionName: string): Promise<boolean> {
    this.assertSessionName(sessionName);
    const result = await this.runner(
      this.config.tmuxBinary,
      ['-L', sessionName, 'has-session', '-t', sessionName],
      { env: this.safeEnvironment(), timeoutMs: 3000 }
    );
    if (result.exitCode === 0) return true;
    const message = (result.stderr || result.stdout).toLowerCase();
    if (
      message.includes("can't find session") ||
      message.includes('no server running') ||
      message.includes('no such file or directory')
    ) {
      return false;
    }
    throw new Error(
      this.cleanError(result.stderr || result.stdout) || 'tmux probe failed'
    );
  }

  async stop(sessionName: string): Promise<void> {
    this.assertSessionName(sessionName);
    if (!(await this.hasSession(sessionName))) return;
    const result = await this.runner(
      this.config.tmuxBinary,
      ['-L', sessionName, 'kill-session', '-t', sessionName],
      { env: this.safeEnvironment(), timeoutMs: 5000 }
    );
    if (result.exitCode !== 0) {
      throw new Error(
        this.cleanError(result.stderr || result.stdout) || 'tmux stop failed'
      );
    }
  }

  attach(sessionName: string, cols: number, rows: number): IPty {
    this.assertSessionName(sessionName);
    return pty.spawn(
      this.config.tmuxBinary,
      ['-L', sessionName, 'attach-session', '-t', sessionName],
      {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: this.config.workingDirectory,
        env: this.safeEnvironment() as Record<string, string>,
      }
    );
  }

  private assertSessionName(sessionName: string): void {
    if (!/^polyglot-agent-[a-f0-9-]{36}$/.test(sessionName)) {
      throw new Error('Invalid managed tmux session name');
    }
  }

  private cleanError(value: string): string {
    return value
      .trim()
      .slice(0, 300)
      .replace(/[\r\n]+/g, ' ');
  }
}
