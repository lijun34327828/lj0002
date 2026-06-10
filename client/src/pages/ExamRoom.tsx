import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  startExam, saveAnswer, saveAnswersBatch,
  submitExam, recordAntiCheat, updateDuration
} from '../services/examApi';
import useExamStore from '../stores/useExamStore';
import type { ExamQuestion } from '../types';

const ExamRoom = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const {
    attempt, questions, answers, currentIndex,
    remainingTime, isSubmitting, screenSwitchCount,
    hasUnsaved,
    initExam, setAnswer, setCurrentIndex, setFullscreen,
    incrementScreenSwitch, decrementTime, setSubmitting,
    setUnsaved, saveToCache, clearCache, resetExam
  } = useExamStore();

  const [loading, setLoading] = useState(true);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const timerRef = useRef<number | null>(null);
  const autoSaveRef = useRef<number | null>(null);

  const currentQuestion: ExamQuestion | undefined = questions[currentIndex];
  const answeredCount = Object.keys(answers).filter(k => answers[k] && answers[k].trim() !== '').length;

  useEffect(() => {
    if (id) {
      loadExam();
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [id]);

  const loadExam = async () => {
    try {
      setLoading(true);
      const result = await startExam(id!);
      
      const exam = result.questions[0]?.questionSnapshot;
      const duration = result.attempt.durationUsed 
        ? Math.max(0, 60 - Math.floor(result.attempt.durationUsed / 60))
        : 60;
      
      initExam(result.attempt, result.questions, duration);
      
      requestFullscreen();
      startTimer();
      startAutoSave();
      
      setupAntiCheating();
      
    } catch (err: any) {
      alert(err.response?.data?.error || '加载考试失败');
      navigate('/exams');
    } finally {
      setLoading(false);
    }
  };

  const requestFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    }
    setFullscreen(true);
  };

  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    setFullscreen(false);
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = window.setInterval(() => {
      const shouldSubmit = decrementTime();
      
      if (shouldSubmit) {
        handleAutoSubmit();
      }
    }, 1000);
  };

  const startAutoSave = () => {
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    
    autoSaveRef.current = window.setInterval(() => {
      if (hasUnsaved && attempt) {
        syncAnswersToServer();
      }
      saveToCache();
    }, 30000);
  };

  const setupAntiCheating = () => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        incrementScreenSwitch();
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 2000);
        
        if (attempt) {
          recordAntiCheat(attempt.id, 'screen_switch').catch(() => {});
        }
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && attempt?.status === 'in_progress') {
        incrementScreenSwitch();
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && (e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V' || e.key === 's' || e.key === 'S')) ||
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i'))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  };

  const syncAnswersToServer = useCallback(async () => {
    if (!attempt || questions.length === 0) return;
    
    try {
      const answersArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer
      }));
      
      if (answersArray.length > 0) {
        await saveAnswersBatch(attempt.id, answersArray);
        setNetworkError(false);
        setUnsaved(false);
      }
    } catch (err) {
      setNetworkError(true);
    }
  }, [attempt, answers, setUnsaved]);

  const handleAnswerChange = (answer: string) => {
    if (!currentQuestion) return;
    setAnswer(currentQuestion.questionId, answer);
  };

  const handleSingleChoice = (optionLabel: string) => {
    handleAnswerChange(optionLabel);
  };

  const handleMultipleChoice = (optionLabel: string) => {
    if (!currentQuestion) return;
    
    const current = answers[currentQuestion.questionId] || '';
    const selected = current ? current.split(',') : [];
    const index = selected.indexOf(optionLabel);
    
    if (index > -1) {
      selected.splice(index, 1);
    } else {
      selected.push(optionLabel);
      selected.sort();
    }
    
    handleAnswerChange(selected.join(','));
  };

  const handleTrueFalse = (value: string) => {
    handleAnswerChange(value);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleAutoSubmit = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    
    if (!attempt) return;
    
    try {
      setSubmitting(true);
      await syncAnswersToServer();
      const result = await submitExam(attempt.id);
      
      exitFullscreen();
      clearCache(attempt.id);
      resetExam();
      
      navigate(`/result/${result.attempt.id}`);
    } catch (err: any) {
      alert(err.response?.data?.error || '提交失败');
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setShowConfirmSubmit(false);
    
    if (!attempt) return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    
    try {
      setSubmitting(true);
      await syncAnswersToServer();
      const result = await submitExam(attempt.id);
      
      exitFullscreen();
      clearCache(attempt.id);
      resetExam();
      
      navigate(`/result/${result.attempt.id}`);
    } catch (err: any) {
      alert(err.response?.data?.error || '提交失败');
      setSubmitting(false);
      startTimer();
      startAutoSave();
    }
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isOptionSelected = (optionLabel: string): boolean => {
    if (!currentQuestion) return false;
    const answer = answers[currentQuestion.questionId];
    
    if (currentQuestion.questionSnapshot.type === 'single_choice' || 
        currentQuestion.questionSnapshot.type === 'true_false') {
      return answer === optionLabel;
    }
    
    if (currentQuestion.questionSnapshot.type === 'multiple_choice') {
      return answer ? answer.split(',').includes(optionLabel) : false;
    }
    
    return false;
  };

  const isQuestionAnswered = (index: number): boolean => {
    const q = questions[index];
    return !!(q && answers[q.questionId] && answers[q.questionId].trim() !== '');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📝</div>
          <p>正在加载考试...</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <p>无题目数据</p>
      </div>
    );
  }

  const isTimeWarning = remainingTime < 300;
  const isTimeCritical = remainingTime < 60;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold text-gray-800">📝 在线考试</h1>
          {screenSwitchCount > 0 && (
            <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
              切屏 {screenSwitchCount} 次
            </span>
          )}
          {networkError && (
            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded animate-pulse">
              网络异常，答案已本地缓存
            </span>
          )}
        </div>
        
        <div className={`text-xl font-mono font-bold ${
          isTimeCritical ? 'text-red-600 animate-pulse-warning' :
          isTimeWarning ? 'text-orange-500' : 'text-gray-800'
        }`}>
          ⏱️ {formatTime(remainingTime)}
        </div>
        
        <button
          onClick={() => setShowConfirmSubmit(true)}
          disabled={isSubmitting}
          className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          交卷
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">
              答题进度: {answeredCount} / {questions.length}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all"
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-5 gap-2">
            {questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`aspect-square rounded-lg text-sm font-medium transition-colors ${
                  currentIndex === index
                    ? 'bg-primary-600 text-white'
                    : isQuestionAnswered(index)
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span className="w-4 h-4 bg-green-100 rounded"></span>
              <span>已答</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span className="w-4 h-4 bg-gray-100 rounded"></span>
              <span>未答</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-4 h-4 bg-primary-600 rounded"></span>
              <span>当前</span>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-primary-50 text-primary-600 text-sm rounded-full">
                    第 {currentIndex + 1} 题 / 共 {questions.length} 题
                  </span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                    {currentQuestion.score} 分
                  </span>
                </div>
                {currentQuestion.isRequired && (
                  <span className="text-xs text-red-500">*必考题</span>
                )}
              </div>
              
              <div className="prose max-w-none mb-6">
                <p className="text-lg text-gray-800 whitespace-pre-wrap">
                  {currentQuestion.questionSnapshot.content}
                </p>
              </div>

              {(currentQuestion.questionSnapshot.type === 'single_choice' ||
                currentQuestion.questionSnapshot.type === 'multiple_choice') && (
                <div className="space-y-3">
                  {currentQuestion.questionSnapshot.options?.map((option) => (
                    <button
                      key={option.label}
                      onClick={() => {
                        if (currentQuestion.questionSnapshot.type === 'single_choice') {
                          handleSingleChoice(option.label);
                        } else {
                          handleMultipleChoice(option.label);
                        }
                      }}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        isOptionSelected(option.label)
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                          isOptionSelected(option.label)
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {option.label}
                        </span>
                        <span className="text-gray-700 pt-1">{option.content}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.questionSnapshot.type === 'true_false' && (
                <div className="flex gap-4">
                  <button
                    onClick={() => handleTrueFalse('true')}
                    className={`flex-1 p-6 rounded-lg border-2 transition-all ${
                      isOptionSelected('true')
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-2">✓</div>
                      <span className={isOptionSelected('true') ? 'text-green-600 font-medium' : 'text-gray-600'}>
                        正确
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleTrueFalse('false')}
                    className={`flex-1 p-6 rounded-lg border-2 transition-all ${
                      isOptionSelected('false')
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-2">✗</div>
                      <span className={isOptionSelected('false') ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        错误
                      </span>
                    </div>
                  </button>
                </div>
              )}

              {currentQuestion.questionSnapshot.type === 'fill_blank' && (
                <input
                  type="text"
                  value={answers[currentQuestion.questionId] || ''}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  placeholder="请输入答案..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                />
              )}

              {(currentQuestion.questionSnapshot.type === 'short_answer' ||
                currentQuestion.questionSnapshot.type === 'essay') && (
                <textarea
                  value={answers[currentQuestion.questionId] || ''}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  placeholder="请输入您的答案..."
                  rows={8}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all resize-none"
                />
              )}

              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="px-6 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← 上一题
                </button>
                
                <button
                  onClick={syncAnswersToServer}
                  className="px-4 py-2 text-sm text-primary-600 hover:text-primary-700"
                >
                  {hasUnsaved ? '保存答案' : '已保存'}
                </button>
                
                {currentIndex < questions.length - 1 ? (
                  <button
                    onClick={handleNext}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    下一题 →
                  </button>
                ) : (
                  <button
                    onClick={() => setShowConfirmSubmit(true)}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    交卷
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {showWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-red-500 text-white px-8 py-4 rounded-lg text-xl font-bold animate-bounce">
            ⚠️ 检测到切屏！请勿离开考试页面
          </div>
        </div>
      )}

      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">确认交卷</h3>
            <p className="text-gray-600 mb-2">
              您已完成 <span className="font-semibold text-primary-600">{answeredCount}</span> / {questions.length} 道题目
            </p>
            {answeredCount < questions.length && (
              <p className="text-orange-500 text-sm mb-4">
                ⚠️ 还有 {questions.length - answeredCount} 道题未作答
              </p>
            )}
            <p className="text-gray-500 text-sm mb-6">
              交卷后将无法修改答案，确定要提交吗？
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                继续答题
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? '提交中...' : '确认交卷'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSubmitting && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="text-center text-white">
            <div className="text-5xl mb-4 animate-spin">⏳</div>
            <p className="text-xl">正在提交试卷...</p>
            <p className="text-sm text-gray-300 mt-2">请勿关闭页面</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamRoom;
