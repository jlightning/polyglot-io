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
import { useI18n } from '../contexts/I18nContext';

const MCP_TOOLS = [
  {
    name: 'create_lesson',
    key: 'mcp.tool.create',
  },
  {
    name: 'add_sentence',
    key: 'mcp.tool.addSentence',
  },
  {
    name: 'delete_sentence',
    key: 'mcp.tool.deleteSentence',
  },
  {
    name: 'mark_word',
    key: 'mcp.tool.markWord',
  },
  {
    name: 'list_lessons',
    key: 'mcp.tool.listLessons',
  },
  {
    name: 'list_sentences',
    key: 'mcp.tool.listSentences',
  },
  {
    name: 'list_words',
    key: 'mcp.tool.listWords',
  },
 ] as const;

const CONNECTOR_STEPS = [
  'mcp.connector.1', 'mcp.connector.2', 'mcp.connector.3',
  'mcp.connector.4', 'mcp.connector.5', 'mcp.connector.6',
] as const;

const DEVELOPER_CONFIG_STEPS = [
  'mcp.developer.1', 'mcp.developer.2', 'mcp.developer.3', 'mcp.developer.4',
] as const;

const CURSOR_STEPS = [
  'mcp.cursor.1', 'mcp.cursor.2', 'mcp.cursor.3', 'mcp.cursor.4',
] as const;

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
  const { t } = useI18n();
  const { token } = useAuth();
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
        MCP
      </Heading>

      <Card size="3" style={{ padding: '24px', width: '100%' }}>
        <Text size="2" color="gray" mb="4" as="div">
          {t('mcp.description')}
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
            {t('mcp.remoteUrl')}
          </Text>
          <Text size="2" color="gray" mb="2" as="div">
            {t('mcp.remoteHelp')}
          </Text>

          <Flex gap="3" mb="3" wrap="wrap">
            <MyButton
              onClick={() => copyText(mcpUrl, 'URL')}
              disabled={!token}
              variant="solid"
            >
              {t('mcp.copyUrl')}
            </MyButton>
            <MyButton
              onClick={() => token && copyText(token, 'Token')}
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
            {t('mcp.mergeConfig')}
          </Text>

          <Flex gap="3" mb="3" wrap="wrap">
            <MyButton
              onClick={() => copyText(mcpConfigJson, 'Config')}
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
            {t('mcp.mergeCursor')}
          </Text>

          <Flex gap="3" mb="3" wrap="wrap">
            <MyButton
              onClick={() => copyText(mcpConfigJson, 'Config')}
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
                {t(tool.key)}
              </Text>
            </Box>
          ))}
        </Box>
      </Card>
    </Container>
  );
};

export default McpPage;
