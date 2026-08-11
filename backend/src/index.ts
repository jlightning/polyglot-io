import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dayjs from 'dayjs';
import authRoutes from './routes/authRoutes';
import configRoutes from './routes/configRoutes';
import lessonRoutes from './routes/lessonRoutes';
import s3Routes from './routes/s3Routes';
import wordRoutes from './routes/wordRoutes';
import userScoreRoutes from './routes/userScoreRoutes';
import importRoutes from './routes/importRoutes';
import userActionLogRoutes from './routes/userActionLogRoutes';
import userSettingRoutes from './routes/userSettingRoutes';
import chartRoutes from './routes/chartRoutes';
import ttsRoutes from './routes/ttsRoutes';
import { ctx } from './routes';
import {
  authenticateToken,
  authenticateMcpQueryToken,
} from './middleware/auth';
import mcpRoutes from './mcp/mcpRoutes';
import agentSessionRoutes from './routes/agentSessionRoutes';
import { AgentTerminalGateway } from './services/agentRuntime/terminalGateway';
import { PrismaClient } from '@prisma/client';

const app = express();
const port = process.env['PORT'] || 3001;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env['CORS_ORIGIN'] || 'http://localhost:5173',
  })
);
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: dayjs().toISOString() });
});

// API routes
app.get('/api', (_req, res) => {
  res.json({ message: 'Welcome to polyglotio API' });
});

// Initialize S3 service
try {
  ctx.s3Service.initialize(ctx);
  console.log('S3 service initialized successfully');
} catch (error) {
  console.warn('S3 service initialization failed:', error);
  console.warn('File upload functionality will be disabled');
}

// API routes
app.use('/api/auth', authRoutes);

// Protected routes - require authentication
app.use('/api/config', authenticateToken, configRoutes);
app.use('/api/lessons', authenticateToken, lessonRoutes);
app.use('/api/s3', authenticateToken, s3Routes);
app.use('/api/words', authenticateToken, wordRoutes);
app.use('/api/user-score', authenticateToken, userScoreRoutes);
app.use('/api/import', authenticateToken, importRoutes);
app.use('/api/user-action-log', authenticateToken, userActionLogRoutes);
app.use('/api/user-settings', authenticateToken, userSettingRoutes);
app.use('/api/charts', authenticateToken, chartRoutes);
app.use('/api/tts', authenticateToken, ttsRoutes);
app.use('/api/agent-sessions', authenticateToken, agentSessionRoutes);

// MCP Streamable HTTP (auth via ?token= query param)
app.use('/mcp', authenticateMcpQueryToken, mcpRoutes);

// Error handling middleware
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
  }
);

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const server = http.createServer(app);
const terminalGateway = new AgentTerminalGateway(
  server,
  ctx.agentSessionService
);

// Graceful shutdown. Detaching terminal clients does not stop tmux sessions.
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  terminalGateway.close();
  server.close();
  await ctx.prisma.$disconnect();
  process.exit(0);
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
  void ctx.agentSessionService.reconcileAll(ctx).catch(error => {
    console.warn('Agent session startup reconciliation failed:', error);
  });
});

ctx.cronService.registerCron({ ...ctx, prisma: new PrismaClient() });
