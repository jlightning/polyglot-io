import React, { useState, useEffect } from 'react';
import { Box, Flex, Text, Dialog, Checkbox } from '@radix-ui/themes';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';

export interface ActionHistoryEntry {
  id: number;
  type: 'word_mark' | 'read';
  action: {
    word_id?: number;
    old_mark?: number;
    new_mark?: number;
    sentence_id?: number;
  };
  created_at: string;
}

interface WordActionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  word: string | null;
  languageCode?: string | undefined;
}

const WordActionHistoryDialog: React.FC<WordActionHistoryDialogProps> = ({
  open,
  onOpenChange,
  word,
  languageCode,
}) => {
  const { axiosInstance } = useAuth();
  const [actionHistory, setActionHistory] = useState<ActionHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showViewLog, setShowViewLog] = useState(false);

  // Only fetch when the user opens the dialog (open becomes true)
  useEffect(() => {
    if (!open) return;
    if (!word || !languageCode || !axiosInstance) return;
    setActionHistory([]);
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const response = await axiosInstance.get<{
          success: boolean;
          data: ActionHistoryEntry[];
        }>('/api/user-action-log/word', {
          params: { word, languageCode },
        });
        if (response.data.success && Array.isArray(response.data.data)) {
          setActionHistory(response.data.data);
        } else {
          setActionHistory([]);
        }
      } catch (error) {
        console.error('Error fetching action history:', error);
        setActionHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when dialog is opened
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 520, minWidth: 400 }}>
        <Dialog.Title>Action history</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          {word ? (
            <>
              History for <strong>{word}</strong> (difficulty changes and views)
            </>
          ) : (
            'History for this word (difficulty changes and views)'
          )}
        </Dialog.Description>
        <Flex align="center" gap="2" mb="3">
          <Checkbox
            id="show-view-log"
            checked={showViewLog}
            onCheckedChange={checked => setShowViewLog(checked === true)}
          />
          <Text
            size="2"
            as="label"
            htmlFor="show-view-log"
            color="gray"
            style={{ cursor: 'pointer' }}
          >
            Show view log
          </Text>
        </Flex>
        {loadingHistory ? (
          <Text size="2" color="gray">
            Loading...
          </Text>
        ) : (
          (() => {
            const filtered = showViewLog
              ? actionHistory
              : actionHistory.filter(e => e.type !== 'read');
            return filtered.length === 0 ? (
              <Text size="2" color="gray">
                {showViewLog
                  ? 'No actions yet for this word'
                  : 'No difficulty changes (view log is hidden)'}
              </Text>
            ) : (
              <Flex
                direction="column"
                gap="2"
                style={{ maxHeight: 480, overflow: 'auto' }}
              >
                {filtered.map(entry => (
                  <Box
                    key={entry.id}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--gray-2)',
                      borderRadius: 'var(--radius-2)',
                    }}
                  >
                    <Text size="2" as="div">
                      {entry.type === 'word_mark' ? (
                        <>
                          Difficulty changed from {entry.action.old_mark ?? '—'}{' '}
                          to {entry.action.new_mark ?? '—'}
                        </>
                      ) : (
                        'Viewed'
                      )}
                    </Text>
                    <Text size="1" color="gray" mt="1">
                      {dayjs(entry.created_at).format('YYYY-MM-DD HH:mm:ss')}
                    </Text>
                  </Box>
                ))}
              </Flex>
            );
          })()
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default WordActionHistoryDialog;
