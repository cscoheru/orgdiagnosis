'use client';

import { useState } from 'react';
import type { UIComponent } from '@/lib/agent-api';

interface FormCardProps {
  components: UIComponent[];
  onSubmit: (data: Record<string, unknown>) => void;
  loading?: boolean;
}

/**
 * FormCard — 根据 Server-Driven UI 协议动态渲染表单。

 * 后端返回的 ui_components 数组定义了每个字段的类型、标签、选项等。
 * 前端只负责渲染和提交，不关心业务逻辑。
 */
export default function FormCard({ components, onSubmit, loading }: FormCardProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const handleChange = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({});
  };

  if (!components.length) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {components.map((comp) => (
          <FieldRenderer
            key={comp.key}
            component={comp}
            value={formData[comp.key]}
            onChange={(v) => handleChange(comp.key, v)}
          />
        ))}
      </div>
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '提交中...' : '提交'}
        </button>
      </div>
    </form>
  );
}

// ─── Field Renderer ───

interface FieldRendererProps {
  component: UIComponent;
  value: unknown;
  onChange: (value: unknown) => void;
}

function FieldRenderer({ component, value, onChange }: FieldRendererProps) {
  const { type, key, label, placeholder, required, options, min, max } = component;

  const labelEl = (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );

  switch (type) {
    case 'textarea':
      return (
        <div className="md:col-span-2">
          {labelEl}
          <textarea
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>
      );

    case 'select':
      return (
        <div>
          {labelEl}
          <select
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">请选择...</option>
            {options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );

    case 'number':
      return (
        <div>
          {labelEl}
          <input
            type="number"
            value={value !== undefined && value !== '' ? String(value) : ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
            placeholder={placeholder}
            min={min}
            max={max}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      );

    default:
      // input
      return (
        <div>
          {labelEl}
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      );
  }
}
