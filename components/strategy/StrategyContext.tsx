'use client';

/**
 * StrategyStoreAdapter — 替代 strategydecoding 的 Zustand store。
 *
 * 持久化策略：
 * 1. localStorage (主要) — 每次数据变更自动写入，刷新页面可靠恢复
 * 2. 后端 workflow session (辅助) — 保持 API 兼容，供其他模块查询
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type {
  StrategicData,
  Step1Data,
  Step2Data,
  CompanyInfo,
} from '@/types/strategy';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface StrategyStore {
  data: StrategicData;
  companyInfo: CompanyInfo;
  modelConfig: { apiKey: string; model: string };
  currentStep: number;
  isSaving: boolean;
  setData: (step: keyof StrategicData, value: any) => Promise<void>;
  setCompanyInfo: (info: CompanyInfo) => void;
  setStep: (step: number | string) => void;
  saveAll: () => Promise<void>;
}

const StrategyStoreContext = createContext<StrategyStore | null>(null);

export function useStrategyStore(): StrategyStore {
  const ctx = useContext(StrategyStoreContext);
  if (!ctx) throw new Error('useStrategyStore must be used within StrategyStoreProvider');
  return ctx;
}

interface StrategyStoreProviderProps {
  sessionId: string;
  projectId: string;
  initialData?: StrategicData;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  children: ReactNode;
}

// localStorage 读写工具
const LS_KEY = (projectId: string) => `strategy_data_${projectId}`;

function loadFromLS(projectId: string): StrategicData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_KEY(projectId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToLS(projectId: string, data: StrategicData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY(projectId), JSON.stringify(data));
  } catch {
    console.error('localStorage write failed');
  }
}

export function StrategyStoreProvider({ sessionId, projectId, initialData, initialStep = 0, onStepChange, children }: StrategyStoreProviderProps) {
  // 优先 localStorage，其次 initialData（后端恢复），最后空初始值
  const lsData = loadFromLS(projectId);
  const [data, setDataState] = useState<StrategicData>(lsData || initialData || {
    step1: {} as Step1Data,
    step2: {} as Step2Data,
  });
  const [companyInfo, setCompanyInfoState] = useState<CompanyInfo>({ name: '', industry: '' });
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [modelConfig] = useState({ apiKey: '', model: 'glm-4-flash' });
  const [isSaving, setIsSaving] = useState(false);

  // 用 ref 跟踪最新 data，避免 saveAll 闭包拿到旧值
  const dataRef = useRef(data);
  dataRef.current = data;
  const companyInfoRef = useRef(companyInfo);
  companyInfoRef.current = companyInfo;

  // 后端持久化（辅助，保持 API 兼容）
  const saveToBackend = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/v2/workflow/${sessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_data: dataRef.current,
          company_info: companyInfoRef.current,
        }),
      });
    } catch (e) {
      console.error('Failed to save to backend:', e);
    }
  }, [sessionId]);

  const saveAll = useCallback(async () => {
    setIsSaving(true);
    try {
      // 主要：写入 localStorage（同步，可靠）
      saveToLS(projectId, dataRef.current);
      // 辅助：写入后端（异步，可能失败）
      await saveToBackend();
    } finally {
      setIsSaving(false);
    }
  }, [projectId, saveToBackend]);

  // debounce 保存：1秒内多次 setData 只触发一次
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveAll(), 1000);
  }, [saveAll]);

  // 组件卸载时立即保存
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveToLS(projectId, dataRef.current);
    };
  }, [projectId]);

  const setData = useCallback(async (step: keyof StrategicData, value: any) => {
    setDataState(prev => ({ ...prev, [step]: value }));
    debouncedSave();
  }, [debouncedSave]);

  const setCompanyInfo = useCallback((info: CompanyInfo) => {
    setCompanyInfoState(info);
    companyInfoRef.current = info;
    debouncedSave();
  }, [debouncedSave]);

  const setStep = useCallback((step: number | string) => {
    // 切换步骤前立即保存（不等 debounce）
    saveToLS(projectId, dataRef.current);

    if (step === 'report') {
      setCurrentStep(4);
      onStepChange?.(4);
    } else {
      const num = typeof step === 'number' ? step : 0;
      const index = num - 1; // 1-based → 0-based
      setCurrentStep(index);
      onStepChange?.(index);
    }
  }, [projectId, onStepChange]);

  return (
    <StrategyStoreContext.Provider value={{ data, companyInfo, modelConfig, currentStep, isSaving, setData, setCompanyInfo, setStep, saveAll }}>
      {children}
    </StrategyStoreContext.Provider>
  );
}
