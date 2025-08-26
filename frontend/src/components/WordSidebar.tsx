import React from 'react';
import { Box, Flex, Text, Button, Card, Separator } from '@radix-ui/themes';
import { Cross2Icon } from '@radix-ui/react-icons';

interface WordTranslation {
  word: string;
  translation: string;
}

interface WordPronunciation {
  word: string;
  pronunciation: string;
  pronunciationType: string;
}

interface WordSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedWord: string | null;
  wordTranslations: WordTranslation[] | null;
  wordPronunciations?: WordPronunciation[] | null;
  loading?: boolean;
}

const WordSidebar: React.FC<WordSidebarProps> = ({
  isOpen,
  onClose,
  selectedWord,
  wordTranslations,
  wordPronunciations,
  loading = false,
}) => {
  const selectedTranslations =
    wordTranslations?.filter(wt => wt.word === selectedWord) || [];
  const selectedPronunciations =
    wordPronunciations?.filter(wp => wp.word === selectedWord) || [];

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
        ) : selectedWord && selectedTranslations.length > 0 ? (
          <Card style={{ padding: '16px' }}>
            <Flex direction="column" gap="3">
              <Box>
                <Text size="2" color="gray" mb="1" as="div">
                  Word
                </Text>
                <Text size="5" weight="bold">
                  {selectedWord}
                </Text>
              </Box>

              <Separator size="4" />

              {/* Pronunciation Section */}
              {selectedPronunciations.length > 0 && (
                <>
                  <Box>
                    <Text size="2" color="gray" mb="2" as="div">
                      {selectedPronunciations.length > 1
                        ? 'Pronunciations'
                        : 'Pronunciation'}
                    </Text>
                    <Flex direction="column" gap="2">
                      {selectedPronunciations.map((pronunciation, index) => (
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
              )}

              <Box>
                <Text size="2" color="gray" mb="2" as="div">
                  {selectedTranslations.length > 1
                    ? 'Translations'
                    : 'Translation'}
                </Text>
                <Flex direction="column" gap="2">
                  {selectedTranslations.map((translation, index) => (
                    <Text key={index} size="4" color="blue">
                      {translation.translation || 'No translation available'}
                    </Text>
                  ))}
                </Flex>
              </Box>
            </Flex>
          </Card>
        ) : selectedWord ? (
          <Card style={{ padding: '16px' }}>
            <Flex direction="column" gap="3">
              <Box>
                <Text size="2" color="gray" mb="1" as="div">
                  Word
                </Text>
                <Text size="5" weight="bold">
                  {selectedWord}
                </Text>
              </Box>

              <Separator size="4" />

              {/* Pronunciation Section */}
              {selectedPronunciations.length > 0 && (
                <>
                  <Box>
                    <Text size="2" color="gray" mb="2" as="div">
                      {selectedPronunciations.length > 1
                        ? 'Pronunciations'
                        : 'Pronunciation'}
                    </Text>
                    <Flex direction="column" gap="2">
                      {selectedPronunciations.map((pronunciation, index) => (
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
              )}

              <Box>
                <Text size="2" color="gray" mb="1" as="div">
                  Translation
                </Text>
                <Text size="4" color="orange">
                  No translation available
                </Text>
              </Box>
            </Flex>
          </Card>
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
