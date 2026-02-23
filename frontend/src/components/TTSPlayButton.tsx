import React, { useState, useRef, useEffect } from 'react';
import { AxiosInstance } from 'axios';
import MyButton from './MyButton';
import { PlayIcon, StopIcon } from '@radix-ui/react-icons';

interface TTSPlayButtonProps {
  text: string;
  languageCode: string;
  axiosInstance: AxiosInstance;
  variant?: 'soft' | 'solid' | 'outline' | 'ghost';
  size?: '1' | '2' | '3';
  title?: string;
  style?: React.CSSProperties;
}

const TTSPlayButton: React.FC<TTSPlayButtonProps> = ({
  text,
  languageCode,
  axiosInstance,
  variant = 'soft',
  size = '1',
  title = 'Listen',
  style,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const endedNormallyRef = useRef(false);

  const revokeAndClear = () => {
    endedNormallyRef.current = true;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  useEffect(() => {
    return () => revokeAndClear();
  }, []);

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    revokeAndClear();
  };

  const handlePlay = async () => {
    if (isPlaying) {
      handleStop();
      return;
    }

    if (!text.trim() || !languageCode.trim()) return;

    setIsLoading(true);
    setError(null);
    endedNormallyRef.current = false;

    try {
      const response = await axiosInstance.post(
        '/api/tts',
        { text: text.trim(), languageCode: languageCode.trim() },
        { responseType: 'arraybuffer' }
      );

      const blob = new Blob([response.data], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => revokeAndClear();
      audio.onerror = () => {
        if (endedNormallyRef.current) return;
        setError('Could not play audio');
        revokeAndClear();
      };

      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('TTS error:', err);
      setError('Could not generate audio');
      revokeAndClear();
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    if (isPlaying) {
      handleStop();
    } else {
      handlePlay();
    }
  };

  const disabled = isLoading || !text.trim() || !languageCode.trim();

  return (
    <>
      <MyButton
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={disabled}
        title={title}
        style={{
          minWidth: '24px',
          width: '24px',
          height: '24px',
          padding: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        {isLoading ? (
          <span style={{ fontSize: '12px' }}>...</span>
        ) : isPlaying ? (
          <StopIcon />
        ) : (
          <PlayIcon />
        )}
      </MyButton>
      {error && (
        <span style={{ fontSize: '12px', color: 'var(--red-11)' }}>
          {error}
        </span>
      )}
    </>
  );
};

export default TTSPlayButton;
