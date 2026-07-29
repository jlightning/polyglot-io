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

const MCP_TOOLS = [
  {
    name: 'create_lesson',
    description:
      'Create lesson (type: manual|text|subtitle); manual = empty shell, sentences required for text/subtitle',
  },
  {
    name: 'add_sentence',
    description: 'Add one or more sentences to a manual lesson',
  },
  {
    name: 'delete_sentence',
    description: 'Delete sentences from a manual/manga lesson by sentenceIds[]',
  },
  {
    name: 'mark_word',
    description:
      "Mark one or more words: 0=Ignore, 1=Don't remember, 2=Hard to remember, 3=Remembered, 4=Easy to remember, 5=No problem",
  },
  {
    name: 'list_lessons',
    description: 'List/search lessons (paginated)',
  },
  {
    name: 'list_sentences',
    description: 'List sentences for a lesson (paginated)',
  },
  {
    name: 'list_words',
    description: 'List marked words; optional exact words[] filter',
  },
];

const CONNECTOR_STEPS = [
  'Open Claude Desktop → Settings → Customize → Connectors.',
  'Click Add → Add custom connector.',
  'Name: enter PolyglotIO (or any label you like).',
  'Remote MCP server URL: paste the URL below (token is already in the query string).',
  'Leave Advanced settings / OAuth Client ID & Secret empty — Polyglot does not use OAuth.',
  'Click Add. Claude will connect to your Polyglot account via that URL.',
];

const DEVELOPER_CONFIG_STEPS = [
  'Open Claude Desktop → Settings → Desktop app → Developer.',
  'Click Edit Config to open claude_desktop_config.json.',
  'Merge the JSON below into mcpServers (keep any existing servers).',
  'Save the file and fully quit + reopen Claude Desktop.',
];

const CURSOR_STEPS = [
  'Open Cursor → Settings → Cursor Settings → MCP (or Features → MCP).',
  'Click Add new MCP server / Edit in mcp.json.',
  'Merge the JSON below into mcpServers (keep any existing servers).',
  'Save. Cursor should pick up the Polyglot server; reload MCP if needed.',
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
      setCopyFeedback(`${label} copied`);
      window.setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback(`Failed to copy ${label}`);
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
          Use Polyglot as a remote MCP server in Claude Desktop or Cursor. Auth
          is your login token in the URL (`?token=...`) — no Authorization
          header and no OAuth Client ID/Secret.
        </Text>

        {!token && (
          <Text size="2" color="red" mb="3" as="div">
            Sign in to copy your connector URL or config.
          </Text>
        )}

        {copyFeedback && (
          <Text size="2" color="green" mb="3" as="div">
            {copyFeedback}
          </Text>
        )}

        <CollapsibleSection
          title="Claude Desktop — custom connector"
          open={connectorOpen}
          onToggle={() => setConnectorOpen(open => !open)}
        >
          <Box
            mb="4"
            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            {CONNECTOR_STEPS.map((step, index) => (
              <Text key={step} size="2" as="div">
                {index + 1}. {step}
              </Text>
            ))}
          </Box>

          <Text size="2" weight="bold" mb="2" as="div">
            Remote MCP server URL
          </Text>
          <Text size="2" color="gray" mb="2" as="div">
            Paste into the URL field in Add custom connector. If you log out or
            get a new token, update the connector URL.
          </Text>

          <Flex gap="3" mb="3" wrap="wrap">
            <MyButton
              onClick={() => copyText(mcpUrl, 'URL')}
              disabled={!token}
              variant="solid"
            >
              Copy URL
            </MyButton>
            <MyButton
              onClick={() => token && copyText(token, 'Token')}
              disabled={!token}
              variant="soft"
            >
              Copy token only
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
          title="Claude Desktop — developer Edit Config"
          open={developerOpen}
          onToggle={() => setDeveloperOpen(open => !open)}
        >
          <Box
            mb="4"
            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            {DEVELOPER_CONFIG_STEPS.map((step, index) => (
              <Text key={step} size="2" as="div">
                {index + 1}. {step}
              </Text>
            ))}
          </Box>

          <Text size="2" weight="bold" mb="2" as="div">
            claude_desktop_config.json
          </Text>
          <Text size="2" color="gray" mb="2" as="div">
            Merge under <Code>mcpServers</Code>. Token is embedded in the URL —
            no headers or OAuth fields.
          </Text>

          <Flex gap="3" mb="3" wrap="wrap">
            <MyButton
              onClick={() => copyText(mcpConfigJson, 'Config')}
              disabled={!token}
              variant="solid"
            >
              Copy config
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
          title="Cursor — MCP settings"
          open={cursorOpen}
          onToggle={() => setCursorOpen(open => !open)}
        >
          <Box
            mb="4"
            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            {CURSOR_STEPS.map((step, index) => (
              <Text key={step} size="2" as="div">
                {index + 1}. {step}
              </Text>
            ))}
          </Box>

          <Text size="2" weight="bold" mb="2" as="div">
            mcp.json
          </Text>
          <Text size="2" color="gray" mb="2" as="div">
            Merge under <Code>mcpServers</Code>. Token is embedded in the URL —
            no headers needed.
          </Text>

          <Flex gap="3" mb="3" wrap="wrap">
            <MyButton
              onClick={() => copyText(mcpConfigJson, 'Config')}
              disabled={!token}
              variant="solid"
            >
              Copy config
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
          Tools
        </Text>
        <Box style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {MCP_TOOLS.map(tool => (
            <Box key={tool.name}>
              <Text size="2" weight="bold" as="div">
                {tool.name}
              </Text>
              <Text size="2" color="gray" as="div">
                {tool.description}
              </Text>
            </Box>
          ))}
        </Box>
      </Card>
    </Container>
  );
};

export default McpPage;
