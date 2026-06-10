import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSubjects, getKnowledgePoints, getQuestions
} from '../services/questionApi';
import { generatePaper, createExam } from '../services/examApi';
import type { Subject, KnowledgePoint, ExamConfig, ExamQuestion } from '../types';

const ExamCreate = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  
  const [examName, setExamName] = useState('');
  const [examDesc, setExamDesc] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [duration, setDuration] = useState(60);
  const [passScore, setPassScore] = useState(60);
  
  const [difficultyRatio, setDifficultyRatio] = useState({
    easy: 0.3,
    medium: 0.5,
    hard: 0.2,
    expert: 0
  });
  
  const [typeCount, setTypeCount] = useState({
    single_choice: 5,
    multiple_choice: 3,
    true_false: 2,
    fill_blank: 2,
    short_answer: 1,
    essay: 0
  });
  
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [knowledgeCoverage, setKnowledgeCoverage] = useState(80);
  const [selectedKps, setSelectedKps] = useState<string[]>([]);
  const [requiredIds, setRequiredIds] = useState<string[]>([]);
  
  const [previewResult, setPreviewResult] = useState<{
    questions: ExamQuestion[];
    totalScore: number;
    difficultyStats: Record<string, number>;
    typeStats: Record<string, number>;
    knowledgeCoverage: number;
    warnings: string[];
  } | null>(null);
  
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      loadKnowledgePoints();
      loadQuestionCount();
    }
  }, [selectedSubject]);

  const loadSubjects = async () => {
    try {
      const data = await getSubjects();
      setSubjects(data);
    } catch (err) {
      console.error('加载科目失败:', err);
    }
  };

  const loadKnowledgePoints = async () => {
    try {
      const data = await getKnowledgePoints(selectedSubject);
      setKnowledgePoints(data);
    } catch (err) {
      console.error('加载知识点失败:', err);
    }
  };

  const loadQuestionCount = async () => {
    try {
      const result = await getQuestions({
        subjectId: selectedSubject,
        pageSize: 1
      });
      setQuestionCount(result.total);
    } catch (err) {
      console.error('获取题目数量失败:', err);
    }
  };

  const handleGeneratePreview = async () => {
    try {
      setGenerating(true);
      
      const config: ExamConfig = {
        subjectId: selectedSubject,
        knowledgePointIds: selectedKps.length > 0 ? selectedKps : undefined,
        difficultyRatio,
        typeCount,
        totalQuestions,
        requiredQuestionIds: requiredIds,
        totalScore: 100,
        duration,
        knowledgeCoverage
      };
      
      const result = await generatePaper(config);
      setPreviewResult(result);
      setStep(2);
    } catch (err: any) {
      alert(err.response?.data?.error || '组卷失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateExam = async () => {
    if (!examName.trim()) {
      alert('请输入考试名称');
      return;
    }
    
    try {
      setCreating(true);
      
      const config: ExamConfig = {
        subjectId: selectedSubject,
        knowledgePointIds: selectedKps.length > 0 ? selectedKps : undefined,
        difficultyRatio,
        typeCount,
        totalQuestions,
        requiredQuestionIds: requiredIds,
        totalScore: 100,
        duration,
        knowledgeCoverage
      };
      
      const result = await createExam({
        name: examName,
        description: examDesc,
        subjectId: selectedSubject,
        duration,
        passScore,
        config
      });
      
      alert('考试创建成功！');
      navigate(`/exams/${result.exam.id}`);
    } catch (err: any) {
      alert(err.response?.data?.error || '创建失败');
    } finally {
      setCreating(false);
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

  const totalTypeCount = Object.values(typeCount).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => step === 1 ? navigate('/exams') : setStep(1)}
          className="text-gray-500 hover:text-gray-700"
        >
          ← 返回
        </button>
        <h1 className="text-2xl font-bold text-gray-800">🧠 智能组卷</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-center gap-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                step >= s ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {s}
              </div>
              <span className={`ml-2 text-sm ${
                step >= s ? 'text-gray-800 font-medium' : 'text-gray-400'
              }`}>
                {s === 1 ? '设置参数' : s === 2 ? '预览试卷' : '确认创建'}
              </span>
              {s < 3 && (
                <div className={`w-20 h-1 mx-4 ${
                  step > s ? 'bg-primary-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-gray-800 mb-4">基本信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">考试名称 *</label>
                <input
                  type="text"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="请输入考试名称"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">科目 *</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">请选择科目</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">考试时长（分钟）</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">及格分数</label>
                <input
                  type="number"
                  value={passScore}
                  onChange={(e) => setPassScore(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">考试描述</label>
                <textarea
                  value={examDesc}
                  onChange={(e) => setExamDesc(e.target.value)}
                  placeholder="请输入考试描述（可选）"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {selectedSubject && (
            <>
              <div className="border-t border-gray-100 pt-6">
                <h3 className="font-semibold text-gray-800 mb-4">
                  难度分布
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    题库共 {questionCount} 道题
                  </span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(difficultyLabels).map(([key, label]) => (
                    <div key={key} className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">{label}</p>
                      <input
                        type="number"
                        value={Math.round(difficultyRatio[key as keyof typeof difficultyRatio] * 100)}
                        onChange={(e) => {
                          const val = Number(e.target.value) / 100;
                          setDifficultyRatio(prev => ({ ...prev, [key]: val }));
                        }}
                        min={0}
                        max={100}
                        className="w-20 text-center text-xl font-bold text-primary-600 bg-transparent border-b-2 border-gray-300 focus:border-primary-500 outline-none"
                      />
                      <span className="text-gray-400">%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="font-semibold text-gray-800 mb-4">题型数量</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {Object.entries(typeLabels).map(([key, label]) => (
                    <div key={key} className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">{label}</p>
                      <input
                        type="number"
                        value={typeCount[key as keyof typeof typeCount]}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          setTypeCount(prev => ({ ...prev, [key]: val }));
                        }}
                        min={0}
                        className="w-16 text-center text-lg font-bold text-primary-600 bg-transparent border-b-2 border-gray-300 focus:border-primary-500 outline-none"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  总计：{totalTypeCount} 道题
                </p>
              </div>

              {knowledgePoints.length > 0 && (
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="font-semibold text-gray-800 mb-4">知识点范围</h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {knowledgePoints.map(kp => (
                      <button
                        key={kp.id}
                        onClick={() => setSelectedKps(prev =>
                          prev.includes(kp.id)
                            ? prev.filter(id => id !== kp.id)
                            : [...prev, kp.id]
                        )}
                        className={`px-3 py-1 text-sm rounded-full transition-colors ${
                          selectedKps.includes(kp.id)
                            ? 'bg-primary-100 text-primary-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {kp.name}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      知识点覆盖率目标: {knowledgeCoverage}%
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={knowledgeCoverage}
                      onChange={(e) => setKnowledgeCoverage(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">总题数</h3>
                    <p className="text-sm text-gray-500">根据题型设置自动计算</p>
                  </div>
                  <div className="text-3xl font-bold text-primary-600">
                    {totalTypeCount}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleGeneratePreview}
                  disabled={generating || !selectedSubject}
                  className="px-8 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? '组卷中...' : '智能组卷 →'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 2 && previewResult && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-3xl font-bold text-primary-600">{previewResult.questions.length}</p>
              <p className="text-sm text-gray-500 mt-1">总题数</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">{previewResult.totalScore}</p>
              <p className="text-sm text-gray-500 mt-1">总分</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">{previewResult.knowledgeCoverage}%</p>
              <p className="text-sm text-gray-500 mt-1">知识点覆盖率</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-3xl font-bold text-orange-600">{previewResult.warnings.length}</p>
              <p className="text-sm text-gray-500 mt-1">警告信息</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-800 mb-3">难度分布</h3>
            <div className="flex gap-4">
              {Object.entries(difficultyLabels).map(([key, label]) => (
                <div key={key} className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium">{previewResult.difficultyStats[key] || 0}题</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${previewResult.questions.length > 0
                          ? ((previewResult.difficultyStats[key] || 0) / previewResult.questions.length) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-800 mb-3">题型分布</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(typeLabels).map(([key, label]) => (
                previewResult.typeStats[key] ? (
                  <span key={key} className="px-4 py-2 bg-gray-100 rounded-lg">
                    {label}: <span className="font-semibold">{previewResult.typeStats[key]}</span>
                  </span>
                ) : null
              ))}
            </div>
          </div>

          {previewResult.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">⚠️ 组卷警告</h4>
              <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                {previewResult.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-gray-800 mb-3">题目预览</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {previewResult.questions.map((eq, index) => (
                <div key={eq.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-500 font-mono text-sm">{index + 1}.</span>
                    <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                      {typeLabels[eq.questionSnapshot.type]}
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                      {difficultyLabels[eq.questionSnapshot.difficulty]}
                    </span>
                    <span className="text-xs text-gray-400">{eq.score}分</span>
                    {eq.isRequired && (
                      <span className="text-xs text-red-500">*必考</span>
                    )}
                  </div>
                  <p className="text-gray-700 text-sm line-clamp-2">{eq.questionSnapshot.content}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← 返回修改
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              下一步 →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">确认创建考试</h3>
            <p className="text-gray-500">确认无误后即可创建考试</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">考试名称</span>
              <span className="font-medium text-gray-800">{examName || '未设置'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">科目</span>
              <span className="font-medium text-gray-800">
                {subjects.find(s => s.id === selectedSubject)?.name || '未选择'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">考试时长</span>
              <span className="font-medium text-gray-800">{duration} 分钟</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">及格分数</span>
              <span className="font-medium text-gray-800">{passScore} 分</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">题目数量</span>
              <span className="font-medium text-gray-800">{previewResult?.questions.length || 0} 题</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">总分</span>
              <span className="font-medium text-gray-800">{previewResult?.totalScore || 0} 分</span>
            </div>
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← 返回预览
            </button>
            <button
              onClick={handleCreateExam}
              disabled={creating}
              className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {creating ? '创建中...' : '确认创建'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamCreate;
