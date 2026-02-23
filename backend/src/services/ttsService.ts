import { OpenAIService } from './ai/openaiService';

const MAX_CACHE_ENTRIES = 200;

/**
 * In-memory TTS cache. Key: `${languageCode}:${normalizedText}`.
 * Uses a simple FIFO eviction when at capacity (no LRU for MVP).
 */
export class TtsService {
  private static cache = new Map<string, Buffer>();
  private static keyOrder: string[] = [];
  private static openAIService: OpenAIService | null = null;

  private static getOpenAIService(): OpenAIService {
    if (!TtsService.openAIService) {
      TtsService.openAIService = new OpenAIService();
    }
    return TtsService.openAIService;
  }

  private static evictOne(): void {
    if (TtsService.keyOrder.length === 0) return;
    const oldest = TtsService.keyOrder.shift();
    if (oldest) TtsService.cache.delete(oldest);
  }

  /**
   * Get TTS audio from cache or generate via OpenAI and cache the result.
   * Text is normalized (trimmed). No persistence; cache is process memory only.
   */
  static async getCachedOrGenerateVoice(
    text: string,
    languageCode: string
  ): Promise<Buffer> {
    const normalizedText = text.trim();
    const key = `${languageCode}:${normalizedText}`;

    const cached = TtsService.cache.get(key);
    if (cached) return cached;

    const buffer = await TtsService.getOpenAIService().generateSpeech(
      normalizedText,
      languageCode
    );

    if (TtsService.cache.size >= MAX_CACHE_ENTRIES) {
      TtsService.evictOne();
    }
    TtsService.cache.set(key, buffer);
    TtsService.keyOrder.push(key);

    return buffer;
  }
}
