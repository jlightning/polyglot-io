import { Router, type Response } from 'express';
import z from 'zod';
import { AgentSessionError } from '../services/agentRuntime/agentSessionService';
import { ctx } from './index';

const router = Router();

const CreateSessionSchema = z.object({
  languageCode: z.string().min(1).max(10),
  goal: z.string().trim().min(1).max(2000),
  lessonId: z.number().int().positive().optional(),
});

function sendError(res: Response, error: unknown): void {
  if (error instanceof AgentSessionError) {
    res.status(error.statusCode).json({
      success: false,
      code: error.code,
      message: error.message,
    });
    return;
  }
  console.error('Agent session route error:', error);
  res.status(500).json({
    success: false,
    code: 'internal_error',
    message: 'Agent session operation failed',
  });
}

router.get('/readiness', async (req, res) => {
  try {
    const readiness = await ctx.agentSessionService.readiness();
    res.json({ success: true, readiness });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = CreateSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        code: 'invalid_request',
        message: parsed.error.issues[0]?.message || 'Invalid request',
      });
      return;
    }
    const rawIdempotencyKey = req.header('Idempotency-Key');
    if (rawIdempotencyKey && rawIdempotencyKey.length > 100) {
      res.status(400).json({
        success: false,
        code: 'invalid_idempotency_key',
        message: 'Idempotency-Key must be at most 100 characters',
      });
      return;
    }
    const session = await ctx.agentSessionService.create(ctx, req.userId!, {
      languageCode: parsed.data.languageCode,
      goal: parsed.data.goal,
      ...(parsed.data.lessonId !== undefined
        ? { lessonId: parsed.data.lessonId }
        : {}),
      ...(rawIdempotencyKey ? { idempotencyKey: rawIdempotencyKey } : {}),
    });
    res.status(201).json({ success: true, session });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/', async (req, res) => {
  try {
    const sessions = await ctx.agentSessionService.list(ctx, req.userId!);
    res.json({ success: true, sessions });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const session = await ctx.agentSessionService.get(
      ctx,
      req.userId!,
      req.params['id']!
    );
    res.json({ success: true, session });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/:id/stop', async (req, res) => {
  try {
    const session = await ctx.agentSessionService.stop(
      ctx,
      req.userId!,
      req.params['id']!
    );
    res.json({ success: true, session });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/:id/terminal-token', async (req, res) => {
  try {
    const grant = await ctx.agentSessionService.issueTerminalToken(
      ctx,
      req.userId!,
      req.params['id']!
    );
    res.json({ success: true, ...grant });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
