import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';

/**
 * Converts ASCII digits/letters to full-width so marks stored under "１年"/"Ｈカップ"
 * match lookup "1年"/"Hカップ".
 */
export function wordWithFullWidthDigits(word: string): string {
  if (!word) return word;
  let out = '';
  for (const ch of word) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x30 && c <= 0x39) {
      out += String.fromCodePoint(c - 0x30 + 0xff10);
    } else if (c >= 0x41 && c <= 0x5a) {
      out += String.fromCodePoint(c - 0x41 + 0xff21);
    } else if (c >= 0x61 && c <= 0x7a) {
      out += String.fromCodePoint(c - 0x61 + 0xff41);
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Converts full-width digits/letters to ASCII so marks stored under "1体"/"Hカップ"
 * match lookup "１体"/"Ｈカップ".
 */
export function wordWithAsciiDigits(word: string): string {
  if (!word) return word;
  let out = '';
  for (const ch of word) {
    const c = ch.codePointAt(0)!;
    if (c >= 0xff10 && c <= 0xff19) {
      out += String.fromCodePoint(c - 0xff10 + 0x30);
    } else if (c >= 0xff21 && c <= 0xff3a) {
      out += String.fromCodePoint(c - 0xff21 + 0x41);
    } else if (c >= 0xff41 && c <= 0xff5a) {
      out += String.fromCodePoint(c - 0xff41 + 0x61);
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
  // Seed marks from sentence.words (skips bulk fetch for those words)
  seedWordMarks: (words: { word: string; mark: number | null }[]) => void;
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
          const ascii = wordWithAsciiDigits(word);
          const fullWidth = wordWithFullWidthDigits(word);
          setWordMarks(prev => {
            const next = new Map(prev);
            next.set(word, mark);
            next.set(ascii, mark);
            next.set(fullWidth, mark);
            return next;
          });
          setFetchedWords(prev => new Set([...prev, word, ascii, fullWidth]));
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
          setWordMarks(prev => {
            const next = new Map(prev);
            for (const m of marks) {
              const { word, mark }: { word: string; mark: number } = m;
              next.set(word, mark);
              next.set(wordWithAsciiDigits(word), mark);
              next.set(wordWithFullWidthDigits(word), mark);
              newFetchedWords.add(wordWithAsciiDigits(word));
              newFetchedWords.add(wordWithFullWidthDigits(word));
            }
            return next;
          });
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

  const seedWordMarks = useCallback(
    (words: { word: string; mark: number | null }[]) => {
      if (words.length === 0) return;

      setWordMarks(prev => {
        const next = new Map(prev);
        for (const { word, mark } of words) {
          if (mark !== null) {
            next.set(word, mark);
            next.set(wordWithAsciiDigits(word), mark);
            next.set(wordWithFullWidthDigits(word), mark);
          }
        }
        return next;
      });
      setFetchedWords(prev => {
        const next = new Set(prev);
        for (const { word, mark } of words) {
          next.add(word);
          if (mark !== null) {
            next.add(wordWithAsciiDigits(word));
            next.add(wordWithFullWidthDigits(word));
          }
        }
        return next;
      });

      // Exact seed miss (e.g. mark under Ｈカップ, sentence has Hカップ) — fetch aliases
      if (!selectedLanguage) return;
      const aliases = [
        ...new Set(
          words.flatMap(({ word, mark }) => {
            if (mark !== null) return [];
            return [
              wordWithAsciiDigits(word),
              wordWithFullWidthDigits(word),
            ].filter(v => v !== word);
          })
        ),
      ];
      if (aliases.length > 0) {
        void addWords(aliases, selectedLanguage);
      }
    },
    [addWords, selectedLanguage]
  );

  const clearWordMarks = useCallback(() => {
    setWordMarks(new Map());
    setFetchedWords(new Set());
  }, []);

  const contextValue: WordMarkContextType = {
    getWordMark,
    saveWordMark,
    addWords,
    seedWordMarks,
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
