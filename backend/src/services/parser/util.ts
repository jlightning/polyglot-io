/**
 * Utility functions for processing subtitles
 */

export interface Subtitle {
  type: 'caption';
  text: string;
  start: number; // in milliseconds
  end: number; // in milliseconds
}

/**
 * Sort subtitles by start time and remove adjacent duplicates with time merging
 * When duplicate subtitles are found next to each other, they are merged:
 * - The text is kept from the first occurrence
 * - The start time is the earliest start time
 * - The end time is the latest end time
 *
 * @param subtitles - Array of subtitle objects to process
 * @returns Sorted and deduplicated array of subtitles
 */
export function sortAndDeduplicateSubtitles<T extends Subtitle>(
  subtitles: T[]
): T[] {
  if (subtitles.length === 0) {
    return subtitles;
  }

  // Sort by start time
  const sorted = [...subtitles].sort((a, b) => a.start - b.start);

  // Remove duplicate sentences that are the same and next to each other, merging times
  const deduplicated: T[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    const previous = deduplicated[deduplicated.length - 1];

    // If this is the first subtitle or the text is different from the previous one, add it
    if (!previous || previous.text !== current.text) {
      deduplicated.push(current);
    } else {
      // Merge with previous: keep earliest start and latest end
      previous.start = Math.min(previous.start, current.start);
      previous.end = Math.max(previous.end, current.end);
    }
  }

  return deduplicated;
}
