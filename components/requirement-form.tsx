'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ClientRequirement } from '@/lib/report-api';

interface PhaseItem {
  phase_id: string;
  phase_name: string;
  duration_weeks: number;
  key_activities: string[];
  deliverables: string[];
}

interface RequirementFormProps {
  onSubmit: (requirement: ClientRequirement) => void;
  isLoading?: boolean;
  initialData?: Partial<ClientRequirement>;
  /** Project-based auto-save callback (saves to database instead of localStorage) */
  onAutoSave?: (data: ClientRequirement, step: number) => Promise<void>;
}

const STORAGE_KEY = 'requirement_form_draft';
const EXTRACT_TEXT_KEY = 'requirement_extract_text'; // 缓存提取文本
const AUTOSAVE_DELAY = 1000; // 1 second debounce
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const INDUSTRY_OPTIONS = [
  '制造业',
  '零售',
  '金融',
  '科技',
  '医疗',
  '教育',
  '房地产',
  '其他',
];

const PAIN_SEVERITY_OPTIONS = [
  { value: 'critical', label: '严重 - 影响业务生存' },
  { value: 'high', label: '高 - 显著影响运营效率' },
  { value: 'medium', label: '中 - 存在改进空间' },
  { value: 'low', label: '低 - 优化建议' },
];

const DEFAULT_FORM_DATA: ClientRequirement = {
  client_name: '',
  industry: '',
  industry_background: '',
  company_intro: '',
  company_scale: '',
  core_pain_points: [''],
  pain_severity: 'medium',
  project_goals: [''],
  success_criteria: [''],
  phase_planning: [{
    phase_id: 'phase_1',
    phase_name: '诊断阶段',
    duration_weeks: 4,
    key_activities: [''],
    deliverables: [''],
  }],
  main_tasks: [''],
  deliverables: [''],
  gantt_chart_data: [],
  five_d_diagnosis: undefined,
};

export default function RequirementForm({ onSubmit, isLoading, initialData, onAutoSave }: RequirementFormProps) {
  const [step, setStep] = useState(1);

  // Track if draft was auto-restored
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);

  // Initialize with default + initialData (no localStorage access during SSR)
  const [formData, setFormData] = useState<ClientRequirement>(() => {
    return { ...DEFAULT_FORM_DATA, ...initialData };
  });

  // Load draft from localStorage after mount (client-side only)
  useEffect(() => {
    setMounted(true);

    // Skip if initialData is provided (project-based form)
    if (initialData) return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Check if saved data is recent (within 72 hours for better UX)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 72 * 60 * 60 * 1000) {
          // Check if there's meaningful data
          const hasData = parsed.data.client_name || parsed.data.industry_background;
          if (hasData) {
            setFormData({ ...DEFAULT_FORM_DATA, ...parsed.data });
            setDraftRestored(true);
            setLastSaved(new Date(parsed.timestamp));
            console.log('[DraftStorage] Auto-restored draft from', new Date(parsed.timestamp).toLocaleString());
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load saved form data:', e);
    }
  }, [initialData]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Smart extraction state
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extractText, setExtractText] = useState(() => {
    // Load cached extraction text
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(EXTRACT_TEXT_KEY) || '';
      } catch (e) {
        return '';
      }
    }
    return '';
  });
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Auto-save to localStorage with debounce (or database if onAutoSave provided)
  useEffect(() => {
    // Don't save if form is empty (check more fields)
    const hasData = formData.client_name ||
                    formData.industry_background ||
                    formData.company_intro ||
                    formData.core_pain_points?.some(p => p.trim()) ||
                    formData.project_goals?.some(g => g.trim());
    if (!hasData) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        if (onAutoSave) {
          // Save to database via project API
          await onAutoSave(formData, step);
          setLastSaved(new Date());
          setSaveStatus('saved');
          console.log('[AutoSave] Form data saved to database:', formData.client_name || 'unnamed');
        } else {
          // Fallback to localStorage
          const saveData = {
            data: formData,
            timestamp: Date.now(),
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
          setLastSaved(new Date());
          setSaveStatus('saved');
          console.log('[AutoSave] Form data saved to localStorage:', saveData.data.client_name || 'unnamed');
        }
      } catch (e) {
        console.error('[AutoSave] Failed to save form data:', e);
        setSaveStatus('idle');
      }
    }, AUTOSAVE_DELAY);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, step, onAutoSave]);

  // Cache extraction text
  useEffect(() => {
    if (extractText) {
      try {
        localStorage.setItem(EXTRACT_TEXT_KEY, extractText);
      } catch (e) {
        console.warn('Failed to cache extraction text:', e);
      }
    }
  }, [extractText]);

  // Manual save function
  const handleManualSave = useCallback(() => {
    setSaveStatus('saving');
    try {
      const saveData = {
        data: formData,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      setLastSaved(new Date());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error('Manual save failed:', e);
      setSaveStatus('idle');
    }
  }, [formData]);

  // Clear saved data
  const clearSavedData = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setFormData(DEFAULT_FORM_DATA);
      setStep(1);
      setDraftRestored(false);
      setLastSaved(null);
    } catch (e) {
      console.warn('Failed to clear saved data:', e);
    }
  }, []);

  // Smart extract from text
  const handleSmartExtract = useCallback(async () => {
    if (!extractText.trim()) {
      setExtractError('请输入需求描述文本');
      return;
    }

    setIsExtracting(true);
    setExtractError(null);

    try {
      const response = await fetch(`${API_BASE}/api/requirement/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: extractText }),
      });

      if (!response.ok) {
        throw new Error('提取失败，请稍后重试');
      }

      const result = await response.json();

      if (result.extracted_data) {
        // Merge extracted data with existing form data
        setFormData(prev => ({
          ...prev,
          ...result.extracted_data,
          // Preserve arrays if extracted data is empty
          core_pain_points: result.extracted_data.core_pain_points?.length > 0
            ? result.extracted_data.core_pain_points
            : prev.core_pain_points,
          project_goals: result.extracted_data.project_goals?.length > 0
            ? result.extracted_data.project_goals
            : prev.project_goals,
          main_tasks: result.extracted_data.main_tasks?.length > 0
            ? result.extracted_data.main_tasks
            : prev.main_tasks,
          success_criteria: result.extracted_data.success_criteria?.length > 0
            ? result.extracted_data.success_criteria
            : prev.success_criteria,
        }));
        setShowExtractModal(false);
        // Keep the extraction text cached for future use (don't clear)
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : '提取失败');
    } finally {
      setIsExtracting(false);
    }
  }, [extractText]);

  // Update text field
  const updateField = (field: keyof ClientRequirement, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Update list field
  const updateList = (field: keyof ClientRequirement, index: number, value: string) => {
    setFormData(prev => {
      const list = [...(prev[field] as string[])];
      list[index] = value;
      return { ...prev, [field]: list };
    });
  };

  // Add item to list
  const addListItem = (field: keyof ClientRequirement) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[]), ''],
    }));
  };

  // Remove item from list
  const removeListItem = (field: keyof ClientRequirement, index: number) => {
    setFormData(prev => {
      const list = [...(prev[field] as string[])];
      list.splice(index, 1);
      return { ...prev, [field]: list };
    });
  };

  // Update phase planning
  const updatePhase = (index: number, field: keyof PhaseItem, value: string | number | string[]) => {
    setFormData(prev => {
      const phases = [...prev.phase_planning];
      phases[index] = { ...phases[index], [field]: value };
      return { ...prev, phase_planning: phases };
    });
  };

  const addPhase = () => {
    setFormData(prev => ({
      ...prev,
      phase_planning: [
        ...prev.phase_planning,
        {
          phase_id: `phase_${prev.phase_planning.length + 1}`,
          phase_name: '',
          duration_weeks: 4,
          key_activities: [''],
          deliverables: [''],
        },
      ],
    }));
  };

  const removePhase = (index: number) => {
    setFormData(prev => {
      const phases = [...prev.phase_planning];
      phases.splice(index, 1);
      return { ...prev, phase_planning: phases };
    });
  };

  // Validate step
  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.client_name.trim()) newErrors.client_name = '请输入客户名称';
      if (!formData.industry) newErrors.industry = '请选择行业类型';
      if (!formData.industry_background.trim() || formData.industry_background.length < 50) {
        newErrors.industry_background = '行业背景至少需要50字';
      }
      if (!formData.company_intro.trim() || formData.company_intro.length < 50) {
        newErrors.company_intro = '公司介绍至少需要50字';
      }
    } else if (step === 2) {
      const validPainPoints = formData.core_pain_points.filter(p => p.trim());
      if (validPainPoints.length === 0) newErrors.core_pain_points = '请至少输入一个核心痛点';
      const validGoals = formData.project_goals.filter(g => g.trim());
      if (validGoals.length === 0) newErrors.project_goals = '请至少输入一个项目目标';
    } else if (step === 3) {
      if (formData.phase_planning.length === 0) {
        newErrors.phase_planning = '请至少添加一个项目阶段';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = () => {
    console.log('[Form] handleSubmit called, step:', step);
    if (validateStep()) {
      console.log('[Form] Validation passed, cleaning data...');
      // Clean up empty items
      const cleanedData: ClientRequirement = {
        ...formData,
        core_pain_points: formData.core_pain_points.filter(p => p.trim()),
        project_goals: formData.project_goals.filter(g => g.trim()),
        success_criteria: formData.success_criteria?.filter(c => c.trim()),
        main_tasks: formData.main_tasks.filter(t => t.trim()),
        deliverables: formData.deliverables.filter(d => d.trim()),
        phase_planning: formData.phase_planning.map(phase => ({
          ...phase,
          key_activities: phase.key_activities.filter(a => a.trim()),
          deliverables: phase.deliverables.filter(d => d.trim()),
        })),
      };

      console.log('[Form] Calling onSubmit with cleaned data');
      onSubmit(cleanedData);
    } else {
      console.log('[Form] Validation failed, errors:', errors);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-medium text-gray-900">基本信息</h3>
        <p className="mt-1 text-sm text-gray-500">填写客户的基本信息和背景</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* 客户名称 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            客户名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.client_name}
            onChange={(e) => updateField('client_name', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.client_name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="例如：某某科技有限公司"
          />
          {errors.client_name && (
            <p className="mt-1 text-sm text-red-500">{errors.client_name}</p>
          )}
        </div>

        {/* 行业类型 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            行业类型 <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.industry}
            onChange={(e) => updateField('industry', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.industry ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">请选择行业</option>
            {INDUSTRY_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {errors.industry && (
            <p className="mt-1 text-sm text-red-500">{errors.industry}</p>
          )}
        </div>

        {/* 公司规模 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            公司规模
          </label>
          <input
            type="text"
            value={formData.company_scale || ''}
            onChange={(e) => updateField('company_scale', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="例如：500-1000人"
          />
        </div>

        {/* 行业背景 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            行业背景 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.industry_background}
            onChange={(e) => updateField('industry_background', e.target.value)}
            rows={4}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.industry_background ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="描述客户所在行业的发展趋势、竞争格局、市场机遇等..."
          />
          <div className="flex justify-between mt-1">
            {errors.industry_background && (
              <p className="text-sm text-red-500">{errors.industry_background}</p>
            )}
            <p className="text-sm text-gray-400 ml-auto">{formData.industry_background.length}字</p>
          </div>
        </div>

        {/* 公司介绍 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            公司介绍 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.company_intro}
            onChange={(e) => updateField('company_intro', e.target.value)}
            rows={4}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.company_intro ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="客户公司的基本情况、主营业务、发展历程、组织架构等..."
          />
          <div className="flex justify-between mt-1">
            {errors.company_intro && (
              <p className="text-sm text-red-500">{errors.company_intro}</p>
            )}
            <p className="text-sm text-gray-400 ml-auto">{formData.company_intro.length}字</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-medium text-gray-900">核心需求</h3>
        <p className="mt-1 text-sm text-gray-500">明确客户的核心痛点和项目目标</p>
      </div>

      {/* 核心痛点 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          核心痛点 <span className="text-red-500">*</span>
        </label>
        {formData.core_pain_points.map((point, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <textarea
              value={point}
              onChange={(e) => updateList('core_pain_points', index, e.target.value)}
              rows={2}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={`痛点 ${index + 1}：描述客户面临的具体问题...`}
            />
            {formData.core_pain_points.length > 1 && (
              <button
                type="button"
                onClick={() => removeListItem('core_pain_points', index)}
                className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => addListItem('core_pain_points')}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          + 添加痛点
        </button>
        {errors.core_pain_points && (
          <p className="mt-1 text-sm text-red-500">{errors.core_pain_points}</p>
        )}
      </div>

      {/* 痛点严重程度 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          痛点严重程度
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PAIN_SEVERITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateField('pain_severity', opt.value)}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                formData.pain_severity === opt.value
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 项目目标 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          项目目标 <span className="text-red-500">*</span>
        </label>
        {formData.project_goals.map((goal, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <input
              type="text"
              value={goal}
              onChange={(e) => updateList('project_goals', index, e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={`目标 ${index + 1}`}
            />
            {formData.project_goals.length > 1 && (
              <button
                type="button"
                onClick={() => removeListItem('project_goals', index)}
                className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => addListItem('project_goals')}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          + 添加目标
        </button>
        {errors.project_goals && (
          <p className="mt-1 text-sm text-red-500">{errors.project_goals}</p>
        )}
      </div>

      {/* 成功标准 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          成功标准/验收标准
        </label>
        {formData.success_criteria?.map((criteria, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <input
              type="text"
              value={criteria}
              onChange={(e) => updateList('success_criteria', index, e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={`标准 ${index + 1}`}
            />
            {(formData.success_criteria?.length || 0) > 1 && (
              <button
                type="button"
                onClick={() => removeListItem('success_criteria', index)}
                className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => addListItem('success_criteria')}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          + 添加标准
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-medium text-gray-900">阶段规划</h3>
        <p className="mt-1 text-sm text-gray-500">定义项目的实施阶段和关键活动</p>
      </div>

      {formData.phase_planning.map((phase, phaseIndex) => (
        <div key={phase.phase_id} className="p-4 bg-gray-50 rounded-lg space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium text-gray-900">阶段 {phaseIndex + 1}</h4>
            {formData.phase_planning.length > 1 && (
              <button
                type="button"
                onClick={() => removePhase(phaseIndex)}
                className="text-sm text-red-500 hover:text-red-600"
              >
                删除阶段
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                阶段名称
              </label>
              <input
                type="text"
                value={phase.phase_name}
                onChange={(e) => updatePhase(phaseIndex, 'phase_name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="例如：诊断阶段"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                预计周期（周）
              </label>
              <input
                type="number"
                value={phase.duration_weeks}
                onChange={(e) => updatePhase(phaseIndex, 'duration_weeks', parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={1}
                max={52}
              />
            </div>
          </div>

          {/* 关键活动 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              关键活动
            </label>
            {phase.key_activities.map((activity, actIndex) => (
              <div key={actIndex} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={activity}
                  onChange={(e) => {
                    const activities = [...phase.key_activities];
                    activities[actIndex] = e.target.value;
                    updatePhase(phaseIndex, 'key_activities', activities);
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`活动 ${actIndex + 1}`}
                />
                {phase.key_activities.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const activities = [...phase.key_activities];
                      activities.splice(actIndex, 1);
                      updatePhase(phaseIndex, 'key_activities', activities);
                    }}
                    className="px-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => updatePhase(phaseIndex, 'key_activities', [...phase.key_activities, ''])}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + 添加活动
            </button>
          </div>

          {/* 阶段交付物 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              阶段交付物
            </label>
            {phase.deliverables.map((deliverable, delIndex) => (
              <div key={delIndex} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={deliverable}
                  onChange={(e) => {
                    const deliverables = [...phase.deliverables];
                    deliverables[delIndex] = e.target.value;
                    updatePhase(phaseIndex, 'deliverables', deliverables);
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`交付物 ${delIndex + 1}`}
                />
                {phase.deliverables.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const deliverables = [...phase.deliverables];
                      deliverables.splice(delIndex, 1);
                      updatePhase(phaseIndex, 'deliverables', deliverables);
                    }}
                    className="px-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => updatePhase(phaseIndex, 'deliverables', [...phase.deliverables, ''])}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + 添加交付物
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addPhase}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
      >
        + 添加阶段
      </button>

      {errors.phase_planning && (
        <p className="text-sm text-red-500">{errors.phase_planning}</p>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-medium text-gray-900">工作任务与交付成果</h3>
        <p className="mt-1 text-sm text-gray-500">定义主要工作任务和整体交付成果</p>
      </div>

      {/* 主要工作任务 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          主要工作任务
        </label>
        {formData.main_tasks.map((task, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <input
              type="text"
              value={task}
              onChange={(e) => updateList('main_tasks', index, e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={`任务 ${index + 1}`}
            />
            {formData.main_tasks.length > 1 && (
              <button
                type="button"
                onClick={() => removeListItem('main_tasks', index)}
                className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => addListItem('main_tasks')}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          + 添加任务
        </button>
      </div>

      {/* 交付成果 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          阶段交付成果
        </label>
        {formData.deliverables.map((deliverable, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <input
              type="text"
              value={deliverable}
              onChange={(e) => updateList('deliverables', index, e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={`交付成果 ${index + 1}`}
            />
            {formData.deliverables.length > 1 && (
              <button
                type="button"
                onClick={() => removeListItem('deliverables', index)}
                className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => addListItem('deliverables')}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          + 添加交付成果
        </button>
      </div>

      {/* 摘要预览 */}
      <div className="mt-8 p-6 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-4">需求摘要</h4>
        <div className="space-y-2 text-sm text-blue-800">
          <p><strong>客户：</strong>{formData.client_name || '-'}</p>
          <p><strong>行业：</strong>{formData.industry || '-'}</p>
          <p><strong>痛点数量：</strong>{formData.core_pain_points.filter(p => p.trim()).length} 个</p>
          <p><strong>项目目标：</strong>{formData.project_goals.filter(g => g.trim()).length} 个</p>
          <p><strong>阶段规划：</strong>{formData.phase_planning.length} 个阶段</p>
          <p><strong>预计总周期：</strong>{formData.phase_planning.reduce((sum, p) => sum + p.duration_weeks, 0)} 周</p>
        </div>
      </div>
    </div>
  );

  return (
  <>
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Draft restored notice */}
      {draftRestored && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              已自动恢复草稿
              {mounted && lastSaved && <span className="text-green-600 ml-1">({lastSaved.toLocaleString()})</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSavedData}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              清除并重新开始
            </button>
            <button
              type="button"
              onClick={() => setDraftRestored(false)}
              className="text-sm text-green-600 hover:text-green-700"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* Autosave indicator */}
      {lastSaved && !draftRestored && (
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>已自动保存</span>
          </div>
          <button
            type="button"
            onClick={clearSavedData}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            清除缓存
          </button>
        </div>
      )}

      {/* Progress indicator */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">步骤 {step} / 4</span>
            {step === 1 && (
              <button
                type="button"
                onClick={() => setShowExtractModal(true)}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                智能提取
              </button>
            )}
          </div>
          <span className="text-sm text-gray-500">{Math.round((step / 4) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Form content */}
      <div className="p-6">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      {/* Navigation */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 1}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            step === 1
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          上一步
        </button>

        {/* Save status indicator */}
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && (
            <span className="text-xs text-blue-500">保存中...</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              已保存
            </span>
          )}
          <button
            type="button"
            onClick={handleManualSave}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            保存草稿
          </button>
        </div>

        {step < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            下一步
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              console.log('[Form] 生成报告 button clicked, step:', step, 'isLoading:', isLoading);
              handleSubmit();
            }}
            disabled={isLoading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isLoading ? '生成中...' : '生成报告'}
          </button>
        )}
      </div>
    </div>

    {/* Smart Extract Modal */}
    {showExtractModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">智能提取需求信息</h3>
            <div className="flex items-center gap-2">
              {extractText && (
                <button
                  type="button"
                  onClick={() => {
                    setExtractText('');
                    localStorage.removeItem(EXTRACT_TEXT_KEY);
                  }}
                  className="text-sm text-gray-400 hover:text-red-500"
                >
                  清除
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowExtractModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            粘贴您的需求描述文本，AI将自动识别并提取关键信息填充到表单中。
            {extractText && <span className="text-blue-500 ml-1">(已自动恢复上次输入)</span>}
          </p>

          <textarea
            value={extractText}
            onChange={(e) => setExtractText(e.target.value)}
            rows={10}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder={`示例：
客户是一家成立于2018年的科技公司，目前有200多名员工。
主要问题：
1. 战略层面：公司去年营收增长8%，远低于预期的15%。
2. 组织层面：公司采用职能制架构，但部门墙很厚，跨部门协作经常出问题。
3. 绩效层面：使用KPI考核，但指标分解不够科学，员工普遍反映考核不公平。
项目目标：
1. 明确公司未来3年的战略方向
2. 优化组织架构，提升跨部门协作效率
3. 建立科学的绩效管理体系`}
          />

          {extractError && (
            <p className="mt-2 text-sm text-red-500">{extractError}</p>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={() => setShowExtractModal(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSmartExtract}
              disabled={isExtracting || !extractText.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isExtracting && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isExtracting ? '提取中...' : '开始提取'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
