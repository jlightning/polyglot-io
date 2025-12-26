import React, { useEffect } from 'react';
import { Box, Flex, Text, Separator } from '@radix-ui/themes';
import MyButton from './MyButton';
import { ReaderIcon, ExitIcon, BookmarkIcon } from '@radix-ui/react-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import { DAILY_SCORE_TARGET } from '../constants/scoreConstants';

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
            color={userScore >= DAILY_SCORE_TARGET ? 'green' : 'yellow'}
            weight="medium"
          >
            Today's Score: {userScore} / {DAILY_SCORE_TARGET}
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
              style={{ height: '90px', padding: '0 4px' }}
            >
              {scoreHistory.map(day => {
                const maxScore = Math.max(
                  ...scoreHistory.map(d => d.score),
                  DAILY_SCORE_TARGET
                ); // Use DAILY_SCORE_TARGET as minimum max for better scaling

                // Calculate heights for stacked bars
                const actualScore = day.actualScore || 0;
                const backfilledAmount = day.backfilledAmount || 0;
                const totalScore = day.score || 0;

                const actualHeightRatio =
                  maxScore > 0 ? actualScore / maxScore : 0;
                const backfilledHeightRatio =
                  maxScore > 0 ? backfilledAmount / maxScore : 0;

                const actualBarHeight =
                  actualScore > 0 ? Math.max(actualHeightRatio * 60, 6) : 0; // 60px max height, minimum 6px for scores
                const backfilledBarHeight =
                  backfilledAmount > 0
                    ? Math.max(backfilledHeightRatio * 60, 6)
                    : 0;

                const totalBarHeight =
                  totalScore > 0
                    ? Math.max((totalScore / maxScore) * 60, 6)
                    : 3; // 3px for zero scores

                // Determine color for actual score portion
                const actualColor =
                  actualScore >= DAILY_SCORE_TARGET
                    ? 'var(--green-9)'
                    : actualScore > 0
                      ? 'var(--yellow-9)'
                      : 'var(--gray-6)';

                return (
                  <Flex
                    key={day.date}
                    direction="column"
                    align="center"
                    gap="1"
                    style={{ flex: 1, minWidth: '28px' }}
                  >
                    <Text size="1" style={{ fontSize: '8px' }}>
                      {totalScore}
                    </Text>
                    <Box
                      style={{
                        width: '24px',
                        height: `${totalBarHeight}px`,
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                      }}
                      title={`${new Date(day.date).toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}: ${totalScore} pts${backfilledAmount > 0 ? ` (${actualScore} actual + ${backfilledAmount} backfilled)` : ''}`}
                    >
                      {/* Zero score indicator */}
                      {totalScore === 0 ? (
                        <Box
                          style={{
                            width: '100%',
                            height: '3px',
                            backgroundColor: 'var(--gray-6)',
                            borderRadius: '3px',
                          }}
                        />
                      ) : (
                        <>
                          {/* Backfilled portion (top, orange) */}
                          {backfilledBarHeight > 0 && (
                            <Box
                              style={{
                                width: '100%',
                                height: `${backfilledBarHeight}px`,
                                backgroundColor: 'var(--orange-9)',
                                borderRadius:
                                  actualBarHeight > 0 ? '0 0 3px 3px' : '3px',
                                transition: 'all 0.2s ease',
                              }}
                            />
                          )}
                          {/* Actual score portion (bottom) */}
                          {actualBarHeight > 0 && (
                            <Box
                              style={{
                                width: '100%',
                                height: `${actualBarHeight}px`,
                                backgroundColor: actualColor,
                                borderRadius:
                                  backfilledBarHeight > 0
                                    ? '3px 3px 0 0'
                                    : '3px',
                                transition: 'all 0.2s ease',
                              }}
                            />
                          )}
                        </>
                      )}
                    </Box>
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
          <MyButton
            variant={isLessonsActive ? 'solid' : 'soft'}
            style={{ justifyContent: 'flex-start' }}
            onClick={() => navigate('/lessons')}
          >
            <ReaderIcon />
            Lessons
          </MyButton>
          <MyButton
            variant={isWordsActive ? 'solid' : 'soft'}
            style={{ justifyContent: 'flex-start' }}
            onClick={() => navigate('/words')}
          >
            <BookmarkIcon />
            Words
          </MyButton>
        </Flex>
      </Box>

      {/* Footer */}
      <Box p="4">
        <MyButton
          variant="ghost"
          color="red"
          onClick={handleLogout}
          style={{ width: '100%', justifyContent: 'flex-start' }}
        >
          <ExitIcon />
          Logout
        </MyButton>
      </Box>
    </Box>
  );
};

export default Sidebar;
