import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  Card,
  Separator,
  TextArea,
} from '@radix-ui/themes';
import { Cross2Icon, TrashIcon } from '@radix-ui/react-icons';
import { useAuth } from '../contexts/AuthContext';
import { useWordMark } from '../contexts/WordMarkContext';
import {
  getDifficultyStyles,
  getDifficultyLabel,
} from '../constants/difficultyColors';
import { useDebounce } from '../hooks/useDebounce';

interface WordTranslation {
  word: string;
  translation: string;
}

interface WordPronunciation {
  word: string;
  pronunciation: string;
  pronunciationType: string;
}

interface WordUserMark {
  id: number;
  note: string;
  mark: number;
  word: {
    id: number;
    word: string;
    language_code: string;
  };
}

interface WordSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedWord: string | null;
  wordTranslations: WordTranslation[] | null;
  wordPronunciations?: WordPronunciation[] | null;
  loading?: boolean;
  languageCode?: string;
}

const WordSidebar: React.FC<WordSidebarProps> = ({
  isOpen,
  onClose,
  selectedWord,
  wordTranslations,
  wordPronunciations,
  loading = false,
  languageCode,
}) => {
  const { axiosInstance } = useAuth();
  const { saveWordMark, isSaving } = useWordMark();
  const [note, setNote] = useState('');
  const [currentMark, setCurrentMark] = useState<number | null>(null);
  const [, setUserMark] = useState<WordUserMark | null>(null);
  const [loadingMark, setLoadingMark] = useState(false);

  const selectedTranslations =
    wordTranslations?.filter(wt => wt.word === selectedWord) || [];
  const selectedPronunciations =
    wordPronunciations?.filter(wp => wp.word === selectedWord) || [];

  // Load existing word mark when selectedWord changes
  useEffect(() => {
    const loadWordMark = async () => {
      if (!selectedWord || !languageCode || !axiosInstance) return;

      try {
        setLoadingMark(true);
        const response = await axiosInstance.get(
          `/api/words/mark/${encodeURIComponent(selectedWord)}/${languageCode}`
        );

        if (response.data.success && response.data.data) {
          const mark = response.data.data as WordUserMark;
          setUserMark(mark);
          setNote(mark.note || '');
          setCurrentMark(mark.mark);
        } else {
          setUserMark(null);
          setNote('');
          setCurrentMark(null);
        }
      } catch (error) {
        console.error('Error loading word mark:', error);
        setUserMark(null);
        setNote('');
        setCurrentMark(null);
      } finally {
        setLoadingMark(false);
      }
    };

    loadWordMark();
  }, [selectedWord, languageCode, axiosInstance]);

  const handleMarkSave = async (mark: number) => {
    if (!selectedWord || !languageCode) return;

    const success = await saveWordMark(selectedWord, mark, note, languageCode);
    if (success) {
      setCurrentMark(mark);
    }
  };

  // Debounced function to save note changes
  const debouncedNoteSave = useCallback(
    async (noteValue: string, mark: number) => {
      if (!selectedWord || !languageCode) return;
      await saveWordMark(selectedWord, mark, noteValue, languageCode);
    },
    [selectedWord, languageCode, saveWordMark]
  );

  // Use debounce hook with 500ms delay
  const debouncedNoteSaveWithDelay = useDebounce(debouncedNoteSave, 500);

  const handleNoteChange = (newNote: string) => {
    setNote(newNote);
    // Auto-save note if there's already a mark (debounced)
    if (currentMark !== null) {
      debouncedNoteSaveWithDelay(newNote, currentMark);
    }
  };

  // Reusable pronunciation component
  const PronunciationSection: React.FC<{
    pronunciations: WordPronunciation[];
  }> = ({ pronunciations }) => {
    if (pronunciations.length === 0) return null;

    return (
      <>
        <Box>
          <Text size="2" color="gray" mb="2" as="div">
            {pronunciations.length > 1 ? 'Pronunciations' : 'Pronunciation'}
          </Text>
          <Flex direction="column" gap="2">
            {pronunciations.map((pronunciation, index) => (
              <Box key={index}>
                <Text size="4" color="green" weight="medium">
                  {pronunciation.pronunciation}
                </Text>
                <Text size="2" color="gray" ml="2">
                  ({pronunciation.pronunciationType})
                </Text>
              </Box>
            ))}
          </Flex>
        </Box>
        <Separator size="4" />
      </>
    );
  };

  // Reusable rating buttons component
  const RatingButtons: React.FC<{
    currentMark: number | null;
    onMarkSave: (mark: number) => void;
    disabled: boolean;
  }> = ({ currentMark, onMarkSave, disabled }) => (
    <Flex gap="1" wrap="wrap">
      {/* Trash/Ignore button (0) */}
      <Button
        variant="soft"
        size="2"
        onClick={() => onMarkSave(0)}
        disabled={disabled}
        title="Ignore this word"
        style={{
          ...getDifficultyStyles(0),
          color: 'white',
          minWidth: '40px',
          minHeight: '40px',
          opacity: currentMark === 0 ? 1 : 0.7,
          boxShadow:
            currentMark === 0 ? '0 0 0 2px rgba(255, 255, 255, 0.5)' : 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <TrashIcon />
      </Button>

      {/* Rating buttons 1-5 */}
      {[1, 2, 3, 4, 5].map(mark => (
        <Button
          key={mark}
          variant="soft"
          size="2"
          onClick={() => onMarkSave(mark)}
          disabled={disabled}
          title={getDifficultyLabel(mark)}
          style={{
            ...getDifficultyStyles(mark),
            color: 'white',
            minWidth: '40px',
            minHeight: '40px',
            fontWeight: 'bold',
            opacity: currentMark === mark ? 1 : 0.7,
            boxShadow:
              currentMark === mark
                ? '0 0 0 2px rgba(255, 255, 255, 0.5)'
                : 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {mark}
        </Button>
      ))}
    </Flex>
  );

  // Reusable user mark section component
  const UserMarkSection: React.FC<{
    note: string;
    onNoteChange: (note: string) => void;
    currentMark: number | null;
    onMarkSave: (mark: number) => void;
    loadingMark: boolean;
  }> = ({ note, onNoteChange, currentMark, onMarkSave, loadingMark }) => (
    <>
      <Separator size="4" />
      <Box>
        <Text size="2" color="gray" mb="2" as="div">
          Your Note
        </Text>
        <TextArea
          placeholder="Add a note about this word..."
          value={note}
          onChange={e => onNoteChange(e.target.value)}
          disabled={isSaving || loadingMark}
          rows={3}
        />
      </Box>

      <Box>
        <Text size="2" color="gray" mb="2" as="div">
          Difficulty Rating
        </Text>
        <RatingButtons
          currentMark={currentMark}
          onMarkSave={onMarkSave}
          disabled={isSaving || loadingMark}
        />

        {currentMark !== null && (
          <Text size="1" color="gray" mt="1">
            {getDifficultyLabel(currentMark)}
            {isSaving && ' (saving...)'}
          </Text>
        )}
      </Box>
    </>
  );

  // Reusable word content component
  const WordContent: React.FC<{
    word: string;
    translations: WordTranslation[];
    pronunciations: WordPronunciation[];
    languageCode?: string | undefined;
  }> = ({ word, translations, pronunciations, languageCode }) => (
    <Card style={{ padding: '16px' }}>
      <Flex direction="column" gap="3">
        <Box>
          <Text size="2" color="gray" mb="1" as="div">
            Word
          </Text>
          <Text size="5" weight="bold">
            {word}
          </Text>
        </Box>

        <Separator size="4" />

        {/* Pronunciation Section */}
        <PronunciationSection pronunciations={pronunciations} />

        {/* Translation Section */}
        <Box>
          <Text size="2" color="gray" mb="2" as="div">
            {translations.length > 1 ? 'Translations' : 'Translation'}
          </Text>
          {translations.length > 0 ? (
            <Flex direction="column" gap="2">
              {translations.map((translation, index) => (
                <Text key={index} size="4" color="blue">
                  {translation.translation || 'No translation available'}
                </Text>
              ))}
            </Flex>
          ) : (
            <Text size="4" color="orange">
              No translation available
            </Text>
          )}
        </Box>

        {/* User Mark Section */}
        {languageCode && (
          <UserMarkSection
            note={note}
            onNoteChange={handleNoteChange}
            currentMark={currentMark}
            onMarkSave={handleMarkSave}
            loadingMark={loadingMark}
          />
        )}
      </Flex>
    </Card>
  );

  return (
    <Box
      style={{
        position: 'fixed',
        top: 0,
        right: isOpen ? 0 : '-350px',
        width: '350px',
        height: '100vh',
        backgroundColor: 'var(--color-surface)',
        borderLeft: '1px solid var(--gray-6)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
        transition: 'right 0.3s ease-in-out',
      }}
    >
      {/* Header */}
      <Flex
        align="center"
        justify="between"
        p="4"
        style={{ borderBottom: '1px solid var(--gray-6)' }}
      >
        <Text size="4" weight="bold">
          Translation
        </Text>
        <Button variant="ghost" size="2" onClick={onClose}>
          <Cross2Icon />
        </Button>
      </Flex>

      {/* Content */}
      <Box p="4" style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Flex
            direction="column"
            align="center"
            justify="center"
            style={{ minHeight: '200px' }}
          >
            <Text size="3" color="gray">
              Loading translation...
            </Text>
          </Flex>
        ) : selectedWord ? (
          <WordContent
            word={selectedWord}
            translations={selectedTranslations}
            pronunciations={selectedPronunciations}
            languageCode={languageCode}
          />
        ) : (
          <Flex
            direction="column"
            align="center"
            justify="center"
            style={{ minHeight: '200px' }}
          >
            <Text size="3" color="gray" style={{ textAlign: 'center' }}>
              Click on a word in the lesson to see its translation
            </Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
};

export default WordSidebar;
