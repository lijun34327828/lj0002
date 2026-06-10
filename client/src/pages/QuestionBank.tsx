import { useEffect, useState } from 'react';
import {
  getQuestions, getSubjects, getKnowledgePoints,
  downloadTemplate, previewImport, importQuestions
} from '../services/questionApi';
import useAuthStore from '../stores/useAuthStore';
import type { Question, Subject, KnowledgePoint, QuestionType, DifficultyLevel } from '../types';

const QuestionBank = () => {
  const { user } = useAuthStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedType, setSelectedType] = useState<QuestionType | ''>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | ''>('');
  const [selectedKnowledgePoints, setSelectedKnowledgePoints] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      loadKnowledgePoints(selectedSubject);
    } else {
      setKnowledgePoints([]);
    }
  }, [selectedSubject]);

  useEffect(() => {
    loadQuestions();
  }, [selectedSubject, selectedType, selectedDifficulty, selectedKnowledgePoints, keyword, page]);

  const loadSubjects = async () => {
    try {
      const data = await getSubjects();
      setSubjects(data);
    } catch (err) {
      console.error('加载科目失败:', err);
    }
  };

  const loadKnowledgePoints = async (subjectId: string) => {
    try {
      const data = await getKnowledgePoints(subjectId);
      setKnowledgePoints(data);
    } catch (err) {
      console.error('加载知识点失败:', err);
    }
  };

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const result = await getQuestions({
        subjectId: selectedSubject || undefined,
        type: selectedType || undefined,
        difficulty: selectedDifficulty || undefined,
        knowledgePointIds: selectedKnowledgePoints.length > 0 ? selectedKnowledgePoints : undefined,
        keyword: keyword || undefined,
        page,
        pageSize
      });
      setQuestions(result.list);
      setTotal(result.total);
    } catch (err) {
      console.error('加载题目失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKnowledgePointToggle = (kpId: string) => {
    setSelectedKnowledgePoints(prev => 
      prev.includes(kpId) 
        ? prev.filter(id => id !== kpId)
        : [...prev, kpId]
    );
    setPage(1);
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'question_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('下载模板失败:', err);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportFile(file);
    
    try {
      const preview = await previewImport(file);
      setImportPreview(preview);
    } catch (err) {
      console.error('预览导入失败:', err);
    }
  };

  const handleImport = async () => {
    if (!importFile || !selectedSubject) return;
    
    try {
      setImporting(true);
      await importQuestions(importFile, selectedSubject);
      setShowImportModal(false);
      setImportFile(null);
      setImportPreview(null);
      loadQuestions();
    } catch (err: any) {
      alert(err.response?.data?.error || '导入失败');
    } finally {
      setImporting(false);
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

  const difficultyColors: Record<string, string> = {
    easy: 'bg-green-100 text-green-600',
    medium: 'bg-blue-100 text-blue-600',
    hard: 'bg-orange-100 text-orange-600',
    expert: 'bg-red-100 text-red-600'
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">📚 题库管理</h1>
        {(user?.role === 'admin' || user?.role === 'teacher') && (
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            批量导入
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">科目</label>
            <select
              value={selectedSubject}
              onChange={(e) => { setSelectedSubject(e.target.value); setSelectedKnowledgePoints([]); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="">全部科目</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">题型</label>
            <select
              value={selectedType}
              onChange={(e) => { setSelectedType(e.target.value as QuestionType | ''); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="">全部题型</option>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">难度</label>
            <select
              value={selectedDifficulty}
              onChange={(e) => { setSelectedDifficulty(e.target.value as DifficultyLevel | ''); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="">全部难度</option>
              {Object.entries(difficultyLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
              placeholder="搜索题目内容..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {knowledgePoints.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">知识点筛选</label>
            <div className="flex flex-wrap gap-2">
              {knowledgePoints.map(kp => (
                <button
                  key={kp.id}
                  onClick={() => handleKnowledgePointToggle(kp.id)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    selectedKnowledgePoints.includes(kp.id)
                      ? 'bg-primary-100 text-primary-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {kp.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">题目列表</h2>
          <span className="text-sm text-gray-500">共 {total} 道题</span>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : questions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">暂无题目</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {questions.map((q, index) => (
              <div key={q.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <span className="text-gray-400 font-mono text-sm w-8">
                    {(page - 1) * pageSize + index + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                        {typeLabels[q.type] || q.type}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded ${difficultyColors[q.difficulty] || 'bg-gray-100 text-gray-600'}`}>
                        {difficultyLabels[q.difficulty] || q.difficulty}
                      </span>
                      <span className="text-xs text-gray-400">{q.score}分</span>
                    </div>
                    <p className="text-gray-800 line-clamp-2">{q.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-5 border-t border-gray-100 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <span className="text-sm text-gray-600">
              第 {page} / {totalPages} 页
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">批量导入题目</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <button
                  onClick={handleDownloadTemplate}
                  className="text-primary-600 hover:text-primary-700 text-sm"
                >
                  📥 下载导入模板
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择科目</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">上传文件</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              {importPreview && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <p className="font-medium text-gray-700">导入预览：</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>总题数: <span className="font-medium">{importPreview.total}</span></div>
                    <div>有效题数: <span className="text-green-600 font-medium">{importPreview.valid}</span></div>
                    <div>无效题数: <span className="text-red-600 font-medium">{importPreview.invalid}</span></div>
                    <div>库内重复: <span className="text-orange-600 font-medium">{importPreview.dbDuplicates}</span></div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={!importFile || !selectedSubject || importing}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? '导入中...' : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBank;
