import { randomBytes, randomUUID } from 'crypto';
import { Prisma, type AgentSession } from '@prisma/client';
import type { Context } from '../index';
import type { TmuxRuntime } from './tmuxRuntime';

const ACTIVE_STATUSES = ['starting', 'running'] as const;
const TERMINAL_TOKEN_TTL_MS = 30_000;

export interface CreateAgentSessionInput {
  languageCode: string;
  goal: string;
  lessonId?: number;
  idempotencyKey?: string;
}

export interface AgentSessionView {
  id: string;
  agentType: string;
  languageCode: string;
  lessonId: number | null;
  goal: string;
  status: string;
  exitCode: number | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
  endedAt: string | null;
}

interface TerminalGrant {
  sessionId: string;
  userId: number;
  tmuxSessionName: string;
  expiresAt: number;
}

export class AgentSessionError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export class AgentSessionService {
  private readonly terminalGrants = new Map<string, TerminalGrant>();
  private readonly attachedSessions = new Set<string>();

  constructor(readonly runtime: TmuxRuntime) {}

  readiness() {
    return this.runtime.readiness();
  }

  async create(
    ctx: Context,
    userId: number,
    input: CreateAgentSessionInput
  ): Promise<AgentSessionView> {
    const readiness = await this.runtime.readiness();
    if (!readiness.ready) {
      throw new AgentSessionError(
        503,
        'runtime_not_ready',
        'tmux or the configured Agent CLI is not ready'
      );
    }

    const adapter = this.runtime.config.adapters.find(candidate =>
      readiness.adapters.some(
        item => item.type === candidate.type && item.available
      )
    );
    if (!adapter) {
      throw new AgentSessionError(
        503,
        'agent_unavailable',
        'Agent CLI is not available'
      );
    }
    if (!ctx.configService.isLanguageEnabled(ctx, input.languageCode)) {
      throw new AgentSessionError(
        400,
        'invalid_language',
        'Language is not enabled'
      );
    }

    if (input.idempotencyKey) {
      const existing = await ctx.prisma.agentSession.findFirst({
        where: { user_id: userId, idempotency_key: input.idempotencyKey },
      });
      if (existing) return this.toView(await this.reconcile(ctx, existing));
    }

    let lessonTitle: string | undefined;
    if (input.lessonId !== undefined) {
      const lesson = await ctx.prisma.lesson.findFirst({
        where: {
          id: input.lessonId,
          created_by: userId,
          language_code: input.languageCode,
        },
        select: { title: true },
      });
      if (!lesson) {
        throw new AgentSessionError(
          400,
          'invalid_lesson',
          'Lesson not found or language does not match'
        );
      }
      lessonTitle = lesson.title;
    }

    const activeCount = await ctx.prisma.agentSession.count({
      where: { user_id: userId, status: { in: [...ACTIVE_STATUSES] } },
    });
    if (activeCount >= this.runtime.config.maxSessionsPerUser) {
      throw new AgentSessionError(
        409,
        'session_limit_reached',
        `A maximum of ${this.runtime.config.maxSessionsPerUser} active sessions is allowed`
      );
    }

    const id = randomUUID();
    const tmuxSessionName = `polyglot-agent-${id}`;
    let session: AgentSession;
    try {
      session = await ctx.prisma.agentSession.create({
        data: {
          id,
          user_id: userId,
          agent_type: adapter.type,
          language_code: input.languageCode,
          lesson_id: input.lessonId ?? null,
          idempotency_key: input.idempotencyKey ?? null,
          goal: input.goal,
          tmux_session_name: tmuxSessionName,
          status: 'starting',
        },
      });
    } catch (error) {
      if (
        input.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await ctx.prisma.agentSession.findFirst({
          where: { user_id: userId, idempotency_key: input.idempotencyKey },
        });
        if (existing) return this.toView(await this.reconcile(ctx, existing));
      }
      throw error;
    }

    try {
      const prompt = this.buildAgentPrompt(
        input.languageCode,
        input.goal,
        lessonTitle
      );
      await this.runtime.start(tmuxSessionName, adapter, prompt);
      if (!(await this.runtime.hasSession(tmuxSessionName))) {
        throw new Error('Agent CLI exited before the session became ready');
      }
      session = await ctx.prisma.agentSession.update({
        where: { id },
        data: { status: 'running', last_seen_at: new Date() },
      });
      console.info('agent_session.create', {
        sessionId: id,
        userId,
        agentType: adapter.type,
      });
      return this.toView(session);
    } catch (error) {
      await this.runtime.stop(tmuxSessionName).catch(() => undefined);
      session = await ctx.prisma.agentSession.update({
        where: { id },
        data: {
          status: 'failed',
          error_code: 'runtime_start_failed',
          ended_at: new Date(),
        },
      });
      console.error('agent_session.create_failed', {
        sessionId: id,
        userId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      throw new AgentSessionError(
        500,
        'runtime_start_failed',
        `Agent CLI failed to start (session ${session.id})`
      );
    }
  }

  async list(ctx: Context, userId: number): Promise<AgentSessionView[]> {
    const sessions = await ctx.prisma.agentSession.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    const views: AgentSessionView[] = [];
    for (const session of sessions) {
      views.push(this.toView(await this.reconcile(ctx, session)));
    }
    return views;
  }

  async reconcileAll(ctx: Context): Promise<void> {
    const sessions = await ctx.prisma.agentSession.findMany({
      where: { status: { in: [...ACTIVE_STATUSES] } },
    });
    for (const session of sessions) {
      await this.reconcile(ctx, session);
    }
  }

  async get(
    ctx: Context,
    userId: number,
    id: string
  ): Promise<AgentSessionView> {
    const session = await this.findOwned(ctx, userId, id);
    return this.toView(await this.reconcile(ctx, session));
  }

  async stop(
    ctx: Context,
    userId: number,
    id: string
  ): Promise<AgentSessionView> {
    let session = await this.findOwned(ctx, userId, id);
    if (
      session.status === 'stopped' ||
      session.status === 'exited' ||
      session.status === 'failed'
    ) {
      return this.toView(session);
    }

    await this.runtime.stop(session.tmux_session_name);
    session = await ctx.prisma.agentSession.update({
      where: { id: session.id },
      data: {
        status: 'stopped',
        ended_at: new Date(),
        last_seen_at: new Date(),
      },
    });
    console.info('agent_session.stop', { sessionId: id, userId });
    return this.toView(session);
  }

  async issueTerminalToken(
    ctx: Context,
    userId: number,
    id: string
  ): Promise<{ token: string; expiresAt: string }> {
    const session = await this.reconcile(
      ctx,
      await this.findOwned(ctx, userId, id)
    );
    if (session.status !== 'running') {
      throw new AgentSessionError(
        409,
        'session_not_running',
        'Session is not running'
      );
    }

    this.removeExpiredGrants();
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + TERMINAL_TOKEN_TTL_MS;
    this.terminalGrants.set(token, {
      sessionId: session.id,
      userId,
      tmuxSessionName: session.tmux_session_name,
      expiresAt,
    });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  claimTerminalToken(token: string): TerminalGrant | undefined {
    this.removeExpiredGrants();
    const grant = this.terminalGrants.get(token);
    this.terminalGrants.delete(token);
    if (!grant || grant.expiresAt <= Date.now()) return undefined;
    return grant;
  }

  acquireTerminal(sessionId: string): boolean {
    if (this.attachedSessions.has(sessionId)) return false;
    this.attachedSessions.add(sessionId);
    return true;
  }

  releaseTerminal(sessionId: string): void {
    this.attachedSessions.delete(sessionId);
  }

  private async findOwned(
    ctx: Context,
    userId: number,
    id: string
  ): Promise<AgentSession> {
    const session = await ctx.prisma.agentSession.findFirst({
      where: { id, user_id: userId },
    });
    if (!session)
      throw new AgentSessionError(
        404,
        'session_not_found',
        'Session not found'
      );
    return session;
  }

  private async reconcile(
    ctx: Context,
    session: AgentSession
  ): Promise<AgentSession> {
    if (
      !ACTIVE_STATUSES.includes(
        session.status as (typeof ACTIVE_STATUSES)[number]
      )
    ) {
      return session;
    }
    const alive = await this.runtime.hasSession(session.tmux_session_name);
    if (alive) {
      if (session.status === 'running') return session;
      return ctx.prisma.agentSession.update({
        where: { id: session.id },
        data: { status: 'running', last_seen_at: new Date() },
      });
    }
    return ctx.prisma.agentSession.update({
      where: { id: session.id },
      data: {
        status: 'exited',
        ended_at: new Date(),
        last_seen_at: new Date(),
      },
    });
  }

  private buildAgentPrompt(
    languageCode: string,
    goal: string,
    lessonTitle?: string
  ): string {
    return [
      `Act as a patient language tutor for language code ${languageCode}.`,
      `The learner's goal is: ${goal}`,
      lessonTitle ? `Focus on the Polyglot lesson titled: ${lessonTitle}` : '',
      'Keep exercises concise, adapt to the learner, and ask one question at a time.',
      'Do not claim to update Polyglot data unless an authorized Polyglot MCP tool is available.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private removeExpiredGrants(): void {
    const now = Date.now();
    for (const [token, grant] of this.terminalGrants) {
      if (grant.expiresAt <= now) this.terminalGrants.delete(token);
    }
  }

  private toView(session: AgentSession): AgentSessionView {
    return {
      id: session.id,
      agentType: session.agent_type,
      languageCode: session.language_code,
      lessonId: session.lesson_id,
      goal: session.goal,
      status: session.status,
      exitCode: session.exit_code,
      errorCode: session.error_code,
      createdAt: session.created_at.toISOString(),
      updatedAt: session.updated_at.toISOString(),
      lastSeenAt: session.last_seen_at?.toISOString() ?? null,
      endedAt: session.ended_at?.toISOString() ?? null,
    };
  }
}
