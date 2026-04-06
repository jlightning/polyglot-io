import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';

/** Full-width digit characters (U+FF10–U+FF19) for display */
const FULL_WIDTH_DIGITS = '０１２３４５６７８９';

/**
 * Converts ASCII digits (0-9) in a word string to full-width Japanese numerals.
 * Use when displaying words so that e.g. "1年" is shown as "１年".
 */
export function wordWithFullWidthDigits(word: string): string {
  if (!word) return word;
  return word.replace(/[0-9]/g, d => FULL_WIDTH_DIGITS[parseInt(d, 10)] ?? d);
}

/**
 * Converts full-width digits (０–９) to ASCII so marks stored under "1体" match lookup "１体".
 */
export function wordWithAsciiDigits(word: string): string {
  if (!word) return word;
  let out = '';
  for (const ch of word) {
    const c = ch.codePointAt(0)!;
    if (c >= 0xff10 && c <= 0xff19) {
      out += String.fromCodePoint(c - 0xff10 + 0x30);
    } else {
      out += ch;
    }
  }
  return out;
}

interface WordMarkContextType {
  // Get word mark (returns undefined if not marked)
  getWordMark: (word: string) => number | undefined;
  // Save word mark with note via API - this updates both local state and backend
  saveWordMark: (
    word: string,
    mark: number,
    note: string,
    languageCode: string
  ) => Promise<boolean>;
  // Add new words to track - context will automatically fetch marks for unfetched words
  addWords: (words: string[], languageCode: string) => Promise<void>;
  // Clear all word marks (useful when switching languages/users)
  clearWordMarks: () => void;
  // Check if we're currently fetching word marks
  isFetching: boolean;
  // Check if we're currently saving a word mark
  isSaving: boolean;
}

const WordMarkContext = createContext<WordMarkContextType | undefined>(
  undefined
);

export const useWordMark = (): WordMarkContextType => {
  const context = useContext(WordMarkContext);
  if (!context) {
    throw new Error('useWordMark must be used within a WordMarkProvider');
  }
  return context;
};

interface WordMarkProviderProps {
  children: ReactNode;
}

export const WordMarkProvider: React.FC<WordMarkProviderProps> = ({
  children,
}) => {
  const { axiosInstance, fetchUserStats } = useAuth();
  const { selectedLanguage } = useLanguage();
  const [wordMarks, setWordMarks] = useState<Map<string, number>>(new Map());
  const [fetchedWords, setFetchedWords] = useState<Set<string>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const getWordMark = useCallback(
    (word: string): number | undefined => {
      const ascii = wordWithAsciiDigits(word);
      const fullWidth = wordWithFullWidthDigits(word);
      return (
        wordMarks.get(word) ?? wordMarks.get(fullWidth) ?? wordMarks.get(ascii)
      );
    },
    [wordMarks]
  );

  const saveWordMark = useCallback(
    async (
      word: string,
      mark: number,
      note: string,
      languageCode: string
    ): Promise<boolean> => {
      if (!axiosInstance) return false;

      try {
        setIsSaving(true);
        const response = await axiosInstance.post('/api/words/mark', {
          word,
          languageCode,
          note: note.trim(),
          mark,
        });

        if (response.data.success) {
          // Update local state
          setWordMarks(prev => new Map(prev).set(word, mark));
          // Mark this word as fetched since we now have its data
          setFetchedWords(prev => new Set([...prev, word]));
          // Update user stats after successfully saving word mark
          fetchUserStats(selectedLanguage);
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error saving word mark:', error);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [axiosInstance, fetchUserStats, selectedLanguage]
  );

  const addWords = useCallback(
    async (words: string[], languageCode: string) => {
      if (!axiosInstance || !languageCode) return;

      // Filter out words we've already fetched
      const wordsToFetch = words.filter(word => !fetchedWords.has(word));

      if (wordsToFetch.length === 0) return;

      try {
        setIsFetching(true);

        // Fetch marks for all unfetched words in a single request
        const response = await axiosInstance.post('/api/words/marks/bulk', {
          words: wordsToFetch,
          languageCode,
        });

        if (response.data.success) {
          const marks = response.data.data ?? [];

          const newFetchedWords = new Set([...fetchedWords, ...wordsToFetch]);
          setWordMarks(
            prev =>
              new Map([
                ...prev,
                ...marks.map((m: { word: string; mark: number }) => [
                  m.word,
                  m.mark,
                ]),
              ])
          );
          setFetchedWords(newFetchedWords);
        } else {
          console.error('Error fetching word marks:', response.data.message);
          // Still mark words as fetched to avoid repeated failed requests
          const newFetchedWords = new Set(fetchedWords);
          wordsToFetch.forEach(word => newFetchedWords.add(word));
          setFetchedWords(newFetchedWords);
        }
      } catch (error) {
        console.error('Error fetching word marks:', error);
        // Still mark words as fetched to avoid repeated failed requests
        const newFetchedWords = new Set(fetchedWords);
        wordsToFetch.forEach(word => newFetchedWords.add(word));
        setFetchedWords(newFetchedWords);
      } finally {
        setIsFetching(false);
      }
    },
    [axiosInstance, fetchedWords]
  );

  const clearWordMarks = useCallback(() => {
    setWordMarks(new Map());
    setFetchedWords(new Set());
  }, []);

  const contextValue: WordMarkContextType = {
    getWordMark,
    saveWordMark,
    addWords,
    clearWordMarks,
    isFetching,
    isSaving,
  };

  return (
    <WordMarkContext.Provider value={contextValue}>
      {children}
    </WordMarkContext.Provider>
  );
};
