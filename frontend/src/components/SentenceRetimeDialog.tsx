import React, { useState, useEffect } from 'react';
import { Dialog, Flex, Text, Box } from '@radix-ui/themes';
import MyButton from './MyButton';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

interface Sentence {
  id: number;
  original_text: string;
  start_time: number | null;
  end_time: number | null;
}

interface SentenceRetimeDialogProps {
  sentence: Sentence | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const SentenceRetimeDialog: React.FC<SentenceRetimeDialogProps> = ({
  sentence,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { t } = useI18n();
  const { axiosInstance } = useAuth();
  const [timeOffset, setTimeOffset] = useState<string>('');
  const [moveSubsequent, setMoveSubsequent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens or sentence changes
  useEffect(() => {
    if (open && sentence) {
      setTimeOffset('');
      setMoveSubsequent(false);
      setError(null);
    }
  }, [open, sentence]);

  // Format time for display (MM:SS.mmm)
  const formatTime = (time: number | null): string => {
    if (time === null) return 'N/A';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  // Calculate preview times
  const getPreviewTimes = () => {
    if (
      !sentence ||
      !timeOffset ||
      sentence.start_time === null ||
      sentence.end_time === null
    ) {
      return null;
    }

    const offset = parseFloat(timeOffset);
    if (isNaN(offset)) return null;

    return {
      newStartTime: sentence.start_time + offset,
      newEndTime: sentence.end_time + offset,
    };
  };

  const handleSubmit = async () => {
    if (!sentence) {
      setError('No sentence selected');
      return;
    }

    if (!timeOffset.trim()) {
      setError('Please enter a time offset');
      return;
    }

    const offset = parseFloat(timeOffset);
    if (isNaN(offset)) {
      setError('Time offset must be a valid number');
      return;
    }

    if (sentence.start_time === null || sentence.end_time === null) {
      setError('Sentence does not have timing data to adjust');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axiosInstance.put(
        `/api/lessons/sentences/${sentence.id}/timing`,
        {
          timeOffset: offset,
          moveSubsequent: moveSubsequent,
        }
      );

      if (response.data.success) {
        // Call success callback if provided
        if (onSuccess) {
          onSuccess();
        }
        // Close dialog
        onOpenChange(false);
      } else {
        setError(response.data.message || 'Failed to update sentence timing');
      }
    } catch (err) {
      console.error('Error updating sentence timing:', err);
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Failed to update sentence timing. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const preview = getPreviewTimes();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 500 }}>
        <Dialog.Title>{t('retime.title')}</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          {t('retime.description')}
        </Dialog.Description>

        <Flex direction="column" gap="4">
          {/* Current Timing Display */}
          {sentence && (
            <Box>
              <Text size="2" weight="medium" mb="2" as="div">
                {t('retime.current')}
              </Text>
              <Flex direction="column" gap="1">
                <Text size="2" color="gray">
                  {t('retime.start', { time: formatTime(sentence.start_time) })}
                </Text>
                <Text size="2" color="gray">
                  {t('retime.end', { time: formatTime(sentence.end_time) })}
                </Text>
              </Flex>
            </Box>
          )}

          {/* Time Offset Input */}
          <Box>
            <Text size="2" weight="medium" mb="2" as="div">
              {t('retime.offset')}
            </Text>
            <input
              type="number"
              step="0.001"
              value={timeOffset}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setTimeOffset(e.target.value);
                setError(null);
              }}
              placeholder={t('retime.offsetPlaceholder')}
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--gray-7)',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
            <Text size="1" color="gray" mt="1">
              {t('retime.offsetHelp')}
            </Text>
          </Box>

          {/* Preview */}
          {preview && (
            <Box
              style={{
                padding: '12px',
                backgroundColor: 'var(--gray-2)',
                borderRadius: '4px',
              }}
            >
              <Text size="2" weight="medium" mb="2" as="div">
                {t('retime.preview')}
              </Text>
              <Flex direction="column" gap="1">
                <Text size="2">
                  {t('retime.newStart', { time: formatTime(preview.newStartTime) })}
                </Text>
                <Text size="2">
                  {t('retime.newEnd', { time: formatTime(preview.newEndTime) })}
                </Text>
              </Flex>
            </Box>
          )}

          {/* Move Subsequent Checkbox */}
          <Box>
            <Flex align="center" gap="2">
              <input
                type="checkbox"
                id="moveSubsequent"
                checked={moveSubsequent}
                onChange={e => setMoveSubsequent(e.target.checked)}
                disabled={loading}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                }}
              />
              <Text
                size="2"
                as="label"
                htmlFor="moveSubsequent"
                style={{ cursor: 'pointer' }}
              >
                {t('retime.moveSubsequent')}
              </Text>
            </Flex>
            <Text size="1" color="gray" mt="1" style={{ marginLeft: '24px' }}>
              {t('retime.moveHelp')}
            </Text>
          </Box>

          {/* Error Message */}
          {error && (
            <Box
              style={{
                padding: '12px',
                backgroundColor: 'var(--red-2)',
                borderRadius: '4px',
                border: '1px solid var(--red-7)',
              }}
            >
              <Text size="2" color="red">
                {error}
              </Text>
            </Box>
          )}

          {/* Action Buttons */}
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <MyButton variant="soft" color="gray" disabled={loading}>
                {t('common.cancel')}
              </MyButton>
            </Dialog.Close>
            <MyButton
              onClick={handleSubmit}
              disabled={loading || !timeOffset.trim()}
            >
              {loading ? t('retime.updating') : t('retime.apply')}
            </MyButton>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default SentenceRetimeDialog;
