import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthPage, DashboardPage } from './pages';
import { Flex, Text } from '@radix-ui/themes';

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

  return isAuthenticated ? <DashboardPage /> : <AuthPage />;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
