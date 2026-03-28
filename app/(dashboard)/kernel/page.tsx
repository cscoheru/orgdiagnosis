"use client";

/**
 * 内核仪表盘
 *
 * 显示所有元模型列表 + 对象统计 + 快速入口。
 * /kernel
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  listMetaModels,
  listObjects,
  type MetaModel,
  type KernelObject,
} from "@/lib/api/kernel-client";

export default function KernelDashboardPage() {
  const [metaModels, setMetaModels] = useState<MetaModel[]>([]);
  const [objects, setObjects] = useState<KernelObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const [metaRes, objRes] = await Promise.all([
      listMetaModels(100),
      listObjects(100),
    ]);

    if (metaRes.success && metaRes.data) {
      setMetaModels(metaRes.data);
    } else {
      setError(metaRes.error || "");
    }

    if (objRes.success && objRes.data) {
      setObjects(objRes.data);
    }

    setLoading(false);
  };

  // 按模型统计对象数量
  const modelStats: Record<string, number> = {};
  for (const obj of objects) {
    modelStats[obj.model_key] = (modelStats[obj.model_key] || 0) + 1;
  }

  const totalObjects = objects.length;
  const totalRelations = 0; // TODO: 从 relations API 获取

  if (loading) {
    return (
      <div className="p-8 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">{error}</div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Deprecation banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex items-center justify-between">
        <span className="text-sm text-amber-700">
          内核管理已迁移至设置
        </span>
        <Link href="/settings/kernel" className="text-sm text-amber-700 underline hover:text-amber-800">
          前往新位置 →
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">内核管理</h1>
          <p className="text-gray-500 text-sm mt-1">
            元数据驱动的数据管理 — {metaModels.length} 个元模型, {totalObjects} 个对象
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
        >
          刷新
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-2xl font-bold text-blue-700">{metaModels.length}</p>
          <p className="text-sm text-blue-600">元模型</p>
        </div>
        <div className="p-4 bg-green-50 border border-green-100 rounded-lg">
          <p className="text-2xl font-bold text-green-700">{totalObjects}</p>
          <p className="text-sm text-green-600">对象</p>
        </div>
        <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg">
          <p className="text-2xl font-bold text-purple-700">{totalRelations}</p>
          <p className="text-sm text-purple-600">关系</p>
        </div>
      </div>

      {/* 元模型列表 */}
      <h2 className="text-lg font-semibold mb-3">元模型列表</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {metaModels.map((mm) => (
          <Link
            key={mm._key}
            href={`/kernel/${mm.model_key}`}
            className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{mm.name}</h3>
              <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                {mm.model_key}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {mm.fields?.length || 0} 个字段
            </p>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                {modelStats[mm.model_key] || 0} 个对象
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* 快速入口 */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h2 className="text-lg font-semibold mb-3">快速操作</h2>
        <div className="flex gap-3">
          <Link
            href="/kernel/graph"
            className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900"
          >
            图谱查看器
          </Link>
        </div>
      </div>
    </div>
  );
}
