"use client";

/**
 * ObjectDetail — 显示内核对象属性和关联
 *
 * 用法:
 *   <ObjectDetail object={kernelObject} metaModel={meta} />
 */

import type { KernelObject, MetaModel, FieldDefinition } from "@/lib/api/kernel-client";

interface ObjectDetailProps {
  object: KernelObject;
  metaModel?: MetaModel | null;
}

export default function ObjectDetail({ object, metaModel }: ObjectDetailProps) {
  const fields = metaModel?.fields || [];

  return (
    <div className="space-y-4">
      {/* 元信息 */}
      <div className="text-xs text-gray-400 space-y-1">
        <p>
          ID: <span className="font-mono">{object._id}</span>
        </p>
        <p>
          模型: <span className="font-mono">{object.model_key}</span>
        </p>
        {object.created_at && <p>创建时间: {object.created_at}</p>}
      </div>

      <hr className="border-gray-200" />

      {/* 属性列表 */}
      <div className="space-y-3">
        {fields.map((field) => {
          const value = object.properties[field.field_name];
          return (
            <div key={field.field_name}>
              <dt className="text-xs font-medium text-gray-500">
                {field.description || field.field_name}
                <span className="ml-1 text-gray-400">({field.field_type})</span>
              </dt>
              <dd className="mt-0.5 text-sm text-gray-800">
                <PropertyValue field={field} value={value} />
              </dd>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PropertyValue({
  field,
  value,
}: {
  field: FieldDefinition;
  value: unknown;
}) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-gray-400 italic">未设置</span>;
  }

  switch (field.field_type) {
    case "boolean":
      return (
        <span className={`inline-flex px-2 py-0.5 rounded text-xs ${value ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
          {value ? "是" : "否"}
        </span>
      );

    case "array":
      return (
        <div className="flex flex-wrap gap-1">
          {(value as unknown[]).map((item, i) => (
            <span key={i} className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
              {String(item)}
            </span>
          ))}
          {(value as unknown[]).length === 0 && (
            <span className="text-gray-400 italic">空数组</span>
          )}
        </div>
      );

    case "object":
      return (
        <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto max-h-40">
          {JSON.stringify(value, null, 2)}
        </pre>
      );

    case "money":
      return <span className="font-mono">¥{Number(value).toLocaleString()}</span>;

    case "float":
    case "integer":
      return <span className="font-mono">{String(value)}</span>;

    default:
      return <span>{String(value)}</span>;
  }
}
