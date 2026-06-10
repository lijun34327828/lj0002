import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../stores/useAuthStore';

const Layout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: '首页', icon: '🏠' },
    { path: '/exams', label: '考试中心', icon: '📝' },
    { path: '/questions', label: '题库管理', icon: '📚' },
    { path: '/wrong-questions', label: '错题本', icon: '❌' },
    { path: '/profile', label: '个人中心', icon: '👤' }
  ];

  const teacherNavItems = [
    { path: '/exams/create', label: '创建考试', icon: '➕' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-primary-600">📋 在线考试平台</h1>
          <p className="text-sm text-gray-500 mt-1">智能组卷 · 安全防作弊</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                location.pathname === item.path
                  ? 'bg-primary-50 text-primary-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          
          {(user?.role === 'admin' || user?.role === 'teacher') && (
            <>
              <div className="pt-2 pb-1 px-4 text-xs font-medium text-gray-400 uppercase">
                教师功能
              </div>
              {teacherNavItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                    location.pathname === item.path
                      ? 'bg-primary-50 text-primary-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </>
          )}
        </nav>
        
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-600 font-medium">
                {user?.realName?.charAt(0) || user?.username?.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {user?.realName || user?.username}
              </p>
              <p className="text-xs text-gray-500">
                {user?.role === 'admin' ? '管理员' : user?.role === 'teacher' ? '教师' : '学生'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            退出登录
          </button>
        </div>
      </aside>
      
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
