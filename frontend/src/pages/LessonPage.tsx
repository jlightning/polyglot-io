import React, { useState } from 'react';
import {
  Container,
  Flex,
  Heading,
  Text,
  Box,
  Separator,
} from '@radix-ui/themes';
import { useLanguage } from '../contexts/LanguageContext';
import LessonList from '../components/LessonList';
import LessonUpload from '../components/LessonUpload';

const LessonPage: React.FC = () => {
  const { selectedLanguage } = useLanguage();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleLessonUploaded = () => {
    // Trigger refresh of lesson list
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <Container size="4" p="4">
      {/* Header */}
      <Flex direction="column" gap="4" mb="6">
        <Heading size="6">Lessons</Heading>
        <Text size="3" color="gray">
          Manage and view your language learning lessons
        </Text>
      </Flex>

      {/* Language Controls */}
      <Flex justify="between" align="center" mb="4">
        <Box>
          <Text size="2" color="gray">
            {selectedLanguage === 'all'
              ? 'Showing lessons from all languages'
              : `Showing lessons for: ${selectedLanguage.toUpperCase()}`}
          </Text>
        </Box>
        <LessonUpload onLessonUploaded={handleLessonUploaded} />
      </Flex>

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

export default LessonPage;
