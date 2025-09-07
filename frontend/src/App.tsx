import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { WordMarkProvider } from './contexts/WordMarkContext';
import {
  AuthPage,
  LessonPage,
  LessonViewPage,
  LessonVideoViewPage,
  LessonMangaViewPage,
  WordsPage,
} from './pages';
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
      <WordMarkProvider>
        <Router>
          <Flex style={{ minHeight: '100vh' }}>
            <Sidebar />
            <Flex style={{ flex: 1 }}>
              <Routes>
                <Route path="/" element={<Navigate to="/lessons" replace />} />
                <Route path="/lessons" element={<LessonPage />} />
                <Route path="/lessons/:lessonId" element={<LessonViewPage />} />
                <Route
                  path="/lessons/:lessonId/video"
                  element={<LessonVideoViewPage />}
                />
                <Route
                  path="/lessons/:lessonId/manga"
                  element={<LessonMangaViewPage />}
                />
                <Route path="/words" element={<WordsPage />} />
              </Routes>
            </Flex>
          </Flex>
        </Router>
      </WordMarkProvider>
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
