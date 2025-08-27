import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/authRoutes';
import configRoutes from './routes/configRoutes';
import lessonRoutes from './routes/lessonRoutes';
import s3Routes from './routes/s3Routes';
import wordRoutes from './routes/wordRoutes';
import userScoreRoutes from './routes/userScoreRoutes';
import { S3Service } from './services/s3Service';
import { authenticateToken } from './middleware/auth';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env['PORT'] || 3001;
const prisma = new PrismaClient();

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
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.get('/api', (_req, res) => {
  res.json({ message: 'Welcome to polyglotio API' });
});

// Initialize S3 service
try {
  S3Service.initialize();
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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
