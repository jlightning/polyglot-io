import { parse } from 'subsrt-ts';

export interface ProcessedSentence {
  text: string;
  startTime?: number | undefined; // in milliseconds
  endTime?: number | undefined; // in milliseconds
}

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
        const cleanText = subtitle.text
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/\n/g, ' ') // Replace newlines with spaces
          .trim();

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
      const cleanText = txtContent
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\r/g, '\n') // Handle old Mac line endings
        .trim();

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
