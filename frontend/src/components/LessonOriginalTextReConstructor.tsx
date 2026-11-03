import React from 'react';
import { Badge } from '@radix-ui/themes';
import { useWordMark } from '../contexts/WordMarkContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getDifficultyStyles } from '../constants/difficultyColors';
import dayjs from 'dayjs';

const lastLoggedWords: Record<string, number> = {};
const lastLoggedWordSentence: Record<string, number> = {};

interface LessonOriginalTextReConstructorProps {
  text: string;
  words: { word: string; sentenceId: number }[];
  fontSize?: string;
  onWordClick: (word: string) => void;
  className?: string;
}

const LessonOriginalTextReConstructor: React.FC<
  LessonOriginalTextReConstructorProps
> = ({ text, words, fontSize = '16px', onWordClick, className }) => {
  const { getWordMark } = useWordMark();
  const { axiosInstance } = useAuth();
  const { selectedLanguage } = useLanguage();

  const logReadAction = async (word: string, sentenceId: number) => {
    if (!axiosInstance || !selectedLanguage) return;

    const lastLogged = lastLoggedWords[word];
    if (lastLogged && dayjs().unix() - lastLogged < 1) return;
    if (sentenceId === lastLoggedWordSentence[word]) return;

    lastLoggedWords[word] = dayjs().unix();
    lastLoggedWordSentence[word] = sentenceId;

    try {
      await axiosInstance.post('/api/user-action-log/log', {
        type: 'read',
        languageCode: selectedLanguage,
        actionData: {
          word,
          sentence_id: sentenceId,
        },
      });
      lastLoggedWords[word] = dayjs().unix();
    } catch (error) {
      console.error('Error logging read action:', error);
    }
  };

  if (words.length === 0) {
    return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;
  }

  const elements: React.ReactNode[] = [];
  let currentIndex = 0;

  words.forEach(({ word, sentenceId }, index) => {
    const wordStartIndex = text.indexOf(word, currentIndex);
    if (wordStartIndex !== -1) {
      if (wordStartIndex > currentIndex) {
        elements.push(
          <span
            key={`gap-${index}`}
            style={{ color: 'gray', whiteSpace: 'pre-wrap' }}
          >
            {text.slice(currentIndex, wordStartIndex)}
          </span>
        );
      }
      currentIndex = wordStartIndex + word.length;
    }

    const wordMark = getWordMark(word);
    logReadAction(word, sentenceId);
    elements.push(
      <Badge
        key={`${sentenceId}-${index}`}
        variant="soft"
        size="2"
        style={{
          transition: 'all 0.2s ease',
          color: 'white',
          margin: '0',
          padding: '2px 0',
          fontSize,
          ...(wordMark === undefined || wordMark < 0
            ? { background: '#f44336' }
            : getDifficultyStyles(wordMark)),
          cursor: 'pointer',
        }}
        className={className}
        onClick={() => onWordClick(word)}
      >
        {word}
      </Badge>
    );
  });

  if (currentIndex < text.length) {
    elements.push(
      <span key="tail" style={{ color: 'gray', whiteSpace: 'pre-wrap' }}>
        {text.slice(currentIndex)}
      </span>
    );
  }

  return <span style={{ whiteSpace: 'pre-wrap' }}>{elements}</span>;
};

export default LessonOriginalTextReConstructor;
