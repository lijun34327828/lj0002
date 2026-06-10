import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAttempt } from '../services/examApi';
import { getExamAnswers, getGradingTask } from '../services/resultApi';
import type { ExamAttempt, ExamAnswer } from '../types';

const ExamResult = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [answers, setAnswers] = useState<ExamAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    if (attemptId) {
      loadResult();
    }
  }, [attemptId]);

  useEffect(() => {
    if (attempt?.status === 'submitted' || attempt?.status === 'reviewing') {
      const interval = setInterval(() => {
        loadResult();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [attempt?.status]);

  const loadResult = async () => {
    if (!attemptId) return;
    
    try {
      setLoading(true);
      const attemptData = await getAttempt(attemptId);
      setAttempt(attemptData);
      
      if (attemptData.status === 'graded' || attemptData.status === 'published' || attemptData.status === 'reviewing') {
        setGrading(attemptData.status === 'reviewing');
      } else if (attemptData.status === 'submitted') {
        setGrading(true);
      }
    } catch (err) {
      console.error('加载成绩失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusLabels: Record<string, string> = {
    not_started: '未开始',
    in_progress: '答题中',
    submitted: '已提交',
    graded: '已评分',
    reviewing: '待审核',
    published: '已发布'
  };

  const getScoreColor = () => {
    if (!attempt || attempt.score === null) return 'text-gray-400';
    if (attempt.passed) return 'text-green-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">加载中...</div>
    );
  }

  if (!attempt) {
    return (
      <div className="text-center py-20 text-gray-500">未找到考试记录</div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/exams')}
        className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        ← 返回考试列表
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">
            {attempt.status === 'submitted' ? '⏳' :
             attempt.status === 'reviewing' ? '📋' :
             attempt.passed ? '🎉' : '😢'}
          </div>
          
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {attempt.status === 'submitted' ? '试卷提交成功' :
             attempt.status === 'reviewing' ? '待老师批阅' :
             attempt.passed ? '恭喜，考试通过！' : '很遗憾，未通过考试'}
          </h1>
          
          <p className="text-gray-500 mb-6">
            状态：{statusLabels[attempt.status]}
          </p>

          {grading ? (
            <div className="py-8">
              <div className="inline-block animate-spin text-4xl mb-4">⚙️</div>
              <p className="text-gray-600">正在评分中，请稍候...</p>
            </div>
          ) : (
            <>
              <div className={`text-6xl font-bold mb-2 ${getScoreColor()}`}>
                {attempt.score !== null ? `${attempt.score}` : '-'}
                <span className="text-2xl text-gray-400 font-normal"> / {attempt.totalScore} 分</span>
              </div>
              
              <div className="flex items-center justify-center gap-2 mb-6">
                {attempt.passed !== null && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    attempt.passed
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {attempt.passed ? '已通过' : '未通过'}
                  </span>
                )}
                <span className="text-sm text-gray-500">
                  及格分：{attempt.passed}（假设有及格线）
                </span>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{Math.floor(attempt.durationUsed / 60)}分{attempt.durationUsed % 60}秒</p>
            <p className="text-sm text-gray-500 mt-1">用时</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">{attempt.screenSwitchCount}</p>
            <p className="text-sm text-gray-500 mt-1">切屏次数</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{attempt.cheatingCount}</p>
            <p className="text-sm text-gray-500 mt-1">异常行为</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{attempt.status === 'graded' || attempt.status === 'published' ? '已完成' : '进行中'}</p>
            <p className="text-sm text-gray-500 mt-1">考试状态</p>
          </div>
        </div>
      </div>

      {(attempt.status === 'graded' || attempt.status === 'published') && answers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">答题详情</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {answers.map((answer, index) => (
              <div key={answer.id} className="p-5">
                <div className="flex items-start gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white flex-shrink-0 ${
                    answer.isCorrect === true ? 'bg-green-500' :
                    answer.isCorrect === false ? 'bg-red-500' : 'bg-gray-400'
                  }`}>
                    {answer.isCorrect === true ? '✓' :
                     answer.isCorrect === false ? '✗' : '?'}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">第 {index + 1} 题</span>
                      <span className="text-sm">
                        <span className="text-gray-600">{answer.score}</span>
                        <span className="text-gray-400"> / {answer.maxScore}分</span>
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      你的答案：{answer.userAnswer || '未作答'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 justify-center">
        <button
          onClick={() => navigate('/exams')}
          className="px-6 py-3 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
        >
          返回考试列表
        </button>
        <button
          onClick={() => navigate('/wrong-questions')}
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          查看错题本
        </button>
      </div>
    </div>
  );
};

export default ExamResult;
