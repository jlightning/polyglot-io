import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';

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
  const { axiosInstance, fetchDailyScore } = useAuth();
  const [wordMarks, setWordMarks] = useState<Record<string, number>>({});
  const [fetchedWords, setFetchedWords] = useState<Set<string>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const getWordMark = useCallback(
    (word: string): number | undefined => {
      return wordMarks[word];
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
          setWordMarks(prev => ({
            ...prev,
            [word]: mark,
          }));
          // Mark this word as fetched since we now have its data
          setFetchedWords(prev => new Set([...prev, word]));
          // Update daily score after successfully saving word mark
          fetchDailyScore();
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
    [axiosInstance, fetchDailyScore]
  );

  const addWords = useCallback(
    async (words: string[], languageCode: string) => {
      if (!axiosInstance || !languageCode) return;

      // Filter out words we've already fetched
      const wordsToFetch = words.filter(word => !fetchedWords.has(word));

      if (wordsToFetch.length === 0) return;

      try {
        setIsFetching(true);

        // Fetch marks for each unfetched word
        const markPromises = wordsToFetch.map(async word => {
          try {
            const response = await axiosInstance.get(
              `/api/words/mark/${encodeURIComponent(word)}/${languageCode}`
            );
            return {
              word,
              mark:
                response.data.success && response.data.data
                  ? response.data.data.mark
                  : null,
            };
          } catch (error) {
            // If there's an error fetching a specific word, just return null
            return { word, mark: null };
          }
        });

        const results = await Promise.all(markPromises);

        // Update word marks state
        const newMarks: Record<string, number> = {};
        const newFetchedWords = new Set(fetchedWords);

        results.forEach(({ word, mark }) => {
          newFetchedWords.add(word);
          if (mark !== null) {
            newMarks[word] = mark;
          }
        });

        // Update state
        setWordMarks(prev => ({ ...prev, ...newMarks }));
        setFetchedWords(newFetchedWords);
      } catch (error) {
        console.error('Error fetching word marks:', error);
      } finally {
        setIsFetching(false);
      }
    },
    [axiosInstance, fetchedWords]
  );

  const clearWordMarks = useCallback(() => {
    setWordMarks({});
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
