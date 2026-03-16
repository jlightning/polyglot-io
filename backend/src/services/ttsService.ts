import type { Context } from './index';

const MAX_CACHE_ENTRIES = 200;

/**
 * In-memory TTS cache. Key: `${languageCode}:${normalizedText}`.
 * Uses a simple FIFO eviction when at capacity (no LRU for MVP).
 */
export class TtsService {
  private cache = new Map<string, Buffer>();
  private keyOrder: string[] = [];

  private evictOne(): void {
    if (this.keyOrder.length === 0) return;
    const oldest = this.keyOrder.shift();
    if (oldest) this.cache.delete(oldest);
  }

  /**
   * Get TTS audio from cache or generate via OpenAI and cache the result.
   * Text is normalized (trimmed). No persistence; cache is process memory only.
   */
  async getCachedOrGenerateVoice(
    ctx: Context,
    text: string,
    languageCode: string
  ): Promise<Buffer> {
    const normalizedText = text.trim();
    const key = `${languageCode}:${normalizedText}`;

    const cached = this.cache.get(key);
    if (cached) return cached;

    const buffer = await ctx.openaiService.generateSpeech(
      ctx,
      normalizedText,
      languageCode
    );

    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      this.evictOne();
    }
    this.cache.set(key, buffer);
    this.keyOrder.push(key);

    return buffer;
  }
}
