import { setTracingDisabled } from '@openai/agents';

export * from './wordPronunciationAgent';
export * from './wordTranslationAgent';
export * from './simplifyTranslationsAgent';
export * from './sentenceSplitterAgent';
export * from './wordStemAgent';
export * from './imageTextExtractorAgent';
export * from './sentenceTranslatorAgent';
export * from './lessonGeneratorAgent';

export type BaseAgentContext = {
  languageCode: string;
};

setTracingDisabled(true);
