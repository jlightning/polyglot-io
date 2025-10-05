import React from 'react';
import { Badge } from '@radix-ui/themes';
import { useWordMark } from '../contexts/WordMarkContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getDifficultyStyles } from '../constants/difficultyColors';
import dayjs from 'dayjs';

// Global tracking for word read deduplication (max once per second per word)
const lastLoggedWords: Record<string, number> = {};
const lastLoggedWordSentence: Record<string, number> = {};

interface WordTranslation {
  word: string;
  translation: string;
}

interface WordPronunciation {
  word: string;
  pronunciation: string;
  pronunciationType: string;
}

interface Sentence {
  id: number;
  original_text: string;
  split_text: string[] | null;
  word_translations?: WordTranslation[] | null;
  word_pronunciations?: WordPronunciation[] | null;
  start_time: number | null;
  end_time: number | null;
}

interface SentenceReconstructorProps {
  sentence: Sentence;
  fontSize?: string;
  onWordClick: (word: string) => void;
  fallbackToOriginalText?: boolean;
  className?: string;
}

const SentenceReconstructor: React.FC<SentenceReconstructorProps> = ({
  sentence,
  fontSize = '16px',
  onWordClick,
  fallbackToOriginalText = true,
  className,
}) => {
  const { getWordMark } = useWordMark();
  const { axiosInstance } = useAuth();
  const { selectedLanguage } = useLanguage();
  const { original_text: originalText, split_text: splitWords } = sentence;

  if (!splitWords || splitWords.length === 0) {
    return fallbackToOriginalText ? originalText : null;
  }

  const logReadAction = async (word: string) => {
    if (!axiosInstance || !selectedLanguage) return;

    const lastLogged = lastLoggedWords[word];

    if (lastLogged && dayjs().unix() - lastLogged < 1) return;
    if (sentence.id === lastLoggedWordSentence[word]) return;

    lastLoggedWords[word] = dayjs().unix();
    lastLoggedWordSentence[word] = sentence.id;

    try {
      await axiosInstance.post('/api/user-action-log/log', {
        type: 'read',
        languageCode: selectedLanguage,
        actionData: {
          word,
          sentence_id: sentence.id,
        },
      });

      // Update last logged time
      lastLoggedWords[word] = dayjs().unix();
    } catch (error) {
      console.error('Error logging read action:', error);
      // Don't show error to user, just log it
    }
  };

  const createWordBadge = (word: string, index: number) => {
    const wordMark = getWordMark(word);
    logReadAction(word);
    return (
      <Badge
        key={index}
        variant="soft"
        size="2"
        style={{
          transition: 'all 0.2s ease',
          color: 'white',
          margin: '0',
          padding: '2px 0',
          fontSize,
          ...(wordMark !== undefined
            ? getDifficultyStyles(wordMark)
            : { border: '1px solid transparent' }),
          cursor: 'pointer',
        }}
        className={className}
        onClick={() => {
          onWordClick(word);
        }}
      >
        {word}
      </Badge>
    );
  };

  const elements: (string | JSX.Element)[] = [];
  let currentIndex = 0;
  let wordIndex = 0;

  // For each word in splitWords, find it in the original text and replace with clickable badge
  for (const word of splitWords) {
    // Find the next occurrence of this word starting from currentIndex
    const wordStartIndex = originalText.indexOf(word, currentIndex);

    if (wordStartIndex !== -1) {
      // Add any text/punctuation/spaces before this word
      if (wordStartIndex > currentIndex) {
        const beforeWord = originalText.slice(currentIndex, wordStartIndex);
        elements.push(beforeWord);
      }

      // Move currentIndex to after this word
      currentIndex = wordStartIndex + word.length;
    }

    // Add the clickable word badge (whether found in original text or not)
    elements.push(createWordBadge(word, wordIndex));
    wordIndex++;
  }

  // Add any remaining text/punctuation after the last word
  if (currentIndex < originalText.length) {
    elements.push(originalText.slice(currentIndex));
  }

  return <>{elements}</>;
};

export default SentenceReconstructor;
