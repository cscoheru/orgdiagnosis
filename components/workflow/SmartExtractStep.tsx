'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import IndustryDropdown from './IndustryDropdown';
import PainPointList from './PainPointList';
import DynamicListInput from './DynamicListInput';
import { createEmptyPainPoint, type EnhancedSmartExtractData, validateStep1 } from '@/lib/workflow/w1-types';

export interface SmartExtractStepRef {
  populate: (data: EnhancedSmartExtractData) => void;
}

interface SmartExtractStepProps {
  onExtract: (text: string) => void;
  onConfirm: (data: EnhancedSmartExtractData) => void;
  loading: boolean;
  initialData?: EnhancedSmartExtractData | null;
  onNext?: () => void;
}

const DEFAULT_DATA: EnhancedSmartExtractData = {
  client_name: '',
  industry: '',
  company_scale: '',
  industry_background: '',
  company_info: '',
  core_pain_points: [createEmptyPainPoint()],
  expected_goals: [''],
  success_criteria: [],
  other_requirements: '',
};

const SmartExtractStep = forwardRef<SmartExtractStepRef, SmartExtractStepProps>(function SmartExtractStep({
  onExtract,
  onConfirm,
  loading,
  initialData,
  onNext,
}, ref) {
  const [rawText, setRawText] = useState('');
  const [showTextInput, setShowTextInput] = useState(true);
  const [data, setData] = useState<EnhancedSmartExtractData>(initialData || DEFAULT_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useImperativeHandle(ref, () => ({
    populate(aiData: EnhancedSmartExtractData) {
      setData(aiData);
      setShowTextInput(false);
      setErrors({});
    },
  }));

  const handleExtract = () => {
    if (rawText.trim().length >= 10) {
      onExtract(rawText);
    }
  };

  const handleConfirm = () => {
    const validationErrors = validateStep1(data);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onConfirm(data);
    onNext?.();
  };

  const updateField = (field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Text Input Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">AI 智能提取</h2>
          <button
            type="button"
            onClick={() => setShowTextInput(!showTextInput)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {showTextInput ? '收起 ▲' : '展开 ▼'}
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          粘贴客户提供的文本（需求描述、会议纪要、邮件等），AI 将自动提取结构化需求信息。
        </p>
        {showTextInput && (
          <>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full h-48 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm leading-relaxed"
              placeholder="请粘贴客户原始文本...&#10;&#10;支持粘贴大段文本，AI 将自动解析其中的客户信息、行业背景、挑战痛点和期望目标。"
            />
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-gray-400">
                {rawText.length > 0 ? `${rawText.length} 字` : '至少输入 10 字'}
              </span>
              <button
                onClick={handleExtract}
                disabled={loading || rawText.trim().length < 10}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    提取中...
                  </>
                ) : (
                  'AI 智能提取'
                )}
              </button>
            </div>
          </>
        )}
        {rawText.length > 0 && !showTextInput && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex items-center justify-between">
            <span>已输入 {rawText.length} 字，可重新提取</span>
            <button onClick={() => setShowTextInput(true)} className="underline">
              展开编辑
            </button>
          </div>
        )}
      </div>

      {/* Basic Info Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h3 className="text-sm font-medium text-gray-800 border-b border-gray-100 pb-2">基本信息</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              客户名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.client_name}
              onChange={(e) => updateField('client_name', e.target.value)}
              placeholder="如: XX科技有限公司"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.client_name ? 'border-red-300' : 'border-gray-200'}`}
            />
            {errors.client_name && <p className="text-xs text-red-500 mt-1">{errors.client_name}</p>}
          </div>
          <IndustryDropdown
            value={data.industry}
            onChange={(v) => updateField('industry', v)}
            error={errors.industry}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">公司规模</label>
            <input
              type="text"
              value={data.company_scale || ''}
              onChange={(e) => updateField('company_scale', e.target.value)}
              placeholder="如: 200人、年营收5000万"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            行业背景 <span className="text-red-500">*</span>
            <span className="text-xs text-gray-400 ml-2">
              {data.industry_background.trim().length}/50 字
            </span>
          </label>
          <textarea
            value={data.industry_background}
            onChange={(e) => updateField('industry_background', e.target.value)}
            placeholder="描述行业趋势、竞争格局、机遇与挑战（至少 50 字）"
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${errors.industry_background ? 'border-red-300' : 'border-gray-200'}`}
            rows={3}
          />
          {errors.industry_background && <p className="text-xs text-red-500 mt-1">{errors.industry_background}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            公司介绍 <span className="text-red-500">*</span>
            <span className="text-xs text-gray-400 ml-2">
              {data.company_info.trim().length}/50 字
            </span>
          </label>
          <textarea
            value={data.company_info}
            onChange={(e) => updateField('company_info', e.target.value)}
            placeholder="描述主营业务、发展历程、组织架构等（至少 50 字）"
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${errors.company_info ? 'border-red-300' : 'border-gray-200'}`}
            rows={3}
          />
          {errors.company_info && <p className="text-xs text-red-500 mt-1">{errors.company_info}</p>}
        </div>
      </div>

      {/* Core Needs Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h3 className="text-sm font-medium text-gray-800 border-b border-gray-100 pb-2">核心需求</h3>

        <PainPointList
          items={data.core_pain_points}
          onItemsChange={(items) => {
            setData(prev => ({ ...prev, core_pain_points: items }));
            if (errors.core_pain_points) {
              setErrors(prev => {
                const next = { ...prev };
                delete next.core_pain_points;
                return next;
              });
            }
          }}
          errors={errors}
        />

        <DynamicListInput
          items={data.expected_goals}
          onItemsChange={(items) => {
            setData(prev => ({ ...prev, expected_goals: items }));
            if (errors.expected_goals) {
              setErrors(prev => {
                const next = { ...prev };
                delete next.expected_goals;
                return next;
              });
            }
          }}
          label="项目目标"
          placeholder="输入项目期望目标后按回车"
          addButtonLabel="添加目标"
          required
          minItems={1}
        />

        <DynamicListInput
          items={data.success_criteria}
          onItemsChange={(items) => setData(prev => ({ ...prev, success_criteria: items }))}
          label="成功标准/验收标准"
          placeholder="输入成功标准后按回车"
          addButtonLabel="添加标准"
        />
      </div>

      {/* Other Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-sm font-medium text-gray-800 border-b border-gray-100 pb-2">其他</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">其他要求</label>
          <textarea
            value={data.other_requirements || ''}
            onChange={(e) => setData(prev => ({ ...prev, other_requirements: e.target.value }))}
            placeholder="其他特殊要求或备注..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center">
        <button
          onClick={handleExtract}
          disabled={loading || rawText.trim().length < 10}
          className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
        >
          {loading ? '提取中...' : 'AI 智能填充'}
        </button>
        <button
          onClick={handleConfirm}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
        >
          下一步
          <span>→</span>
        </button>
      </div>
    </div>
  );
});

export default SmartExtractStep;
