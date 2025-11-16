import { parse } from 'subsrt-ts';

export interface ProcessedSentence {
  text: string;
  startTime?: number | undefined; // in milliseconds
  endTime?: number | undefined; // in milliseconds
}

// Mapping of all half-width katakana (半角カタカナ) to full-width katakana
export const halfWidthToFullWidthKatakana: { [key: string]: string } = {
  '\uFF65': '\u30FB', // ･ → ・ (middle dot)
  '\uFF66': '\u30F2', // ｦ → ヲ
  '\uFF67': '\u30A1', // ｧ → ァ
  '\uFF68': '\u30A3', // ｨ → ィ
  '\uFF69': '\u30A5', // ｩ → ゥ
  '\uFF6A': '\u30A7', // ｪ → ェ
  '\uFF6B': '\u30A9', // ｫ → ォ
  '\uFF6C': '\u30E3', // ｬ → ャ
  '\uFF6D': '\u30E5', // ｭ → ュ
  '\uFF6E': '\u30E7', // ｮ → ョ
  '\uFF6F': '\u30C3', // ｯ → ッ
  '\uFF70': '\u30FC', // ｰ → ー (prolonged sound mark)
  '\uFF71': '\u30A2', // ｱ → ア
  '\uFF72': '\u30A4', // ｲ → イ
  '\uFF73': '\u30A6', // ｳ → ウ
  '\uFF74': '\u30A8', // ｴ → エ
  '\uFF75': '\u30AA', // ｵ → オ
  '\uFF76': '\u30AB', // ｶ → カ
  '\uFF77': '\u30AD', // ｷ → キ
  '\uFF78': '\u30AF', // ｸ → ク
  '\uFF79': '\u30B1', // ｹ → ケ
  '\uFF7A': '\u30B3', // ｺ → コ
  '\uFF7B': '\u30B5', // ｻ → サ
  '\uFF7C': '\u30B7', // ｼ → シ
  '\uFF7D': '\u30B9', // ｽ → ス
  '\uFF7E': '\u30BB', // ｾ → セ
  '\uFF7F': '\u30BD', // ｿ → ソ
  '\uFF80': '\u30BF', // ﾀ → タ
  '\uFF81': '\u30C1', // ﾁ → チ
  '\uFF82': '\u30C4', // ﾂ → ツ
  '\uFF83': '\u30C6', // ﾃ → テ
  '\uFF84': '\u30C8', // ﾄ → ト
  '\uFF85': '\u30CA', // ﾅ → ナ
  '\uFF86': '\u30CB', // ﾆ → ニ
  '\uFF87': '\u30CC', // ﾇ → ヌ
  '\uFF88': '\u30CD', // ﾈ → ネ
  '\uFF89': '\u30CE', // ﾉ → ノ
  '\uFF8A': '\u30CF', // ﾊ → ハ
  '\uFF8B': '\u30D2', // ﾋ → ヒ
  '\uFF8C': '\u30D5', // ﾌ → フ
  '\uFF8D': '\u30D8', // ﾍ → ヘ
  '\uFF8E': '\u30DB', // ﾎ → ホ
  '\uFF8F': '\u30DE', // ﾏ → マ
  '\uFF90': '\u30DF', // ﾐ → ミ
  '\uFF91': '\u30E0', // ﾑ → ム
  '\uFF92': '\u30E1', // ﾒ → メ
  '\uFF93': '\u30E2', // ﾓ → モ
  '\uFF94': '\u30E4', // ﾔ → ヤ
  '\uFF95': '\u30E6', // ﾕ → ユ
  '\uFF96': '\u30E8', // ﾖ → ヨ
  '\uFF97': '\u30E9', // ﾗ → ラ
  '\uFF98': '\u30EA', // ﾘ → リ
  '\uFF99': '\u30EB', // ﾙ → ル
  '\uFF9A': '\u30EC', // ﾚ → レ
  '\uFF9B': '\u30ED', // ﾛ → ロ
  '\uFF9C': '\u30EF', // ﾜ → ワ
  '\uFF9D': '\u30F3', // ﾝ → ン
  '\uFF9E': '\u309B', // ﾞ → ゛ (voiced sound mark)
  '\uFF9F': '\u309C', // ﾟ → ゜ (semi-voiced sound mark)
};

// Handle voiced marks (ﾞ and ﾟ) with preceding characters
// First, handle combinations like ｶﾞ → ガ
export const voicedMarkMap: { [key: string]: string } = {
  '\uFF76\uFF9E': '\u30AC', // ｶﾞ → ガ
  '\uFF77\uFF9E': '\u30AE', // ｷﾞ → ギ
  '\uFF78\uFF9E': '\u30B0', // ｸﾞ → グ
  '\uFF79\uFF9E': '\u30B2', // ｹﾞ → ゲ
  '\uFF7A\uFF9E': '\u30B4', // ｺﾞ → ゴ
  '\uFF7B\uFF9E': '\u30B6', // ｻﾞ → ザ
  '\uFF7C\uFF9E': '\u30B8', // ｼﾞ → ジ
  '\uFF7D\uFF9E': '\u30BA', // ｽﾞ → ズ
  '\uFF7E\uFF9E': '\u30BC', // ｾﾞ → ゼ
  '\uFF7F\uFF9E': '\u30BE', // ｿﾞ → ゾ
  '\uFF80\uFF9E': '\u30C0', // ﾀﾞ → ダ
  '\uFF81\uFF9E': '\u30C2', // ﾁﾞ → ヂ
  '\uFF82\uFF9E': '\u30C5', // ﾂﾞ → ヅ
  '\uFF83\uFF9E': '\u30C7', // ﾃﾞ → デ
  '\uFF84\uFF9E': '\u30C9', // ﾄﾞ → ド
  '\uFF8A\uFF9E': '\u30D0', // ﾊﾞ → バ
  '\uFF8B\uFF9E': '\u30D3', // ﾋﾞ → ビ
  '\uFF8C\uFF9E': '\u30D6', // ﾌﾞ → ブ
  '\uFF8D\uFF9E': '\u30D9', // ﾍﾞ → ベ
  '\uFF8E\uFF9E': '\u30DC', // ﾎﾞ → ボ
  '\uFF8A\uFF9F': '\u30D1', // ﾊﾟ → パ
  '\uFF8B\uFF9F': '\u30D4', // ﾋﾟ → ピ
  '\uFF8C\uFF9F': '\u30D7', // ﾌﾟ → プ
  '\uFF8D\uFF9F': '\u30DA', // ﾍﾟ → ペ
  '\uFF8E\uFF9F': '\u30DD', // ﾎﾟ → ポ
  '\uFF73\uFF9E': '\u30F4', // ｳﾞ → ヴ
  '\uFF9C\uFF9E': '\u30F7', // ﾜﾞ → ヷ
  '\uFF66\uFF9E': '\u30FA', // ｦﾞ → ヺ
};

export class TextProcessingService {
  /**
   * Parse SRT file content and extract sentences with timing information
   */
  static parseSrtContent(srtContent: string): ProcessedSentence[] {
    try {
      // Parse the SRT content using subsrt-ts
      const subtitles = parse(srtContent);

      const sentences: ProcessedSentence[] = [];

      for (const subtitle of subtitles) {
        // Only process content captions, skip meta and style captions
        if (subtitle.type !== 'caption') continue;

        // Clean up the text (remove HTML tags, extra whitespace)
        let cleanText = subtitle.text
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/\n/g, ' ') // Replace newlines with spaces
          .trim();

        // Normalize katakana (convert small to big)
        cleanText = this.normalizeKatakana(cleanText);

        if (!cleanText) continue; // Skip empty entries

        // subsrt-ts returns times in milliseconds already
        const startTimeMs = subtitle.start;
        const endTimeMs = subtitle.end;

        // Split long subtitle entries into sentences if they contain multiple sentences
        const splitSentences = this.splitIntoSentences(cleanText);

        if (splitSentences.length === 1) {
          // Single sentence, use the exact timing
          sentences.push({
            text: cleanText,
            startTime: startTimeMs,
            endTime: endTimeMs,
          });
        } else {
          // Multiple sentences in one subtitle entry
          // Distribute the timing proportionally based on character count
          const totalChars = cleanText.length;
          const duration = endTimeMs - startTimeMs;
          let currentTime = startTimeMs;

          for (let i = 0; i < splitSentences.length; i++) {
            const sentence = splitSentences[i]?.trim();
            if (!sentence) continue;

            const sentenceChars = sentence.length;
            const sentenceDuration = (sentenceChars / totalChars) * duration;
            const sentenceEndTime = currentTime + sentenceDuration;

            sentences.push({
              text: sentence,
              startTime: Math.round(currentTime),
              endTime: Math.round(sentenceEndTime),
            });

            currentTime = sentenceEndTime;
          }
        }
      }

      return sentences;
    } catch (error) {
      console.error('Error parsing SRT content:', error);
      throw new Error(
        'Failed to parse SRT file. Please ensure the file is in valid SRT format.'
      );
    }
  }

  /**
   * Parse plain text content and split into sentences (no timing information)
   */
  static parseTxtContent(txtContent: string): ProcessedSentence[] {
    try {
      // Clean up the text
      let cleanText = txtContent
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\r/g, '\n') // Handle old Mac line endings
        .trim();

      // Normalize katakana (convert small to big)
      cleanText = this.normalizeKatakana(cleanText);

      if (!cleanText) {
        throw new Error('Text file is empty or contains no readable content.');
      }

      // Split into sentences
      const sentences = this.splitIntoSentences(cleanText);

      return sentences
        .map(sentence => sentence.trim())
        .filter(sentence => sentence.length > 0)
        .map(sentence => ({
          text: sentence,
          startTime: undefined as number | undefined,
          endTime: undefined as number | undefined,
        }));
    } catch (error) {
      console.error('Error parsing TXT content:', error);
      throw new Error(
        'Failed to parse text file. Please ensure the file contains valid text content.'
      );
    }
  }

  /**
   * Convert half-width katakana characters to their full-size equivalents
   * Normalizes katakana for consistent representation
   */
  static normalizeKatakana(text: string): string {
    let normalized = text;

    // First, replace voiced mark combinations (2-character sequences)
    for (const [halfWidth, fullWidth] of Object.entries(voicedMarkMap)) {
      normalized = normalized.replace(new RegExp(halfWidth, 'g'), fullWidth);
    }

    // Convert all remaining half-width katakana characters to their full-width equivalents
    for (const [halfWidth, fullWidth] of Object.entries(
      halfWidthToFullWidthKatakana
    )) {
      normalized = normalized.replace(new RegExp(halfWidth, 'g'), fullWidth);
    }

    return normalized;
  }

  /**
   * Split text into sentences using multiple delimiters and rules
   * Supports Western languages (English, etc.) and CJK languages (Japanese, Korean, Chinese)
   */
  private static splitIntoSentences(text: string): string[] {
    // Enhanced sentence splitting that supports both Western and CJK punctuation
    // Western: . ! ?
    // CJK: 。 (U+3002) ！ (U+FF01) ？ (U+FF1F) ～ (U+FF5E) ‥ (U+2025) … (U+2026)

    const sentences: string[] = [];

    // Extended regex pattern to include CJK punctuation marks
    // Western punctuation: [.!?]
    // CJK punctuation: \u3002 (。) \uFF01 (！) \uFF1F (？) \uFF5E (～) \u2025 (‥) \u2026 (…)
    const sentenceEndPattern =
      /([.!?\u3002\uFF01\uFF1F\uFF5E\u2025\u2026]+\s+|[.!?\u3002\uFF01\uFF1F\uFF5E\u2025\u2026]+$)/;
    const parts = text.split(sentenceEndPattern);

    let currentSentence = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (part && sentenceEndPattern.test(part)) {
        // This is punctuation, add it to current sentence and finalize
        currentSentence += part.replace(/\s+$/, ''); // Remove trailing whitespace
        if (currentSentence.trim()) {
          sentences.push(currentSentence.trim());
        }
        currentSentence = '';
      } else if (part) {
        // This is text content
        currentSentence += part;
      }
    }

    // Add any remaining text as a sentence
    if (currentSentence.trim()) {
      sentences.push(currentSentence.trim());
    }

    // Filter out very short "sentences" that are likely not real sentences
    // For CJK languages, even single characters can be meaningful, so we use a lower threshold
    return sentences.filter(sentence => {
      const cleanSentence = sentence
        .replace(/[.!?\u3002\uFF01\uFF1F\uFF5E\u2025\u2026]+$/, '')
        .trim();
      // Check if the sentence contains CJK characters
      const hasCJK =
        /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uAC00-\uD7AF]/.test(
          cleanSentence
        );
      // Use lower threshold for CJK text (1 character) vs Western text (3 characters)
      return hasCJK ? cleanSentence.length >= 1 : cleanSentence.length >= 3;
    });
  }

  /**
   * Determine file type based on content or file extension
   */
  static getFileType(content: string, fileName?: string): 'srt' | 'txt' {
    // Check if content looks like SRT format
    const srtPattern =
      /^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/m;

    if (srtPattern.test(content)) {
      return 'srt';
    }

    // Check file extension if available
    if (fileName && fileName.toLowerCase().endsWith('.srt')) {
      return 'srt';
    }

    // Default to txt
    return 'txt';
  }

  /**
   * Main processing function that handles both SRT and TXT files
   */
  static processLessonFile(
    content: string,
    fileName?: string
  ): ProcessedSentence[] {
    const fileType = this.getFileType(content, fileName);

    switch (fileType) {
      case 'srt':
        return this.parseSrtContent(content);
      case 'txt':
        return this.parseTxtContent(content);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }
}
