import React, { useEffect } from 'react';
import { Box, Flex, Text, Button, Separator } from '@radix-ui/themes';
import { ReaderIcon, ExitIcon, BookmarkIcon } from '@radix-ui/react-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

interface SidebarProps {}

const Sidebar: React.FC<SidebarProps> = () => {
  const {
    user,
    logout,
    userScore,
    knownWordsCount,
    scoreHistory,
    fetchUserStats,
    isAuthenticated,
  } = useAuth();
  const { selectedLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
  };

  // Fetch stats when selected language changes
  useEffect(() => {
    if (isAuthenticated && selectedLanguage && selectedLanguage.trim() !== '') {
      fetchUserStats(selectedLanguage);
    }
  }, [isAuthenticated, selectedLanguage, fetchUserStats]);

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
          <Text
            size="2"
            color={userScore >= 200 ? 'green' : 'yellow'}
            weight="medium"
          >
            Today's Score: {userScore} / 200
          </Text>
        </Flex>

        {/* 7-Day Score History */}
        {scoreHistory.length > 0 && (
          <Box mt="3">
            <Text size="2" weight="medium" mb="2" as="div" color="gray">
              7-Day Score History
            </Text>
            <Flex
              direction="row"
              align="end"
              gap="2"
              style={{ height: '80px', padding: '0 4px' }}
            >
              {scoreHistory.map((day, index) => {
                const maxScore = Math.max(
                  ...scoreHistory.map(d => d.score),
                  200
                ); // Use 200 as minimum max for better scaling
                const heightRatio = maxScore > 0 ? day.score / maxScore : 0;
                const isToday = index === scoreHistory.length - 1;
                const barHeight =
                  day.score > 0 ? Math.max(heightRatio * 60, 6) : 3; // 60px max height, minimum 6px for scores, 3px for zero

                return (
                  <Flex
                    key={day.date}
                    direction="column"
                    align="center"
                    gap="1"
                    style={{ flex: 1, minWidth: '28px' }}
                  >
                    <Box
                      style={{
                        width: '24px',
                        height: `${barHeight}px`,
                        backgroundColor:
                          day.score >= 200
                            ? 'var(--green-9)'
                            : day.score > 0
                              ? 'var(--yellow-9)'
                              : 'var(--gray-6)',
                        borderRadius: '3px',
                        transition: 'all 0.2s ease',
                        cursor: 'default',
                      }}
                      title={`${new Date(day.date).toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}: ${day.score} pts`}
                    />
                    <Text size="1" color="gray" style={{ fontSize: '10px' }}>
                      {new Date(day.date)
                        .toLocaleDateString('en', { weekday: 'short' })
                        .slice(0, 1)}
                    </Text>
                  </Flex>
                );
              })}
            </Flex>
          </Box>
        )}

        {/* Known Words - moved below chart */}
        <Box mt="3">
          <Text size="2" color="blue" weight="medium">
            Known Words: {knownWordsCount}
          </Text>
        </Box>
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
