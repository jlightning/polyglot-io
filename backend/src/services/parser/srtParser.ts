/**
 * Custom SRT parser that parses SubRip subtitle files
 * Returns the same structure as subsrt-ts for compatibility
 */

export interface SrtSubtitle {
  type: 'caption';
  text: string;
  start: number; // in milliseconds
  end: number; // in milliseconds
}

/**
 * Parse SRT file content and return an array of subtitle objects
 * @param srtContent - The SRT file content as a string
 * @returns Array of subtitle objects with type, text, start, and end properties
 */
export function parseSrt(srtContent: string): SrtSubtitle[] {
  const subtitles: SrtSubtitle[] = [];

  // Normalize line endings
  const content = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into blocks (each subtitle entry is separated by blank lines)
  const blocks = content.split(/\n\s*\n/).filter(block => block.trim());

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);

    if (lines.length < 2) continue; // Need at least sequence number and timestamp

    // First line should be the sequence number (we'll skip validation)
    // Second line should be the timestamp line
    const timestampLine = lines[1];
    if (!timestampLine) continue;

    // Parse timestamp: "00:00:00,000 --> 00:00:02,000" or "00:00:00.000 --> 00:00:02.000"
    const timestampMatch = timestampLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );

    if (!timestampMatch || timestampMatch.length < 9) continue; // Skip invalid timestamp lines

    // Extract start and end times (match groups are guaranteed to exist due to regex)
    const startHours = parseInt(timestampMatch[1]!, 10);
    const startMinutes = parseInt(timestampMatch[2]!, 10);
    const startSeconds = parseInt(timestampMatch[3]!, 10);
    const startMilliseconds = parseInt(timestampMatch[4]!, 10);

    const endHours = parseInt(timestampMatch[5]!, 10);
    const endMinutes = parseInt(timestampMatch[6]!, 10);
    const endSeconds = parseInt(timestampMatch[7]!, 10);
    const endMilliseconds = parseInt(timestampMatch[8]!, 10);

    // Convert to milliseconds
    const startMs =
      startHours * 3600000 +
      startMinutes * 60000 +
      startSeconds * 1000 +
      startMilliseconds;

    const endMs =
      endHours * 3600000 +
      endMinutes * 60000 +
      endSeconds * 1000 +
      endMilliseconds;

    // Remaining lines are the subtitle text
    const textLines = lines.slice(2);
    const text = textLines.join('\n').trim();

    if (!text) continue; // Skip empty subtitles

    subtitles.push({
      type: 'caption',
      text: text,
      start: startMs,
      end: endMs,
    });
  }

  return subtitles;
}
