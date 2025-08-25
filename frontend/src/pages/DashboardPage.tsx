import React, { useState } from 'react';
import {
  Container,
  Flex,
  Heading,
  Button,
  Text,
  Card,
  Box,
  Separator,
} from '@radix-ui/themes';
import { ExitIcon } from '@radix-ui/react-icons';
import { useAuth } from '../contexts/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import LessonList from '../components/LessonList';
import LessonUpload from '../components/LessonUpload';

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleLanguageChange = (languageCode: string) => {
    setSelectedLanguage(languageCode);
  };

  const handleLessonUploaded = () => {
    // Trigger refresh of lesson list
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <Container size="4" p="4">
      {/* Header */}
      <Card mb="6">
        <Flex justify="between" align="center" p="4">
          <Flex direction="column" gap="1">
            <Heading size="6">Welcome back, {user?.username}!</Heading>
            <Text size="2" color="gray">
              Manage your language learning lessons
            </Text>
          </Flex>
          <Button variant="ghost" color="red" onClick={handleLogout}>
            <ExitIcon />
            Logout
          </Button>
        </Flex>
      </Card>

      {/* Language Controls */}
      <Card mb="4">
        <Flex justify="between" align="center" p="4">
          <Flex align="center" gap="4">
            <LanguageSwitcher
              selectedLanguage={selectedLanguage}
              onLanguageChange={handleLanguageChange}
            />
            <Button
              variant="soft"
              onClick={() => setSelectedLanguage('all')}
              disabled={selectedLanguage === 'all'}
            >
              Show All Languages
            </Button>
          </Flex>
          <LessonUpload
            selectedLanguage={selectedLanguage}
            onLessonUploaded={handleLessonUploaded}
          />
        </Flex>
      </Card>

      {/* Current Filter Info */}
      <Box mb="4">
        <Text size="2" color="gray">
          {selectedLanguage === 'all'
            ? 'Showing lessons from all languages'
            : `Showing lessons for: ${selectedLanguage.toUpperCase()}`}
        </Text>
      </Box>

      <Separator size="4" mb="4" />

      {/* Lessons Section */}
      <Box>
        <Flex align="center" justify="between" mb="4">
          <Heading size="4">Your Lessons</Heading>
          <Text size="2" color="gray">
            Refresh automatically after upload
          </Text>
        </Flex>

        <LessonList
          selectedLanguage={selectedLanguage}
          refreshTrigger={refreshTrigger}
        />
      </Box>
    </Container>
  );
};

export default DashboardPage;
