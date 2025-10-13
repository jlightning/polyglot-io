import React, { useState, useEffect } from 'react';
import { Box, Flex, Text, Card, Separator } from '@radix-ui/themes';
import MyButton from './MyButton';
import { Cross2Icon, TrashIcon } from '@radix-ui/react-icons';
import { useAuth } from '../contexts/AuthContext';
import { useWordMark } from '../contexts/WordMarkContext';
import {
  getDifficultyStyles,
  getDifficultyLabel,
} from '../constants/difficultyColors';
import DebounceTextArea from './DebounceTextArea';

interface WordTranslation {
  word: string;
  translation: string;
}

interface WordPronunciation {
  word: string;
  pronunciation: string;
  pronunciationType: string;
}

interface WordStems {
  word: string;
  stems: string[];
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
  languageCode?: string;
  targetLanguage?: string;
}

const WordSidebar: React.FC<WordSidebarProps> = ({
  isOpen,
  onClose,
  selectedWord,
  languageCode,
  targetLanguage = 'en',
}) => {
  const { axiosInstance } = useAuth();
  const { saveWordMark, isSaving } = useWordMark();
  const [note, setNote] = useState('');
  const [currentMark, setCurrentMark] = useState<number | null>(null);
  const [, setUserMark] = useState<WordUserMark | null>(null);
  const [loadingMark, setLoadingMark] = useState(false);
  const [wordTranslations, setWordTranslations] = useState<WordTranslation[]>(
    []
  );
  const [wordPronunciations, setWordPronunciations] = useState<
    WordPronunciation[]
  >([]);
  const [wordStems, setWordStems] = useState<WordStems[]>([]);
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [loadingPronunciations, setLoadingPronunciations] = useState(false);
  const [loadingStems, setLoadingStems] = useState(false);

  // Fetch translations and pronunciations when selectedWord changes
  useEffect(() => {
    const fetchWordData = async () => {
      if (!selectedWord || !languageCode || !axiosInstance) {
        setWordTranslations([]);
        setWordPronunciations([]);
        setWordStems([]);
        return;
      }

      try {
        setLoadingTranslations(true);
        setLoadingPronunciations(true);
        setLoadingStems(true);

        const [translationsResponse, pronunciationsResponse, stemsResponse] =
          await Promise.all([
            axiosInstance.get(
              `/api/words/translations/${encodeURIComponent(selectedWord)}/${languageCode}/${targetLanguage}`
            ),
            axiosInstance.get(
              `/api/words/pronunciations/${encodeURIComponent(selectedWord)}/${languageCode}`
            ),
            axiosInstance.get(
              `/api/words/stems/${encodeURIComponent(selectedWord)}/${languageCode}`
            ),
          ]);

        if (translationsResponse.data.success) {
          setWordTranslations(translationsResponse.data.data || []);
        } else {
          setWordTranslations([]);
        }

        if (pronunciationsResponse.data.success) {
          setWordPronunciations(pronunciationsResponse.data.data || []);
        } else {
          setWordPronunciations([]);
        }

        if (stemsResponse.data.success) {
          setWordStems(stemsResponse.data.data || []);
        } else {
          setWordStems([]);
        }
      } catch (error) {
        console.error('Error fetching word data:', error);
        setWordTranslations([]);
        setWordPronunciations([]);
        setWordStems([]);
      } finally {
        setLoadingTranslations(false);
        setLoadingPronunciations(false);
        setLoadingStems(false);
      }
    };

    fetchWordData();
  }, [selectedWord, languageCode, targetLanguage, axiosInstance]);

  const selectedTranslations = wordTranslations;
  const selectedPronunciations = wordPronunciations;
  const selectedStems = wordStems;

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

  const handleNoteChange = (newNote: string) => {
    setNote(newNote);
    if (currentMark === null) setCurrentMark(1);
    // Auto-save note if there's already a mark
    saveWordMark(
      selectedWord!,
      currentMark === null ? 1 : currentMark,
      newNote,
      languageCode!
    );
  };

  // Add keyboard shortcuts for number keys 0-5
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle keyboard shortcuts when sidebar is open and has a selected word
      if (!isOpen || !selectedWord || !languageCode) return;

      // Ignore keyboard shortcuts when user is typing in a text input/textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        return;
      }

      // Check if pressed key is 0-5
      const keyNumber = parseInt(event.key);
      if (!isNaN(keyNumber) && keyNumber >= 0 && keyNumber <= 5) {
        event.preventDefault();
        handleMarkSave(keyNumber);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [isOpen, selectedWord, languageCode, note, currentMark]);

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

  // Reusable stems component
  const StemsSection: React.FC<{
    stems: WordStems[];
  }> = ({ stems }) => {
    if (stems.length === 0) return null;

    return (
      <>
        <Box>
          <Text size="2" color="gray" mb="2" as="div">
            {stems.length > 1 ? 'Word Stems' : 'Word Stem'}
          </Text>
          <Flex direction="column" gap="2">
            <Text size="4" color="purple" weight="medium">
              {stems.flatMap(stemObj => stemObj.stems).join(', ')}
            </Text>
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
      <MyButton
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
        }}
      >
        <TrashIcon />
      </MyButton>

      {/* Rating buttons 1-5 */}
      {[1, 2, 3, 4, 5].map(mark => (
        <MyButton
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
          }}
        >
          {mark}
        </MyButton>
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
        <DebounceTextArea
          placeholder="Add a note about this word..."
          value={note}
          onChange={onNoteChange}
          disabled={isSaving || loadingMark}
          rows={3}
          debounceDelay={1500}
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
    stems: WordStems[];
    languageCode?: string | undefined;
  }> = ({ word, translations, pronunciations, stems, languageCode }) => (
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

        {/* Stems Section */}
        <StemsSection stems={stems} />

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
        <MyButton variant="ghost" size="2" onClick={onClose}>
          <Cross2Icon />
        </MyButton>
      </Flex>

      {/* Content */}
      <Box p="4" style={{ flex: 1, overflow: 'auto' }}>
        {loadingTranslations || loadingPronunciations || loadingStems ? (
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
            stems={selectedStems}
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
