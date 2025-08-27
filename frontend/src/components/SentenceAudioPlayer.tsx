import React, { useState, useRef, useEffect } from 'react';
import { Button, Flex, Text } from '@radix-ui/themes';
import { PlayIcon, StopIcon } from '@radix-ui/react-icons';
import TimeFormat from 'hh-mm-ss';

interface SentenceAudioPlayerProps {
  audioUrl: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
}

const SentenceAudioPlayer: React.FC<SentenceAudioPlayerProps> = ({
  audioUrl,
  startTime,
  endTime,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Format time using hh-mm-ss library
  const formatTime = (timeInSeconds: number): string => {
    return TimeFormat.fromS(Math.max(0, timeInSeconds), 'hh:mm:ss');
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handlePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    // Calculate actual start and end times with 500ms buffer
    const actualStartTime = Math.max(0, startTime - 0.5); // 500ms before
    const actualEndTime = endTime + 0.5; // 500ms after
    const playDuration = (actualEndTime - actualStartTime) * 1000; // Convert to milliseconds

    // Set audio to start position
    audio.currentTime = actualStartTime;

    // Play the audio
    audio
      .play()
      .then(() => {
        setIsPlaying(true);

        // Set timeout to stop playback after the calculated duration
        timeoutRef.current = setTimeout(() => {
          handleStop();
        }, playDuration);
      })
      .catch(error => {
        console.error('Error playing audio:', error);
        setIsPlaying(false);
      });
  };

  const handleStop = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setIsPlaying(false);

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handlePlayStop = () => {
    if (isPlaying) {
      handleStop();
    } else {
      handlePlay();
    }
  };

  // Handle when audio ends naturally
  const handleAudioEnded = () => {
    setIsPlaying(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  return (
    <Flex align="center" gap="2">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onEnded={handleAudioEnded}
      />

      <Text size="2" color="gray">
        {formatTime(startTime)} - {formatTime(endTime)}
      </Text>

      <Button
        variant="soft"
        size="1"
        onClick={handlePlayStop}
        style={{
          minWidth: '24px',
          width: '24px',
          height: '24px',
          padding: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isPlaying ? <StopIcon /> : <PlayIcon />}
      </Button>
    </Flex>
  );
};

export default SentenceAudioPlayer;
