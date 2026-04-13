'use client';

/**
 * StrategyStoreAdapter — 替代 strategydecoding 的 Zustand store。
 *
 * 将数据持久化到 org-diagnosis 的 workflow engine，而非 localStorage/Supabase。
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type {
  StrategicData,
  Step1Data,
  Step2Data,
  Step3Data,
  Step4Data,
  CompanyInfo,
} from '@/types/strategy';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface StrategyStore {
  data: StrategicData;
  companyInfo: CompanyInfo;
  modelConfig: { apiKey: string; model: string };
  currentStep: number;
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
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: '', industry: '' });
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [modelConfig] = useState({ apiKey: '', model: 'glm-4-flash' });

  const setData = useCallback(async (step: keyof StrategicData, value: any) => {
    setDataState(prev => ({ ...prev, [step]: value }));
  }, []);

  const setStep = useCallback((step: number | string) => {
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
  }, [onStepChange]);

  const saveAll = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/v2/workflow/${sessionId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_data: data,
          company_info: companyInfo,
        }),
      });
    } catch (e) {
      console.error('Failed to save strategy data:', e);
    }
  }, [sessionId, data, companyInfo]);

  return (
    <StrategyStoreContext.Provider value={{ data, companyInfo, modelConfig, currentStep, setData, setCompanyInfo, setStep, saveAll }}>
      {children}
    </StrategyStoreContext.Provider>
  );
}
