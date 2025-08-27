import React from 'react';
import { Box, Flex, Text, Button, Separator } from '@radix-ui/themes';
import { ReaderIcon, ExitIcon, BookmarkIcon } from '@radix-ui/react-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

interface SidebarProps {}

const Sidebar: React.FC<SidebarProps> = () => {
  const { user, logout, dailyScore } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
  };

  const isLessonsActive = location.pathname.startsWith('/lessons');
  const isWordsActive = location.pathname === '/words';

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
          <Text size="2" color="green" weight="medium">
            Today's Score: {dailyScore}
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

      {/* Navigation */}
      <Box p="4" flexGrow="1">
        <Text size="2" weight="medium" mb="3" as="div">
          Navigation
        </Text>
        <Flex direction="column" gap="2">
          <Button
            variant={isLessonsActive ? 'solid' : 'soft'}
            style={{ justifyContent: 'flex-start' }}
            onClick={() => navigate('/lessons')}
          >
            <ReaderIcon />
            Lessons
          </Button>
          <Button
            variant={isWordsActive ? 'solid' : 'soft'}
            style={{ justifyContent: 'flex-start' }}
            onClick={() => navigate('/words')}
          >
            <BookmarkIcon />
            Words
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
