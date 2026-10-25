import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Container,
  Flex,
  Heading,
  Text,
  Box,
  Separator,
  Card,
  Badge,
  Dialog,
  TextField,
  IconButton,
} from '@radix-ui/themes';
import {
  MagnifyingGlassIcon,
  Pencil1Icon,
  TrashIcon,
} from '@radix-ui/react-icons';
import MyButton from '../components/MyButton';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useI18n } from '../i18n';

interface SeriesSummary {
  id: number;
  title: string;
  languageCode: string;
  lessonCount: number;
  createdAt: string;
  status: 'completed' | 'in_progress' | 'pending';
}

const SeriesPage: React.FC = () => {
  const { t } = useI18n();
  const { selectedLanguage, languages } = useLanguage();
  const { axiosInstance, isAuthenticated } = useAuth();
  const [seriesList, setSeriesList] = useState<SeriesSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SeriesSummary | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<SeriesSummary | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const language = languages.find(lang => lang.code === selectedLanguage);
  const languageName =
    language?.localName || language?.name || selectedLanguage;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm]);

  const fetchSeries = useCallback(async () => {
    if (!selectedLanguage) {
      setLoading(false);
      setError(t('series.selectLanguage'));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (debouncedSearchTerm) {
        params.set('search', debouncedSearchTerm);
      }
      const query = params.toString();
      const response = await axiosInstance.get(
        `/api/series/language/${selectedLanguage}${query ? `?${query}` : ''}`
      );
      if (response.data.success) {
        setSeriesList(response.data.series || []);
      } else {
        setError(t('series.loadFailed'));
      }
    } catch (err) {
      console.error('Error fetching series:', err);
      setError(t('series.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [selectedLanguage, debouncedSearchTerm, axiosInstance, t]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSeries();
    }
  }, [isAuthenticated, fetchSeries]);

  const handleCreate = async () => {
    const title = createTitle.trim();
    if (!title || !selectedLanguage) {
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const response = await axiosInstance.post('/api/series', {
        title,
        languageCode: selectedLanguage,
      });
      if (response.data.success) {
        setCreateOpen(false);
        setCreateTitle('');
        await fetchSeries();
      } else {
        setError(t('series.createFailed'));
      }
    } catch (err) {
      console.error('Error creating series:', err);
      setError(t('series.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async () => {
    const title = editTitle.trim();
    if (!editing || !title) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await axiosInstance.put(`/api/series/${editing.id}`, {
        title,
      });
      if (response.data.success) {
        setSeriesList(prev =>
          prev.map(item => (item.id === editing.id ? { ...item, title } : item))
        );
        setEditing(null);
      } else {
        setError(t('series.updateFailed'));
      }
    } catch (err) {
      console.error('Error updating series:', err);
      setError(t('series.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) {
      return;
    }

    try {
      setDeletingId(deleting.id);
      setError(null);
      const response = await axiosInstance.delete(`/api/series/${deleting.id}`);
      if (response.data.success) {
        setSeriesList(prev => prev.filter(item => item.id !== deleting.id));
        setDeleting(null);
      } else {
        setError(t('series.deleteFailed'));
      }
    } catch (err) {
      console.error('Error deleting series:', err);
      setError(t('series.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Container size="4" p="4">
      <Flex direction="column" gap="4" mb="6">
        <Heading size="6">{t('series.title')}</Heading>
        <Text size="3" color="gray">
          {t('series.subtitle')}
        </Text>
      </Flex>

      <Flex justify="between" align="center" mb="4">
        <Text size="2" color="gray">
          {selectedLanguage
            ? t('series.showing', { name: languageName })
            : t('series.loadingLanguage')}
        </Text>
        <Dialog.Root
          open={createOpen}
          onOpenChange={open => {
            setCreateOpen(open);
            if (!open) {
              setCreateTitle('');
            }
          }}
        >
          <Dialog.Trigger>
            <MyButton disabled={!selectedLanguage}>
              {t('series.create')}
            </MyButton>
          </Dialog.Trigger>
          <Dialog.Content style={{ maxWidth: 450 }}>
            <Dialog.Title>{t('series.createTitle')}</Dialog.Title>
            <Flex direction="column" gap="2" mt="3">
              <Text size="2">{t('series.name')}</Text>
              <TextField.Root
                placeholder={t('series.namePlaceholder')}
                value={createTitle}
                onChange={event => setCreateTitle(event.target.value)}
              />
            </Flex>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <MyButton variant="soft" color="gray">
                  {t('common.cancel')}
                </MyButton>
              </Dialog.Close>
              <MyButton
                onClick={handleCreate}
                disabled={creating || !createTitle.trim()}
              >
                {creating ? t('series.creating') : t('series.create')}
              </MyButton>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </Flex>

      <Separator size="4" mb="4" />

      <TextField.Root
        mb="4"
        placeholder={t('series.searchPlaceholder')}
        value={searchTerm}
        onChange={event => setSearchTerm(event.target.value)}
      >
        <TextField.Slot>
          <MagnifyingGlassIcon height="16" width="16" />
        </TextField.Slot>
      </TextField.Root>

      {error && (
        <Text color="red" mb="4" as="div">
          {error}
        </Text>
      )}

      {loading ? (
        <Text color="gray">{t('series.loading')}</Text>
      ) : seriesList.length === 0 ? (
        <Text color="gray">
          {debouncedSearchTerm ? t('series.searchEmpty') : t('series.empty')}
        </Text>
      ) : (
        <Flex direction="column" gap="3">
          {seriesList.map(series => (
            <Card key={series.id}>
              <Flex justify="between" align="center" gap="3">
                <Box>
                  <Flex align="center" gap="2">
                    <Link
                      to={`/series/${series.id}`}
                      style={{
                        color: 'var(--accent-11)',
                        textDecoration: 'none',
                      }}
                    >
                      <Text size="4" weight="medium">
                        {series.title}
                      </Text>
                    </Link>
                    <Badge
                      variant="soft"
                      color={
                        series.status === 'completed'
                          ? 'green'
                          : series.status === 'in_progress'
                            ? 'orange'
                            : 'gray'
                      }
                    >
                      {series.status === 'completed'
                        ? t('lessonList.completed')
                        : series.status === 'in_progress'
                          ? t('lessonList.inProgress')
                          : t('series.statusPending')}
                    </Badge>
                  </Flex>
                  <Text size="2" color="gray" as="div">
                    {t('series.lessonCount', { count: series.lessonCount })}
                  </Text>
                </Box>
                <Flex gap="2">
                  <IconButton
                    variant="ghost"
                    color="blue"
                    onClick={() => {
                      setEditing(series);
                      setEditTitle(series.title);
                    }}
                    title={t('series.rename')}
                  >
                    <Pencil1Icon />
                  </IconButton>
                  <IconButton
                    variant="ghost"
                    color="red"
                    onClick={() => setDeleting(series)}
                    title={t('series.deleteTitle')}
                  >
                    <TrashIcon />
                  </IconButton>
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}

      <Dialog.Root
        open={editing !== null}
        onOpenChange={open => {
          if (!open) {
            setEditing(null);
          }
        }}
      >
        <Dialog.Content style={{ maxWidth: 450 }}>
          <Dialog.Title>{t('series.renameTitle')}</Dialog.Title>
          <Flex direction="column" gap="2" mt="3">
            <Text size="2">{t('series.name')}</Text>
            <TextField.Root
              value={editTitle}
              onChange={event => setEditTitle(event.target.value)}
            />
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <MyButton variant="soft" color="gray">
                {t('common.cancel')}
              </MyButton>
            </Dialog.Close>
            <MyButton
              onClick={handleRename}
              disabled={saving || !editTitle.trim()}
            >
              {saving ? t('common.saving') : t('common.save')}
            </MyButton>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root
        open={deleting !== null}
        onOpenChange={open => {
          if (!open) {
            setDeleting(null);
          }
        }}
      >
        <Dialog.Content style={{ maxWidth: 450 }}>
          <Dialog.Title>{t('series.deleteTitle')}</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            {t('series.deleteConfirm')}
          </Dialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <MyButton variant="soft" color="gray">
                {t('common.cancel')}
              </MyButton>
            </Dialog.Close>
            <MyButton
              variant="solid"
              color="red"
              onClick={handleDelete}
              disabled={deletingId !== null}
            >
              {deletingId !== null ? t('common.deleting') : t('common.delete')}
            </MyButton>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Container>
  );
};

export default SeriesPage;
