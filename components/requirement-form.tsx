'use client';

import { useState } from 'react';
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
}

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

export default function RequirementForm({ onSubmit, isLoading, initialData }: RequirementFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ClientRequirement>({
    client_name: initialData?.client_name || '',
    industry: initialData?.industry || '',
    industry_background: initialData?.industry_background || '',
    company_intro: initialData?.company_intro || '',
    company_scale: initialData?.company_scale || '',
    core_pain_points: initialData?.core_pain_points || [''],
    pain_severity: initialData?.pain_severity || 'medium',
    project_goals: initialData?.project_goals || [''],
    success_criteria: initialData?.success_criteria || [''],
    phase_planning: initialData?.phase_planning || [{
      phase_id: 'phase_1',
      phase_name: '诊断阶段',
      duration_weeks: 4,
      key_activities: [''],
      deliverables: [''],
    }],
    main_tasks: initialData?.main_tasks || [''],
    deliverables: initialData?.deliverables || [''],
    gantt_chart_data: initialData?.gantt_chart_data || [],
    five_d_diagnosis: initialData?.five_d_diagnosis,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (validateStep()) {
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
      onSubmit(cleanedData);
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Progress indicator */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">步骤 {step} / 4</span>
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
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
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
            onClick={handleSubmit}
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
  );
}
