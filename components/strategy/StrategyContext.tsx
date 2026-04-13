'use client';

/**
 * StrategyStoreAdapter — 替代 strategydecoding 的 Zustand store。
 *
 * 将数据持久化到 org-diagnosis 的 workflow engine，而非 localStorage/Supabase。
 * setData / setStep 自动触发后端保存，确保刷新页面不丢失数据。
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
  initialData?: StrategicData;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  children: ReactNode;
}

export function StrategyStoreProvider({ sessionId, initialData, initialStep = 0, onStepChange, children }: StrategyStoreProviderProps) {
  const [data, setDataState] = useState<StrategicData>(initialData || {
    step1: {} as Step1Data,
    step2: {} as Step2Data,
  });
  const [companyInfo, setCompanyInfoState] = useState<CompanyInfo>(initialData ? { name: '', industry: '' } : { name: '', industry: '' });
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [modelConfig] = useState({ apiKey: '', model: 'glm-4-flash' });
  const [isSaving, setIsSaving] = useState(false);

  // 用 ref 跟踪最新 data，避免 saveAll 闭包拿到旧值
  const dataRef = useRef(data);
  dataRef.current = data;
  const companyInfoRef = useRef(companyInfo);
  companyInfoRef.current = companyInfo;

  // 后端持久化
  const saveAll = useCallback(async () => {
    try {
      setIsSaving(true);
      await fetch(`${API_BASE}/api/v2/workflow/${sessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_data: dataRef.current,
          company_info: companyInfoRef.current,
        }),
      });
    } catch (e) {
      console.error('Failed to save strategy data:', e);
    } finally {
      setIsSaving(false);
    }
  }, [sessionId]);

  // debounce 保存：1秒内多次 setData 只触发一次
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveAll(), 1000);
  }, [saveAll]);

  // 组件卸载时立即保存（防止丢失最后的数据）
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveAll();
    };
  }, [saveAll]);

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
    // 切换步骤前立即保存当前数据（不等 debounce）
    saveAll();

    // Step 组件用 1-based 编号 (setStep(1)=Step1, setStep(2)=Step2, ...)
    // strategy page 用 0-based 索引 (activeStep 0=Step1, 1=Step2, ...)
    // report 固定映射到 index 4
    if (step === 'report') {
      setCurrentStep(4);
      onStepChange?.(4);
    } else {
      const num = typeof step === 'number' ? step : 0;
      const index = num - 1; // 1-based → 0-based
      setCurrentStep(index);
      onStepChange?.(index);
    }
  }, [onStepChange, saveAll]);

  return (
    <StrategyStoreContext.Provider value={{ data, companyInfo, modelConfig, currentStep, isSaving, setData, setCompanyInfo, setStep, saveAll }}>
      {children}
    </StrategyStoreContext.Provider>
  );
}
