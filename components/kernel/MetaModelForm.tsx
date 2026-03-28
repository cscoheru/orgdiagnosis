"use client";

/**
 * MetaModelForm — 元数据驱动的动态表单
 *
 * 根据内核元模型的 fields[] 定义自动渲染表单控件。
 * 新增元模型字段 → 前端表单自动适配，无需改代码。
 *
 * 用法:
 *   <MetaModelForm fields={metaModel.fields} onSubmit={handleSubmit} />
 */

import { useState } from "react";
import type { FieldDefinition } from "@/lib/api/kernel-client";

interface MetaModelFormProps {
  fields: FieldDefinition[];
  initialValues?: Record<string, unknown>;
  onSubmit?: (properties: Record<string, unknown>) => void | Promise<void>;
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
}

export default function MetaModelForm({
  fields,
  initialValues = {},
  onSubmit,
  submitLabel = "提交",
  loading = false,
  disabled = false,
}: MetaModelFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.default_value !== undefined && field.default_value !== null) {
        defaults[field.field_name] = field.default_value;
      } else if (field.field_type === "boolean") {
        defaults[field.field_name] = false;
      } else if (field.field_type === "integer" || field.field_type === "float") {
        defaults[field.field_name] = 0;
      } else if (field.field_type === "array") {
        defaults[field.field_name] = [];
      } else {
        defaults[field.field_name] = "";
      }
    }
    return { ...defaults, ...initialValues };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (fieldName: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
    if (errors[fieldName]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  const handleArrayChange = (fieldName: string, index: number, value: string) => {
    const arr = ((values[fieldName] as string[]) || []).slice();
    arr[index] = value;
    handleChange(fieldName, arr);
  };

  const handleArrayAdd = (fieldName: string) => {
    const arr = ((values[fieldName] as string[]) || []).slice();
    arr.push("");
    handleChange(fieldName, arr);
  };

  const handleArrayRemove = (fieldName: string, index: number) => {
    const arr = ((values[fieldName] as string[]) || []).slice();
    arr.splice(index, 1);
    handleChange(fieldName, arr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 校验必填字段
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.is_required) {
        const val = values[field.field_name];
        if (val === undefined || val === null || val === "") {
          newErrors[field.field_name] = `${field.description || field.field_name} 为必填项`;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // 过滤空字符串数组项
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(values)) {
      if (Array.isArray(val)) {
        cleaned[key] = val.filter((v) => v !== "");
      } else {
        cleaned[key] = val;
      }
    }

    await onSubmit?.(cleaned);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => (
        <div key={field.field_name}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.description || field.field_name}
            {field.is_required && <span className="text-red-500 ml-1">*</span>}
            {!field.is_required && (
              <span className="text-gray-400 text-xs ml-1">可选</span>
            )}
          </label>

          <FieldRenderer
            field={field}
            value={values[field.field_name]}
            onChange={(v) => handleChange(field.field_name, v)}
            onArrayChange={(i, v) => handleArrayChange(field.field_name, i, v)}
            onArrayAdd={() => handleArrayAdd(field.field_name)}
            onArrayRemove={(i) => handleArrayRemove(field.field_name, i)}
            disabled={disabled}
          />

          {errors[field.field_name] && (
            <p className="text-red-500 text-xs mt-1">{errors[field.field_name]}</p>
          )}
        </div>
      ))}

      {onSubmit && (
        <button
          type="submit"
          disabled={loading || disabled}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "提交中..." : submitLabel}
        </button>
      )}
    </form>
  );
}

// ──────────────────────────────────────────────
// 字段渲染器
// ──────────────────────────────────────────────

interface FieldRendererProps {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  onArrayChange?: (index: number, value: string) => void;
  onArrayAdd?: () => void;
  onArrayRemove?: (index: number) => void;
  disabled?: boolean;
}

function FieldRenderer({
  field,
  value,
  onChange,
  onArrayChange,
  onArrayAdd,
  onArrayRemove,
  disabled,
}: FieldRendererProps) {
  const { field_type, enum_options, description } = field;

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-50 disabled:text-gray-500";

  switch (field_type) {
    case "string":
      return (
        <input
          type="text"
          className={inputClass}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={description}
          disabled={disabled}
        />
      );

    case "text":
      return (
        <textarea
          className={`${inputClass} min-h-[80px] resize-y`}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={description}
          disabled={disabled}
        />
      );

    case "integer":
      return (
        <input
          type="number"
          className={inputClass}
          value={value !== undefined && value !== null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : 0)}
          placeholder={description}
          disabled={disabled}
        />
      );

    case "float":
    case "money":
      return (
        <input
          type="number"
          step="0.01"
          className={inputClass}
          value={value !== undefined && value !== null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : 0)}
          placeholder={description}
          disabled={disabled}
        />
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">
            {value ? "是" : "否"}
          </span>
        </label>
      );

    case "datetime":
      return (
        <input
          type="datetime-local"
          className={inputClass}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );

    case "enum":
      return (
        <select
          className={inputClass}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">请选择...</option>
          {enum_options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case "reference":
      return (
        <input
          type="text"
          className={inputClass}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`引用: ${field.reference_model || ""}`}
          disabled={disabled}
        />
      );

    case "array":
      return (
        <ArrayFieldEditor
          items={((value as string[]) || []).map(String)}
          onItemChange={onArrayChange || (() => {})}
          onAdd={onArrayAdd || (() => {})}
          onRemove={onArrayRemove || (() => {})}
          disabled={disabled}
        />
      );

    case "object":
      return (
        <textarea
          className={`${inputClass} min-h-[60px] font-mono text-xs`}
          value={typeof value === "string" ? value : JSON.stringify(value || {}, null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
          placeholder="JSON 格式"
          disabled={disabled}
        />
      );

    default:
      return (
        <input
          type="text"
          className={inputClass}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );
  }
}

// ──────────────────────────────────────────────
// 数组字段编辑器
// ──────────────────────────────────────────────

function ArrayFieldEditor({
  items,
  onItemChange,
  onAdd,
  onRemove,
  disabled,
}: {
  items: string[];
  onItemChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
            value={item}
            onChange={(e) => onItemChange(index, e.target.value)}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={disabled || items.length <= 0}
            className="px-2 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm disabled:opacity-30"
          >
            删除
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="px-3 py-1.5 text-blue-600 border border-blue-200 rounded-lg text-sm hover:bg-blue-50 disabled:opacity-50"
      >
        + 添加
      </button>
    </div>
  );
}
