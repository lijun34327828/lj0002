import { useEffect, useState } from 'react';
import { getWrongQuestions, getKnowledgeWeakness } from '../services/resultApi';
import { getSubjects } from '../services/questionApi';
import type { WrongQuestion, KnowledgeWeakness, Subject } from '../types';

const WrongQuestions = () => {
  const [questions, setQuestions] = useState<WrongQuestion[]>([]);
  const [weaknesses, setWeaknesses] = useState<KnowledgeWeakness[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'questions' | 'weakness'>('questions');

  useEffect(() => {
    loadSubjects();
    loadData();
  }, [selectedSubject, page, activeTab]);

  const loadSubjects = async () => {
    try {
      const data = await getSubjects();
      setSubjects(data);
    } catch (err) {
      console.error('加载科目失败:', err);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'questions') {
        const result = await getWrongQuestions({
          subjectId: selectedSubject || undefined,
          page,
          pageSize
        });
        setQuestions(result.list as WrongQuestion[]);
        setTotal(result.total);
      } else {
        const data = await getKnowledgeWeakness(selectedSubject || undefined);
        setWeaknesses(data);
      }
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
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

  const difficultyLabels: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
    expert: '专家'
  };

  const totalPages = Math.ceil(total / pageSize);

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'bg-green-500';
    if (accuracy >= 60) return 'bg-yellow-500';
    if (accuracy >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">❌ 错题本</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'questions'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            错题列表
          </button>
          <button
            onClick={() => setActiveTab('weakness')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'weakness'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            薄弱知识点
          </button>
        </div>

        <div className="p-5">
          <div className="flex gap-4 mb-4">
            <select
              value={selectedSubject}
              onChange={(e) => { setSelectedSubject(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="">全部科目</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {activeTab === 'questions' && (
            <>
              {loading ? (
                <div className="text-center py-12 text-gray-500">加载中...</div>
              ) : questions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-4">🎉</div>
                  <p>暂无错题，继续保持！</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((q, index) => (
                    <div
                      key={q.id}
                      className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-gray-400 text-sm">
                          {(page - 1) * pageSize + index + 1}.
                        </span>
                        {q.type && (
                          <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                            {typeLabels[q.type] || q.type}
                          </span>
                        )}
                        {q.difficulty && (
                          <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                            {difficultyLabels[q.difficulty] || q.difficulty}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-red-500">
                          错误 {q.wrongCount} 次
                        </span>
                      </div>
                      <p className="text-gray-800 mb-3">{q.content || '题目内容'}</p>
                      <div className="flex gap-6 text-sm">
                        <div>
                          <span className="text-gray-500">你的答案：</span>
                          <span className="text-red-600">{q.userAnswer || '未作答'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">正确答案：</span>
                          <span className="text-green-600">{q.correctAnswer}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-gray-600">
                    第 {page} / {totalPages} 页，共 {total} 道
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'weakness' && (
            <>
              {loading ? (
                <div className="text-center py-12 text-gray-500">加载中...</div>
              ) : weaknesses.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-4">📊</div>
                  <p>暂无数据，完成考试后再来查看吧</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 mb-4">
                    根据你的答题记录，以下是知识点掌握情况
                  </p>
                  {weaknesses
                    .sort((a, b) => a.accuracy - b.accuracy)
                    .map((kp) => (
                    <div key={kp.knowledgePointId} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">{kp.knowledgePointName}</span>
                        <span className={`px-2 py-0.5 text-xs rounded text-white ${getAccuracyColor(kp.accuracy)}`}>
                          正确率 {kp.accuracy}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${getAccuracyColor(kp.accuracy)}`}
                          style={{ width: `${kp.accuracy}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>共 {kp.totalQuestions} 题</span>
                        <span>正确 {kp.correctCount} 题</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WrongQuestions;
