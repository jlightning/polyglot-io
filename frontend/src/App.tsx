import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthPage, LessonPage } from './pages';
import { Flex, Text } from '@radix-ui/themes';
import Sidebar from './components/Sidebar';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        style={{ minHeight: '100vh' }}
      >
        <Text size="3">Loading...</Text>
      </Flex>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <LanguageProvider>
      <Flex style={{ minHeight: '100vh' }}>
        <Sidebar />
        <Flex style={{ flex: 1 }}>
          <LessonPage />
        </Flex>
      </Flex>
    </LanguageProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
