import React from 'react';
import { Box, Flex, Text, Button, Separator } from '@radix-ui/themes';
import { ReaderIcon, ExitIcon } from '@radix-ui/react-icons';
import { useAuth } from '../contexts/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

interface SidebarProps {
  // No navigation props needed since we only have lessons
}

const Sidebar: React.FC<SidebarProps> = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <Box
      style={{
        width: '280px',
        minHeight: '100vh',
        backgroundColor: 'var(--color-surface)',
        borderRight: '1px solid var(--gray-6)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box p="4">
        <Flex direction="column" gap="2">
          <Text size="4" weight="bold" color="blue">
            PolyglotIO
          </Text>
          <Text size="2" color="gray">
            Welcome, {user?.username}
          </Text>
        </Flex>
      </Box>

      <Separator size="4" />

      {/* Language Switcher */}
      <Box p="4">
        <Text size="2" weight="medium" mb="3" as="div">
          Language
        </Text>
        <LanguageSwitcher />
      </Box>

      <Separator size="4" />

      {/* Current View */}
      <Box p="4" flexGrow="1">
        <Text size="2" weight="medium" mb="3" as="div">
          Current View
        </Text>
        <Flex direction="column" gap="2">
          <Button
            variant="solid"
            style={{ justifyContent: 'flex-start' }}
            disabled
          >
            <ReaderIcon />
            Lessons
          </Button>
        </Flex>
      </Box>

      {/* Footer */}
      <Box p="4">
        <Button
          variant="ghost"
          color="red"
          onClick={handleLogout}
          style={{ width: '100%', justifyContent: 'flex-start' }}
        >
          <ExitIcon />
          Logout
        </Button>
      </Box>
    </Box>
  );
};

export default Sidebar;
