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
    if (step === 'report') {
      setCurrentStep(4);
      onStepChange?.(4);
    } else {
      const num = typeof step === 'number' ? step : 0;
      setCurrentStep(num);
      onStepChange?.(num);
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
