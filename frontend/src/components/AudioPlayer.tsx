import React, { useState, useRef, useEffect } from 'react';
import { Flex, Text, Box } from '@radix-ui/themes';
import MyButton from './MyButton';
import { PlayIcon, PauseIcon, SpeakerLoudIcon } from '@radix-ui/react-icons';

interface AudioPlayerProps {
  audioUrl: string;
  title?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, title }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = parseFloat(e.target.value);
    audio.volume = newVolume;
    setVolume(newVolume);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';

    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Box
      p="3"
      style={{
        border: '1px solid var(--gray-6)',
        borderRadius: '8px',
        backgroundColor: 'var(--gray-1)',
      }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {title && (
        <Text size="2" weight="medium" mb="2" as="div">
          {title}
        </Text>
      )}

      <Flex direction="column" gap="2">
        {/* Play/Pause and Time */}
        <Flex align="center" gap="2">
          <MyButton
            variant="soft"
            size="2"
            onClick={togglePlay}
            style={{ minWidth: '40px' }}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </MyButton>

          <Text size="1" style={{ minWidth: '80px' }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </Flex>

        {/* Progress Bar */}
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          style={{
            width: '100%',
            height: '4px',
            background: 'var(--gray-4)',
            borderRadius: '2px',
            outline: 'none',
            cursor: 'pointer',
          }}
        />

        {/* Volume Control */}
        <Flex align="center" gap="2">
          <SpeakerLoudIcon />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            style={{
              width: '100px',
              height: '4px',
              background: 'var(--gray-4)',
              borderRadius: '2px',
              outline: 'none',
              cursor: 'pointer',
            }}
          />
          <Text size="1">{Math.round(volume * 100)}%</Text>
        </Flex>
      </Flex>
    </Box>
  );
};

export default AudioPlayer;
