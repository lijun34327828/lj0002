import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExams } from '../services/examApi';
import useAuthStore from '../stores/useAuthStore';
import type { Exam } from '../types';

const ExamList = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [exams, setExams] = useState<Exam[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  useEffect(() => {
    loadExams();
  }, [status, keyword, page]);

  const loadExams = async () => {
    try {
      setLoading(true);
      const result = await getExams({
        status: status || undefined,
        keyword: keyword || undefined,
        page,
        pageSize
      });
      setExams(result.list);
      setTotal(result.total);
    } catch (err) {
      console.error('加载考试列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusLabels: Record<string, string> = {
    draft: '草稿',
    published: '已发布',
    ongoing: '进行中',
    finished: '已结束',
    archived: '已归档'
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    published: 'bg-green-100 text-green-600',
    ongoing: 'bg-blue-100 text-blue-600',
    finished: 'bg-gray-100 text-gray-600',
    archived: 'bg-gray-100 text-gray-400'
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">📝 考试中心</h1>
        {(user?.role === 'admin' || user?.role === 'teacher') && (
          <button
            onClick={() => navigate('/exams/create')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            + 创建考试
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
              placeholder="搜索考试名称..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          >
            <option value="">全部状态</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : exams.length === 0 ? (
          <div className="p-8 text-center text-gray-400">暂无考试</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="p-5 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/exams/${exam.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-800 text-lg">{exam.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[exam.status] || ''}`}>
                        {statusLabels[exam.status] || exam.status}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm mb-3 line-clamp-2">{exam.description || '暂无描述'}</p>
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <span>⏱️ {exam.duration} 分钟</span>
                      <span>📊 满分 {exam.totalScore} 分</span>
                      <span>✅ 及格 {exam.passScore} 分</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/exams/${exam.id}`);
                    }}
                    className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    详情
                  </button>
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
    </div>
  );
};

export default ExamList;
