/**
 * Custom ASS parser that parses Advanced SubStation Alpha subtitle files
 * Returns the same structure as srtParser for compatibility
 * Implemented without external dependencies
 */

export interface AssSubtitle {
  type: 'caption';
  text: string;
  start: number; // in milliseconds
  end: number; // in milliseconds
}

/**
 * Strip ASS formatting tags from text
 * Removes tags like {\an8}, {\b1}, {\i1}, {\u1}, etc.
 */
function stripAssTags(text: string): string {
  // Remove ASS override tags: {\...} or {\...\...}
  // This regex matches { followed by backslash, any characters, and closing }
  let cleaned = text.replace(/\{[^}]*\\?[^}]*\}/g, '');

  // Remove any remaining backslashes that might be escape characters
  cleaned = cleaned.replace(/\\N/g, '\n'); // Convert \N to newline
  cleaned = cleaned.replace(/\\n/g, '\n'); // Convert \n to newline
  cleaned = cleaned.replace(/\\h/g, ' '); // Convert \h to space

  return cleaned.trim();
}

/**
 * Convert ASS timestamp (centiseconds) to milliseconds
 * ASS format: H:MM:SS.cc (hours:minutes:seconds.centiseconds)
 */
function assTimeToMs(timeString: string): number {
  // ASS timestamps are in format: H:MM:SS.cc or 0:00:00.00
  const parts = timeString.split(':');
  if (parts.length !== 3) {
    throw new Error(`Invalid ASS timestamp format: ${timeString}`);
  }

  const hours = parseInt(parts[0]!, 10);
  const minutes = parseInt(parts[1]!, 10);
  const [seconds, centiseconds = '0'] = parts[2]!.split('.');

  const totalMs =
    hours * 3600000 +
    minutes * 60000 +
    parseInt(seconds!, 10) * 1000 +
    parseInt(centiseconds, 10) * 10; // centiseconds to milliseconds

  return totalMs;
}

/**
 * Parse ASS file content and return an array of subtitle objects
 * ASS file format:
 * [Script Info]
 * ...
 * [V4+ Styles]
 * ...
 * [Events]
 * Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
 * Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Hello, world!
 *
 * @param assContent - The ASS file content as a string
 * @returns Array of subtitle objects with type, text, start, and end properties
 */
export function parseAss(assContent: string): AssSubtitle[] {
  try {
    // Normalize line endings
    const content = assContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = content.split('\n');

    const subtitles: AssSubtitle[] = [];
    let inEventsSection = false;
    let formatLine: string | null = null;
    let startIndex = -1;
    let endIndex = -1;
    let textIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();

      // Check if we're entering the Events section
      if (line.startsWith('[Events]')) {
        inEventsSection = true;
        continue;
      }

      // Check if we're leaving the Events section (entering a new section)
      if (inEventsSection && line.startsWith('[') && line.endsWith(']')) {
        break;
      }

      // Skip empty lines and comments
      if (!line || line.startsWith(';') || line.startsWith('!')) {
        continue;
      }

      if (inEventsSection) {
        // Parse Format line to understand column order
        if (line.toLowerCase().startsWith('format:')) {
          formatLine = line.substring(7).trim();
          const formatFields = formatLine
            .split(',')
            .map(f => f.trim().toLowerCase());
          startIndex = formatFields.indexOf('start');
          endIndex = formatFields.indexOf('end');
          textIndex = formatFields.indexOf('text');
          continue;
        }

        // Parse Dialogue or Comment lines
        // Dialogue format: Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
        // Comment format: Comment: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
        if (line.startsWith('Dialogue:') || line.startsWith('Comment:')) {
          // Skip Comment lines, only process Dialogue
          if (line.startsWith('Comment:')) {
            continue;
          }

          // Extract the data part after "Dialogue:"
          const dataStart = line.indexOf(':');
          if (dataStart === -1) {
            continue;
          }

          const dataPart = line.substring(dataStart + 1).trim();

          // Split by comma, but be careful because Text can contain commas
          // The Text field is always the last field, so we need special handling
          let fields: string[] = [];

          if (
            formatLine &&
            startIndex !== -1 &&
            endIndex !== -1 &&
            textIndex !== -1
          ) {
            // Use format information to split correctly
            // Text is always the last field, so split everything before it normally
            const parts = dataPart.split(',');
            const numFieldsBeforeText = textIndex;

            // Take the first numFieldsBeforeText parts, then join the rest as text
            fields = parts.slice(0, numFieldsBeforeText);
            fields.push(parts.slice(numFieldsBeforeText).join(','));
          } else {
            // Fallback: assume standard format and split carefully
            // Format is usually: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
            // Text is the last field and can contain commas
            const parts = dataPart.split(',');
            if (parts.length >= 10) {
              // Standard format with 10 fields
              fields = parts.slice(0, 9);
              fields.push(parts.slice(9).join(',')); // Join remaining as text
            } else {
              // Non-standard format, try to parse anyway
              // Assume last field is text
              fields = parts.slice(0, parts.length - 1);
              fields.push(parts[parts.length - 1]!);
            }
          }

          // Extract timestamps (Start is typically index 1, End is index 2)
          // But use format indices if available
          const startTimeStr =
            startIndex !== -1 && fields[startIndex]
              ? fields[startIndex]!.trim()
              : fields.length > 1
                ? fields[1]!.trim()
                : null;
          const endTimeStr =
            endIndex !== -1 && fields[endIndex]
              ? fields[endIndex]!.trim()
              : fields.length > 2
                ? fields[2]!.trim()
                : null;
          const textStr =
            textIndex !== -1 && fields[textIndex]
              ? fields[textIndex]!.trim()
              : fields.length > 0
                ? fields[fields.length - 1]!.trim()
                : '';

          if (!startTimeStr || !endTimeStr || !textStr) {
            continue; // Skip invalid entries
          }

          // Parse timestamps
          let startMs: number;
          let endMs: number;
          try {
            startMs = assTimeToMs(startTimeStr);
            endMs = assTimeToMs(endTimeStr);
          } catch (error) {
            console.warn(
              `Skipping dialogue with invalid timestamp: ${startTimeStr} -> ${endTimeStr}`
            );
            continue;
          }

          // Strip ASS formatting tags from the text
          let cleanText = stripAssTags(textStr);

          // Replace newlines with spaces for consistency with SRT parser
          cleanText = cleanText.replace(/\n/g, ' ').trim();

          if (!cleanText) {
            continue; // Skip empty entries after cleaning
          }

          subtitles.push({
            type: 'caption',
            text: cleanText,
            start: startMs,
            end: endMs,
          });
        }
      }
    }

    if (subtitles.length === 0) {
      throw new Error(
        'No valid subtitle entries found in ASS file. The file may be empty or have no dialogue events.'
      );
    }

    return subtitles;
  } catch (error) {
    console.error('Error parsing ASS content:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to parse ASS file: ${errorMessage}. Please ensure the file is in valid ASS format.`
    );
  }
}
