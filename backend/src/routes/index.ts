import { PrismaClient } from '@prisma/client';
import type { Context } from '../services';
import { UserService } from '../services/authService';
import { ConfigService } from '../services/configService';
import { LessonService } from '../services/lessonService';
import { SentenceService } from '../services/sentenceService';
import { WordService } from '../services/wordService';
import { UserLessonProgressService } from '../services/userLessonProgressService';
import { UserScoreService } from '../services/userScoreService';
import { UserActionLogService } from '../services/userActionLogService';
import { UserSettingService } from '../services/userSettingService';
import { CronService } from '../services/cronService';
import { S3Service } from '../services/s3Service';
import { TtsService } from '../services/ttsService';
import { OpenAIService } from '../services/ai/openaiService';
import { TextProcessingService } from '../services/textProcessingService';
import { LingQService } from '../services/import/lingqService';

const prisma = new PrismaClient();

export const ctx: Context = {
  prisma,
  authService: new UserService(),
  configService: new ConfigService(),
  lessonService: new LessonService(),
  sentenceService: new SentenceService(),
  wordService: new WordService(),
  userLessonProgressService: new UserLessonProgressService(),
  userScoreService: new UserScoreService(),
  userActionLogService: new UserActionLogService(),
  userSettingService: new UserSettingService(),
  cronService: new CronService(),
  s3Service: new S3Service(),
  ttsService: new TtsService(),
  openaiService: new OpenAIService(),
  textProcessingService: new TextProcessingService(),
  lingqService: new LingQService(),
};

export type { Context };
