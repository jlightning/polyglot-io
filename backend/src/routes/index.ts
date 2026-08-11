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
import { ChartService } from '../services/chartService';
import { UserSettingService } from '../services/userSettingService';
import { CronService } from '../services/cronService';
import { S3Service } from '../services/s3Service';
import { TtsService } from '../services/ttsService';
import { OpenAIService } from '../services/ai/openaiService';
import { TextProcessingService } from '../services/textProcessingService';
import { LingQService } from '../services/import/lingqService';
import { loadAgentRuntimeConfig } from '../services/agentRuntime/config';
import { TmuxRuntime } from '../services/agentRuntime/tmuxRuntime';
import { AgentSessionService } from '../services/agentRuntime/agentSessionService';

const prisma = new PrismaClient();
const tmuxRuntime = new TmuxRuntime(loadAgentRuntimeConfig());

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
  chartService: new ChartService(),
  userSettingService: new UserSettingService(),
  cronService: new CronService(),
  s3Service: new S3Service(),
  ttsService: new TtsService(),
  openaiService: new OpenAIService({
    apiKey: process.env['OPENAI_API_KEY'],
    agentRuntimeEnabled: tmuxRuntime.config.enabled,
    provider: process.env['AI_PROVIDER'] as
      'auto' | 'openai' | 'agent_cli' | undefined,
  }),
  textProcessingService: new TextProcessingService(),
  lingqService: new LingQService(),
  agentSessionService: new AgentSessionService(tmuxRuntime),
};

export type { Context };
