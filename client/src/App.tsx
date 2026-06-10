import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from './stores/useAuthStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import QuestionBank from './pages/QuestionBank';
import ExamCreate from './pages/ExamCreate';
import ExamList from './pages/ExamList';
import ExamDetail from './pages/ExamDetail';
import ExamRoom from './pages/ExamRoom';
import ExamResult from './pages/ExamResult';
import WrongQuestions from './pages/WrongQuestions';
import Profile from './pages/Profile';

function App() {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    const handleOffline = () => {
      console.warn('网络连接断开');
    };
    const handleOnline = () => {
      console.log('网络连接恢复');
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
      
      <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Home />} />
        <Route path="questions" element={<QuestionBank />} />
        <Route path="exams" element={<ExamList />} />
        <Route path="exams/create" element={<ExamCreate />} />
        <Route path="exams/:id" element={<ExamDetail />} />
        <Route path="exam/:id" element={<ExamRoom />} />
        <Route path="result/:attemptId" element={<ExamResult />} />
        <Route path="wrong-questions" element={<WrongQuestions />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
