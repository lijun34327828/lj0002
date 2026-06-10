import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getExam, getExamQuestions, startExam, getUserAttempts } from '../services/examApi';
import useAuthStore from '../stores/useAuthStore';
import type { Exam, ExamQuestion, ExamAttempt } from '../types';

const ExamDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (id) {
      loadExam();
    }
  }, [id]);

  const loadExam = async () => {
    try {
      setLoading(true);
      const [examData, questionsData, attemptsData] = await Promise.all([
        getExam(id!),
        getExamQuestions(id!),
        getUserAttempts(id!)
      ]);
      
      setExam(examData);
      setQuestions(questionsData);
      if (attemptsData.length > 0) {
        setAttempt(attemptsData[0]);
      }
    } catch (err) {
      console.error('加载考试详情失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = async () => {
    if (!id) return;
    
    try {
      setStarting(true);
      const result = await startExam(id);
      navigate(`/exam/${id}`, { state: { attemptId: result.attempt.id } });
    } catch (err: any) {
      alert(err.response?.data?.error || '开始考试失败');
    } finally {
      setStarting(false);
    }
  };

  const typeLabels: Record<string, string> = {
    single_choice: '单选题',
    multiple_choice: '多选题',
    true_false: '判断题',
    fill_blank: '填空题',
    short_answer: '简答题',
    essay: '论述题'
  };

  if (loading) {
    return <div className="text-center py-20 text-gray-500">加载中...</div>;
  }

  if (!exam) {
    return <div className="text-center py-20 text-gray-500">考试不存在</div>;
  }

  const canStart = user?.role === 'student' && 
    (exam.status === 'published' || exam.status === 'ongoing') &&
    (!attempt || attempt.status === 'not_started' || attempt.status === 'in_progress');

  const canViewResult = attempt && 
    (attempt.status === 'graded' || attempt.status === 'published' || attempt.status === 'reviewing');

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/exams')}
        className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        ← 返回考试列表
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">{exam.name}</h1>
            <p className="text-gray-500">{exam.description || '暂无描述'}</p>
          </div>
          <div className="flex gap-3">
            {canStart && (
              <button
                onClick={handleStartExam}
                disabled={starting}
                className="px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {attempt?.status === 'in_progress' ? '继续考试' : '开始考试'}
              </button>
            )}
            {canViewResult && (
              <button
                onClick={() => navigate(`/result/${attempt!.id}`)}
                className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                查看成绩
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-gray-100">
          <div className="text-center">
            <p className="text-3xl font-bold text-primary-600">{exam.duration}</p>
            <p className="text-sm text-gray-500 mt-1">考试时长（分钟）</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{exam.totalScore}</p>
            <p className="text-sm text-gray-500 mt-1">总分</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-600">{exam.passScore}</p>
            <p className="text-sm text-gray-500 mt-1">及格分</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{questions.length}</p>
            <p className="text-sm text-gray-500 mt-1">题目数量</p>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold text-gray-800 mb-4">考试规则</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-gray-600">
              <span className={exam.allowBack ? 'text-green-500' : 'text-red-500'}>
                {exam.allowBack ? '✓' : '✗'}
              </span>
              <span>允许返回上一题</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <span className={exam.showScore ? 'text-green-500' : 'text-red-500'}>
                {exam.showScore ? '✓' : '✗'}
              </span>
              <span>交卷后显示分数</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <span className={exam.showAnswer ? 'text-green-500' : 'text-red-500'}>
                {exam.showAnswer ? '✓' : '✗'}
              </span>
              <span>交卷后显示答案</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <span className={exam.shuffleQuestions ? 'text-green-500' : 'text-red-500'}>
                {exam.shuffleQuestions ? '✓' : '✗'}
              </span>
              <span>题目乱序</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <span className={exam.shuffleOptions ? 'text-green-500' : 'text-red-500'}>
                {exam.shuffleOptions ? '✓' : '✗'}
              </span>
              <span>选项乱序</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <span className={exam.antiCheating ? 'text-green-500' : 'text-red-500'}>
                {exam.antiCheating ? '✓' : '✗'}
              </span>
              <span>防作弊检测</span>
            </div>
          </div>
        </div>
      </div>

      {questions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">题型分布</h2>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap gap-4">
              {Object.entries(
                questions.reduce((acc, q) => {
                  const type = q.questionSnapshot.type;
                  acc[type] = (acc[type] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([type, count]) => (
                <div key={type} className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">{typeLabels[type] || type}</span>
                  <span className="font-semibold text-primary-600">{count}题</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {attempt && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">我的考试记录</h2>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600">
                  状态：
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded ${
                    attempt.status === 'graded' || attempt.status === 'published'
                      ? 'bg-green-100 text-green-600'
                      : attempt.status === 'in_progress'
                        ? 'bg-yellow-100 text-yellow-600'
                        : 'bg-gray-100 text-gray-600'
                  }`}>
                    {attempt.status === 'in_progress' ? '进行中' :
                     attempt.status === 'submitted' ? '已提交' :
                     attempt.status === 'graded' ? '已评分' :
                     attempt.status === 'reviewing' ? '待审核' :
                     attempt.status === 'published' ? '已发布' : '未开始'}
                  </span>
                </p>
                {attempt.score !== null && (
                  <p className="text-2xl font-bold text-primary-600 mt-2">
                    {attempt.score} 分
                    {attempt.passed && <span className="text-green-500 text-sm ml-2">✓ 已通过</span>}
                    {!attempt.passed && attempt.passed !== null && <span className="text-red-500 text-sm ml-2">✗ 未通过</span>}
                  </p>
                )}
              </div>
              {canViewResult && (
                <button
                  onClick={() => navigate(`/result/${attempt.id}`)}
                  className="text-primary-600 hover:text-primary-700"
                >
                  查看详情 →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamDetail;
