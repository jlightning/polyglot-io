import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Box, Flex } from '@radix-ui/themes';
import WordSidebar from '../components/WordSidebar';

export interface WordSidebarContextValue {
  isOpen: boolean;
  selectedWord: string | null;
  languageCode: string | undefined;
  openWordSidebar: (word: string, lang?: string) => void;
  closeWordSidebar: () => void;
  setWordSidebarLanguage: (lang: string | undefined) => void;
  /** Portal-like slot: renders at the bottom of `WordSidebar`. Clear with `null` on unmount. */
  sidebarFooter: ReactNode | null;
  setSidebarFooter: (node: ReactNode | null) => void;
}

const WordSidebarContext = createContext<WordSidebarContextValue | undefined>(
  undefined
);

export const useWordSidebar = (): WordSidebarContextValue => {
  const ctx = useContext(WordSidebarContext);
  if (!ctx) {
    throw new Error('useWordSidebar must be used within WordSidebarProvider');
  }
  return ctx;
};

export const WordSidebarProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [languageCode, setLanguageCodeState] = useState<string | undefined>();

  const [sidebarFooter, setSidebarFooter] = useState<ReactNode | null>(null);

  const openWordSidebar = useCallback((word: string, lang?: string) => {
    setSelectedWord(word);
    setIsOpen(true);
    if (lang !== undefined) setLanguageCodeState(lang);
  }, []);

  const closeWordSidebar = useCallback(() => {
    setIsOpen(false);
    setSelectedWord(null);
  }, []);

  const setWordSidebarLanguage = useCallback((lang: string | undefined) => {
    setLanguageCodeState(lang);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      selectedWord,
      languageCode,
      openWordSidebar,
      closeWordSidebar,
      setWordSidebarLanguage,
      sidebarFooter,
      setSidebarFooter,
    }),
    [
      isOpen,
      selectedWord,
      languageCode,
      openWordSidebar,
      closeWordSidebar,
      setWordSidebarLanguage,
      sidebarFooter,
      setSidebarFooter,
    ]
  );

  return (
    <WordSidebarContext.Provider value={value}>
      <Flex
        gap="0"
        align="stretch"
        style={{
          flex: 1,
          width: '100%',
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <Box
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </Box>
        <WordSidebar
          isOpen={isOpen}
          onClose={closeWordSidebar}
          selectedWord={selectedWord}
          languageCode={languageCode}
          targetLanguage="en"
          footer={sidebarFooter}
        />
      </Flex>
    </WordSidebarContext.Provider>
  );
};
