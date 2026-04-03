'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';
import type { Step3Data } from '@/types/strategy';
import { BSCBoard, type CapsuleData } from './bsc/BSCBoard';
import { SimpleAIAssistant } from './bsc/SimpleAIAssistant';

export default function Step4Execution() {
  const { data, setData, setStep } = useStore();
  const [isReady, setIsReady] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Initialize step 4 data if needed
    if (!data.step4) {
      setData('step4', {
        bscCards: [],
        bscConfirmed: false,
        actionPlanTable: [],
        strategyMap: null,
      });
    }
    setIsReady(true);
  }, [data.step4, setData]);

  // Load data from Step 1-3 to initialize BSC lanes
  const getInitialLanesFromStep3 = (): CapsuleData[] => {
    const step1 = data.step1;
    const step2 = data.step2;
    const step3 = data.step3 as Step3Data;

    const capsules: CapsuleData[] = [];

    // 财务层面：从 Step 3 的 calculatedTargets 初始化
    if (step3?.calculatedTargets) {
      const { base, standard, challenge } = step3.calculatedTargets;

      // 保底目标 → 财务层面
      if (base && base > 0) {
        capsules.push({
          id: `cap_financial_base_${Date.now()}`,
          text: `保底: ${base}`,
          x: 20 + Math.random() * 200,
          y: 20 + Math.random() * 40,
          shape: 'capsule',
          fillColor: 'hsl(0, 84%, 95%)',
          borderColor: 'hsl(0, 70%, 80%)'
        });
      }

      // 达标目标 → 财务层面
      if (standard && standard > 0) {
        capsules.push({
          id: `cap_financial_standard_${Date.now()}`,
          text: `达标: ${standard}`,
          x: 20 + Math.random() * 200,
          y: 20 + Math.random() * 40,
          shape: 'capsule',
          fillColor: 'hsl(0, 84%, 95%)',
          borderColor: 'hsl(0, 70%, 80%)'
        });
      }

      // 挑战目标 → 财务层面
      if (challenge && challenge > 0) {
        capsules.push({
          id: `cap_financial_challenge_${Date.now()}`,
          text: `挑战: ${challenge}`,
          x: 20 + Math.random() * 200,
          y: 20 + Math.random() * 40,
          shape: 'capsule',
          fillColor: 'hsl(0, 84%, 95%)',
          borderColor: 'hsl(0, 70%, 80%)'
        });
      }
    }

    // 客户层面：从 step2.companyInfo 初始化
    if (step2?.companyInfo) {
      const companyName = typeof step2.companyInfo === 'string' ? step2.companyInfo : (step2.companyInfo as any)?.name || '公司';
      capsules.push({
        id: `cap_customer_company_${Date.now()}`,
        text: `公司: ${companyName}`,
        x: 20 + Math.random() * 300,
        y: 20 + Math.random() * 40,
        shape: 'capsule',
        fillColor: 'hsl(217, 80%, 97%)',
        borderColor: 'hsl(215, 60%, 75%)'
      });
    }

    // 内部流程和学习成长：从 step1.dimensions 初始化
    if (step1?.dimensions && step1.dimensions.length > 0) {
      step1.dimensions.forEach((dim, index) => {
        const layerType = index < 3 ? 'process' : 'learning'; // 前3个是流程，后1个是学习
        capsules.push({
          id: `cap_${layerType}_${dim.id}_${Date.now()}`,
          text: dim.name,
          x: 20 + Math.random() * 300,
          y: 20 + Math.random() * 40,
          shape: 'capsule',
          fillColor: layerType === 'process'
            ? 'hsl(142, 70%, 95%)'
            : 'hsl(270, 80%, 97%)',
          borderColor: layerType === 'process'
            ? 'hsl(142, 60%, 75%)'
            : 'hsl(270, 60%, 80%)'
        });
      });
    }

    return capsules;
  };

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900">
        <div className="text-gray-500 dark:text-slate-400">加载中...</div>
      </div>
    );
  }

  const handleBack = async () => {
    setStep(3);
  };

  const handleNext = async () => {
    setStep('report');
  };

  const handleSave = async () => {
    // Save will be triggered by BSCBoard's onSave callback
    // For now, just mark as saved
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Prepare BSC data for AI assistant
  const initialCapsules = getInitialLanesFromStep3();
  const bscData = {
    financial: initialCapsules.filter(c => c.id.includes('financial')),
    customer: initialCapsules.filter(c => c.id.includes('customer')),
    process: initialCapsules.filter(c => c.id.includes('process')),
    learning: initialCapsules.filter(c => c.id.includes('learning')),
    connections: []
  };

  return (
    <div className="w-full min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            上一步
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Step 4: BSC 平衡计分卡
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              saved
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-primary-500 hover:bg-primary-600 text-white'
            }`}
          >
            <Save className="w-4 h-4" />
            {saved ? '已保存' : '保存数据'}
          </button>

          <button
            onClick={handleNext}
            className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg flex items-center gap-2"
          >
            下一步
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* BSC Board - Takes full screen */}
      <div className="h-screen pt-20">
        <BSCBoard
          initialCapsules={getInitialLanesFromStep3()}
          step3Data={data.step3 as Step3Data}
          onSave={async (lanes, connections) => {
            // Save BSC data to step4
            await setData('step4', {
              bscCards: lanes.flatMap(lane => lane.capsules),
              bscConfirmed: true,
              actionPlanTable: [],
              strategyMap: { lanes, connections }
            });
            setSaved(true);
          }}
        />
      </div>

      {/* AI Assistant */}
      <SimpleAIAssistant
        financial={bscData.financial}
        customer={bscData.customer}
        process={bscData.process}
        learning={bscData.learning}
        connections={bscData.connections}
      />
    </div>
  );
}
