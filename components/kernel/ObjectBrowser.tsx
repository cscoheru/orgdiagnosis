"use client";

/**
 * ObjectBrowser — 按元模型浏览内核对象
 *
 * 用法:
 *   <ObjectBrowser modelKey="Employee" />
 */

import { useState, useEffect } from "react";
import {
  getMetaModel,
  getObjectsByModel,
  deleteObject,
  type MetaModel,
  type KernelObject,
} from "@/lib/api/kernel-client";

interface ObjectBrowserProps {
  modelKey: string;
  onObjectSelect?: (obj: KernelObject) => void;
  refreshTrigger?: number;
}

export default function ObjectBrowser({
  modelKey,
  onObjectSelect,
  refreshTrigger,
}: ObjectBrowserProps) {
  const [meta, setMeta] = useState<MetaModel | null>(null);
  const [objects, setObjects] = useState<KernelObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [modelKey, refreshTrigger]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const [metaRes, objRes] = await Promise.all([
      getMetaModel(modelKey),
      getObjectsByModel(modelKey, 50),
    ]);

    if (metaRes.success && metaRes.data) {
      setMeta(metaRes.data);
    } else {
      setError(metaRes.error || "加载元模型失败");
    }

    if (objRes.success && objRes.data) {
      setObjects(objRes.data);
    } else {
      setError(objRes.error || "加载对象失败");
    }

    setLoading(false);
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`确定删除对象 ${key}？`)) return;
    const res = await deleteObject(key);
    if (res.success) {
      setObjects((prev) => prev.filter((o) => o._key !== key));
    } else {
      alert(res.error);
    }
  };

  // 字段摘要显示 (取前3个字段)
  const summaryFields = (meta?.fields || []).slice(0, 3);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3 p-4">
        <div className="h-6 bg-gray-200 rounded w-1/3" />
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-10 bg-gray-200 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{meta?.name || modelKey}</h3>
          <p className="text-sm text-gray-500">{objects.length} 个对象</p>
        </div>
        <button
          onClick={loadData}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          刷新
        </button>
      </div>

      {objects.length === 0 ? (
        <p className="text-gray-400 text-center py-8">暂无数据</p>
      ) : (
        <div className="space-y-2">
          {objects.map((obj) => (
            <div
              key={obj._key}
              onClick={() => onObjectSelect?.(obj)}
              className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {String(obj.properties[summaryFields[0]?.field_name || ""] || obj._key)}
                  </p>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    {summaryFields.slice(1).map((f) => (
                      <span key={f.field_name}>
                        {f.description || f.field_name}: {String(obj.properties[f.field_name] ?? "-")}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(obj._key);
                  }}
                  className="text-gray-400 hover:text-red-500 text-xs ml-2"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
