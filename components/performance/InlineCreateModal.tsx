'use client';

/**
 * InlineCreateModal — 通用内联对象创建弹窗
 *
 * 基于 Kernel meta-model 定义自动渲染表单。
 * 支持 Strategic_Goal / Org_Unit / Job_Role 等任意 model。
 * 仅渲染简单字段（string/text/integer/float/boolean/enum），
 * 跳过 reference/array/object 等复杂类型。
 */

import { useState, useEffect } from 'react';
import {
  getMetaModel,
  createObject,
  type FieldDefinition,
  type KernelObject,
} from '@/lib/api/kernel-client';
import { X, Plus } from 'lucide-react';

interface FieldConfig {
  label: string;
  field_name: string;
  type: string;
  required: boolean;
  default_value?: unknown;
  enum_options?: string[];
  description?: string;
}

interface Props {
  modelKey: string;
  title: string;
  open: boolean;
  onClose: () => void;
  onCreated: (obj: KernelObject) => void;
  /** 预填字段 (如创建 Job_Role 时自动填充 org_unit_id) */
  prefills?: Record<string, unknown>;
}

/** 从 meta-model fields 过滤出可编辑的简单字段 */
function getEditableFields(fields: FieldDefinition[]): FieldConfig[] {
  const simpleTypes = new Set(['string', 'text', 'integer', 'float', 'money', 'boolean', 'enum']);
  return fields
    .filter(f => simpleTypes.has(f.field_type))
    .map(f => ({
      label: f.description || f.field_name,
      field_name: f.field_name,
      type: f.field_type,
      required: f.is_required,
      default_value: f.default_value,
      enum_options: f.enum_options,
      description: f.description,
    }));
}

export default function InlineCreateModal({ modelKey, title, open, onClose, onCreated, prefills }: Props) {
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch meta-model definition
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getMetaModel(modelKey).then(res => {
      if (res.success && res.data) {
        setFields(getEditableFields(res.data.fields || []));
      } else {
        setError(res.error || '加载元模型失败');
      }
    }).finally(() => setLoading(false));
  }, [modelKey, open]);

  // Form state
  const [form, setForm] = useState<Record<string, unknown>>({});

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      const defaults: Record<string, unknown> = { ...prefills };
      fields.forEach(f => {
        if (defaults[f.field_name] === undefined && f.default_value !== undefined) {
          defaults[f.field_name] = f.default_value;
        }
      });
      setForm(defaults);
      setError(null);
    }
  }, [open, fields, prefills]);

  const handleSubmit = async () => {
    // Validate required fields
    for (const f of fields) {
      if (f.required && !form[f.field_name] && form[f.field_name] !== 0) {
        setError(`请填写 ${f.label}`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await createObject(modelKey, form);
      if (res.success && res.data) {
        onCreated(res.data);
        onClose();
      } else {
        setError(res.error || '创建失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (fieldName: string, value: unknown) => {
    setForm(prev => ({ ...prev, [fieldName]: value }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            fields.map(f => (
              <div key={f.field_name}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {f.label}
                  {f.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {f.type === 'enum' && f.enum_options ? (
                  <select
                    value={(form[f.field_name] as string) || ''}
                    onChange={e => updateField(f.field_name, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">请选择...</option>
                    {f.enum_options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : f.type === 'boolean' ? (
                  <label className="flex items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      checked={!!form[f.field_name]}
                      onChange={e => updateField(f.field_name, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-600">{form[f.field_name] ? '是' : '否'}</span>
                  </label>
                ) : f.type === 'integer' || f.type === 'float' || f.type === 'money' ? (
                  <input
                    type="number"
                    step={f.type === 'float' || f.type === 'money' ? '0.01' : '1'}
                    value={(form[f.field_name] as number) || ''}
                    onChange={e => updateField(f.field_name, parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder={f.description}
                  />
                ) : (
                  <input
                    type={f.type === 'text' ? 'text' : 'text'}
                    value={(form[f.field_name] as string) || ''}
                    onChange={e => updateField(f.field_name, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder={f.description}
                  />
                )}
              </div>
            ))
          )}
        </div>

        {/* Error */}
        {error && <p className="px-5 pb-2 text-xs text-red-600">{error}</p>}

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || fields.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={14} />
            {submitting ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
