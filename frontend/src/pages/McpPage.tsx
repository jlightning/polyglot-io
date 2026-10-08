import React, { useState, type ReactNode } from 'react';
import {
  Container,
  Card,
  Heading,
  Text,
  Flex,
  Box,
  Code,
} from '@radix-ui/themes';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import MyButton from '../components/MyButton';
import { useAuth } from '../contexts/AuthContext';
import { useI18n, type MessagePath } from '../i18n';

const MCP_TOOLS: { name: string; description: MessagePath }[] = [
  { name: 'create_lesson', description: 'mcp.toolCreateLesson' },
  { name: 'add_sentence', description: 'mcp.toolAddSentence' },
  { name: 'delete_sentence', description: 'mcp.toolDeleteSentence' },
  { name: 'mark_word', description: 'mcp.toolMarkWord' },
  { name: 'list_lessons', description: 'mcp.toolListLessons' },
  { name: 'list_sentences', description: 'mcp.toolListSentences' },
  { name: 'list_words', description: 'mcp.toolListWords' },
];

const CONNECTOR_STEPS: MessagePath[] = [
  'mcp.connector1',
  'mcp.connector2',
  'mcp.connector3',
  'mcp.connector4',
  'mcp.connector5',
  'mcp.connector6',
];

const DEVELOPER_CONFIG_STEPS: MessagePath[] = [
  'mcp.developer1',
  'mcp.developer2',
  'mcp.developer3',
  'mcp.developer4',
];

const CURSOR_STEPS: MessagePath[] = [
  'mcp.cursor1',
  'mcp.cursor2',
  'mcp.cursor3',
  'mcp.cursor4',
];

const CollapsibleSection = ({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => (
  <Box
    mb="3"
    style={{
      borderRadius: '6px',
      border: '1px solid var(--gray-6)',
      overflow: 'hidden',
    }}
  >
    <Flex
      align="center"
      gap="2"
      p="3"
      onClick={onToggle}
      style={{
        cursor: 'pointer',
        backgroundColor: 'var(--gray-2)',
        userSelect: 'none',
      }}
    >
      {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
      <Text size="3" weight="bold" as="div">
        {title}
      </Text>
    </Flex>
    {open && (
      <Box p="3" style={{ borderTop: '1px solid var(--gray-6)' }}>
        {children}
      </Box>
    )}
  </Box>
);

const McpPage: React.FC = () => {
  const { token } = useAuth();
  const { t } = useI18n();
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [connectorOpen, setConnectorOpen] = useState(true);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [cursorOpen, setCursorOpen] = useState(false);

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const mcpUrl = token
    ? `${backendUrl.replace(/\/$/, '')}/mcp?token=${encodeURIComponent(token)}`
    : `${backendUrl.replace(/\/$/, '')}/mcp?token=<your-token>`;
  const mcpConfigJson = JSON.stringify(
    {
      mcpServers: {
        polyglot: {
          url: mcpUrl,
        },
      },
    },
    null,
    2
  );

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFeedback(t('mcp.copied', { label }));
      window.setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback(t('mcp.copyFailed', { label }));
      window.setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  return (
    <Container size="4" p="4">
      <Heading size="8" mb="4">
        {t('sidebar.mcp')}
      </Heading>

      <Card size="3" style={{ padding: '24px', width: '100%' }}>
        <Text size="2" color="gray" mb="4" as="div">
          {t('mcp.intro')}
        </Text>

        {!token && (
          <Text size="2" color="red" mb="3" as="div">
            {t('mcp.signIn')}
          </Text>
        )}

        {copyFeedback && (
          <Text size="2" color="green" mb="3" as="div">
            {copyFeedback}
          </Text>
        )}

        <CollapsibleSection
          title={t('mcp.connectorTitle')}
          open={connectorOpen}
          onToggle={() => setConnectorOpen(open => !open)}
        >
          <Box
            mb="4"
            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            {CONNECTOR_STEPS.map((step, index) => (
              <Text key={step} size="2" as="div">
                {index + 1}. {t(step)}
              </Text>
            ))}
          </Box>

          <Text size="2" weight="bold" mb="2" as="div">
            {t('mcp.urlLabel')}
          </Text>
          <Text size="2" color="gray" mb="2" as="div">
            {t('mcp.urlHelp')}
          </Text>

          <Flex gap="3" mb="3" wrap="wrap">
            <MyButton
              onClick={() => copyText(mcpUrl, t('mcp.url'))}
              disabled={!token}
              variant="solid"
            >
              {t('mcp.copyUrl')}
            </MyButton>
            <MyButton
              onClick={() => token && copyText(token, t('mcp.token'))}
              disabled={!token}
              variant="soft"
            >
              {t('mcp.copyToken')}
            </MyButton>
          </Flex>

          <Box
            p="3"
            style={{
              borderRadius: '6px',
              border: '1px solid var(--gray-6)',
              backgroundColor: 'var(--gray-2)',
              overflowX: 'auto',
              wordBreak: 'break-all',
            }}
          >
            <Code size="1" style={{ whiteSpace: 'pre-wrap', display: 'block' }}>
              {mcpUrl}
            </Code>
          </Box>
        </CollapsibleSection>

        <CollapsibleSection
          title={t('mcp.developerTitle')}
          open={developerOpen}
          onToggle={() => setDeveloperOpen(open => !open)}
        >
          <Box
            mb="4"
            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            {DEVELOPER_CONFIG_STEPS.map((step, index) => (
              <Text key={step} size="2" as="div">
                {index + 1}. {t(step)}
              </Text>
            ))}
          </Box>

          <Text size="2" weight="bold" mb="2" as="div">
            claude_desktop_config.json
          </Text>
          <Text size="2" color="gray" mb="2" as="div">
            {t('mcp.configHelp')}
          </Text>

          <Flex gap="3" mb="3" wrap="wrap">
            <MyButton
              onClick={() => copyText(mcpConfigJson, t('mcp.config'))}
              disabled={!token}
              variant="solid"
            >
              {t('mcp.copyConfig')}
            </MyButton>
          </Flex>

          <Box
            p="3"
            style={{
              borderRadius: '6px',
              border: '1px solid var(--gray-6)',
              backgroundColor: 'var(--gray-2)',
              overflowX: 'auto',
            }}
          >
            <Code size="1" style={{ whiteSpace: 'pre', display: 'block' }}>
              {mcpConfigJson}
            </Code>
          </Box>
        </CollapsibleSection>

        <CollapsibleSection
          title={t('mcp.cursorTitle')}
          open={cursorOpen}
          onToggle={() => setCursorOpen(open => !open)}
        >
          <Box
            mb="4"
            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            {CURSOR_STEPS.map((step, index) => (
              <Text key={step} size="2" as="div">
                {index + 1}. {t(step)}
              </Text>
            ))}
          </Box>

          <Text size="2" weight="bold" mb="2" as="div">
            mcp.json
          </Text>
          <Text size="2" color="gray" mb="2" as="div">
            {t('mcp.cursorHelp')}
          </Text>

          <Flex gap="3" mb="3" wrap="wrap">
            <MyButton
              onClick={() => copyText(mcpConfigJson, t('mcp.config'))}
              disabled={!token}
              variant="solid"
            >
              {t('mcp.copyConfig')}
            </MyButton>
          </Flex>

          <Box
            p="3"
            style={{
              borderRadius: '6px',
              border: '1px solid var(--gray-6)',
              backgroundColor: 'var(--gray-2)',
              overflowX: 'auto',
            }}
          >
            <Code size="1" style={{ whiteSpace: 'pre', display: 'block' }}>
              {mcpConfigJson}
            </Code>
          </Box>
        </CollapsibleSection>

        <Text size="3" weight="bold" mb="2" mt="4" as="div">
          {t('mcp.tools')}
        </Text>
        <Box style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {MCP_TOOLS.map(tool => (
            <Box key={tool.name}>
              <Text size="2" weight="bold" as="div">
                {tool.name}
              </Text>
              <Text size="2" color="gray" as="div">
                {t(tool.description)}
              </Text>
            </Box>
          ))}
        </Box>
      </Card>
    </Container>
  );
};

export default McpPage;
