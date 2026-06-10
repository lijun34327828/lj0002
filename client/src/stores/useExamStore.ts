import { create } from 'zustand';
import type { ExamQuestion, ExamAttempt } from '../types';

const STORAGE_KEY = 'exam_answers_cache';

interface ExamState {
  attempt: ExamAttempt | null;
  questions: ExamQuestion[];
  answers: Record<string, string>;
  currentIndex: number;
  isFullscreen: boolean;
  screenSwitchCount: number;
  remainingTime: number;
  isSubmitting: boolean;
  hasUnsaved: boolean;

  initExam: (attempt: ExamAttempt, questions: ExamQuestion[], duration: number) => void;
  setAnswer: (questionId: string, answer: string) => void;
  setCurrentIndex: (index: number) => void;
  setFullscreen: (fullscreen: boolean) => void;
  incrementScreenSwitch: () => void;
  decrementTime: () => boolean;
  setSubmitting: (submitting: boolean) => void;
  setUnsaved: (unsaved: boolean) => void;
  resetExam: () => void;
  loadFromCache: (attemptId: string) => boolean;
  saveToCache: () => void;
  clearCache: (attemptId: string) => void;
}

const useExamStore = create<ExamState>((set, get) => ({
  attempt: null,
  questions: [],
  answers: {},
  currentIndex: 0,
  isFullscreen: false,
  screenSwitchCount: 0,
  remainingTime: 0,
  isSubmitting: false,
  hasUnsaved: false,

  initExam: (attempt, questions, duration) => {
    const cached = get().loadFromCache(attempt.id);
    
    set({
      attempt,
      questions,
      answers: cached ? get().answers : {},
      currentIndex: 0,
      screenSwitchCount: 0,
      remainingTime: duration * 60,
      isSubmitting: false,
      hasUnsaved: false
    });
  },

  setAnswer: (questionId, answer) => {
    set((state) => ({
      answers: { ...state.answers, [questionId]: answer },
      hasUnsaved: true
    }));
  },

  setCurrentIndex: (index) => {
    set({ currentIndex: index });
  },

  setFullscreen: (fullscreen) => {
    set({ isFullscreen: fullscreen });
  },

  incrementScreenSwitch: () => {
    set((state) => ({ screenSwitchCount: state.screenSwitchCount + 1 }));
  },

  decrementTime: () => {
    let shouldSubmit = false;
    set((state) => {
      const newTime = state.remainingTime - 1;
      if (newTime <= 0) {
        shouldSubmit = true;
        return { remainingTime: 0 };
      }
      return { remainingTime: newTime };
    });
    return shouldSubmit;
  },

  setSubmitting: (submitting) => {
    set({ isSubmitting: submitting });
  },

  setUnsaved: (unsaved) => {
    set({ hasUnsaved: unsaved });
  },

  resetExam: () => {
    set({
      attempt: null,
      questions: [],
      answers: {},
      currentIndex: 0,
      isFullscreen: false,
      screenSwitchCount: 0,
      remainingTime: 0,
      isSubmitting: false,
      hasUnsaved: false
    });
  },

  loadFromCache: (attemptId) => {
    try {
      const cached = localStorage.getItem(`${STORAGE_KEY}_${attemptId}`);
      if (cached) {
        const data = JSON.parse(cached);
        set({ answers: data.answers || {} });
        return true;
      }
    } catch (e) {
      console.error('加载缓存失败:', e);
    }
    return false;
  },

  saveToCache: () => {
    const state = get();
    if (state.attempt) {
      try {
        localStorage.setItem(
          `${STORAGE_KEY}_${state.attempt.id}`,
          JSON.stringify({
            answers: state.answers,
            timestamp: Date.now()
          })
        );
        set({ hasUnsaved: false });
      } catch (e) {
        console.error('保存缓存失败:', e);
      }
    }
  },

  clearCache: (attemptId) => {
    localStorage.removeItem(`${STORAGE_KEY}_${attemptId}`);
  }
}));

export default useExamStore;
