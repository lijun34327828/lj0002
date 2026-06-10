import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/useAuthStore';
import { getExams, getUserAttempts } from '../services/examApi';
import { getWrongQuestions } from '../services/resultApi';
import type { Exam, ExamAttempt } from '../types';

const Home = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [wrongCount, setWrongCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [examsRes, attemptsRes, wrongRes] = await Promise.all([
        getExams({ pageSize: 5 }),
        getUserAttempts(),
        getWrongQuestions({ pageSize: 1 })
      ]);
      
      setExams(examsRes.list);
      setAttempts(attemptsRes.slice(0, 5));
      setWrongCount(wrongRes.total);
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: '可参加考试', value: exams.length, icon: '📝', color: 'blue' },
    { label: '已完成考试', value: attempts.filter(a => a.status === 'graded' || a.status === 'published').length, icon: '✅', color: 'green' },
    { label: '错题数量', value: wrongCount, icon: '❌', color: 'red' },
    { label: '学习天数', value: 7, icon: '📅', color: 'purple' }
  ];

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; class: string }> = {
      draft: { label: '草稿', class: 'bg-gray-100 text-gray-600' },
      published: { label: '已发布', class: 'bg-green-100 text-green-600' },
      ongoing: { label: '进行中', class: 'bg-blue-100 text-blue-600' },
      finished: { label: '已结束', class: 'bg-gray-100 text-gray-600' },
      in_progress: { label: '答题中', class: 'bg-yellow-100 text-yellow-600' },
      submitted: { label: '已提交', class: 'bg-blue-100 text-blue-600' },
      graded: { label: '已评分', class: 'bg-green-100 text-green-600' },
      reviewing: { label: '待审核', class: 'bg-orange-100 text-orange-600' },
      published: { label: '已发布', class: 'bg-green-100 text-green-600' }
    };
    
    const info = statusMap[status] || { label: status, class: 'bg-gray-100 text-gray-600' };
    return <span className={`px-2 py-1 text-xs rounded-full ${info.class}`}>{info.label}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary-500 to-primary-700 rounded-2xl p-8 text-white">
        <h1 className="text-2xl font-bold mb-2">
          欢迎回来，{user?.realName || user?.username} 👋
        </h1>
        <p className="text-primary-100">
          今天也要加油学习哦！坚持就是胜利 💪
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{stat.value}</p>
              </div>
              <div className="text-4xl">{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">最新考试</h2>
            <button
              onClick={() => navigate('/exams')}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              查看全部 →
            </button>
          </div>
          <div className="p-5 space-y-3">
            {exams.length === 0 ? (
              <p className="text-gray-400 text-center py-8">暂无考试</p>
            ) : (
              exams.map((exam) => (
                <div
                  key={exam.id}
                  onClick={() => navigate(`/exams/${exam.id}`)}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-medium text-gray-800">{exam.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {exam.duration}分钟 · {exam.totalScore}分
                    </p>
                  </div>
                  {getStatusBadge(exam.status)}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">我的考试记录</h2>
            <button
              onClick={() => navigate('/wrong-questions')}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              错题本 →
            </button>
          </div>
          <div className="p-5 space-y-3">
            {attempts.length === 0 ? (
              <p className="text-gray-400 text-center py-8">暂无考试记录</p>
            ) : (
              attempts.map((attempt) => (
                <div
                  key={attempt.id}
                  onClick={() => navigate(`/result/${attempt.id}`)}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-medium text-gray-800">考试 #{attempt.id.slice(0, 8)}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {attempt.score !== null ? `${attempt.score}分` : '待评分'}
                    </p>
                  </div>
                  {getStatusBadge(attempt.status)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
