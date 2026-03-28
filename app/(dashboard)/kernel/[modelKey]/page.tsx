"use client";

/**
 * 元模型对象浏览器
 *
 * 展示指定元模型下的所有对象，支持创建新对象。
 * /kernel/[modelKey]
 */

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";

import ObjectBrowser from "@/components/kernel/ObjectBrowser";
import ObjectDetail from "@/components/kernel/ObjectDetail";
import MetaModelForm from "@/components/kernel/MetaModelForm";
import { getMetaModel, createObject, type MetaModel, type KernelObject } from "@/lib/api/kernel-client";

const GraphViewer = dynamic(() => import("@/components/kernel/GraphViewer"), {
  ssr: false,
});

export default function ModelObjectPage() {
  const params = useParams();
  const modelKey = params.modelKey as string;

  const [meta, setMeta] = useState<MetaModel | null>(null);
  const [selectedObject, setSelectedObject] = useState<KernelObject | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // 加载元模型
  useEffect(() => {
    getMetaModel(modelKey).then((res) => {
      if (res.success && res.data) setMeta(res.data);
    });
  }, [modelKey]);

  const handleCreate = async (properties: Record<string, unknown>) => {
    setCreating(true);
    const res = await createObject(modelKey, properties);
    setCreating(false);

    if (res.success) {
      setShowCreateForm(false);
      setRefreshKey((k) => k + 1);
      if (res.data) {
        setSelectedObject(res.data);
      }
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 面包屑 */}
      <nav className="text-sm text-gray-500 mb-4">
        <a href="/kernel" className="hover:text-blue-600">
          内核管理
        </a>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">
          {meta?.name || modelKey}
        </span>
      </nav>

      {/* 操作栏 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">{meta?.name || modelKey}</h1>
          {meta?.description && (
            <p className="text-sm text-gray-500 mt-1">{meta.description}</p>
          )}
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          {showCreateForm ? "取消" : "+ 创建对象"}
        </button>
      </div>

      {/* 创建表单 */}
      {showCreateForm && meta && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="font-medium mb-3">创建新对象</h3>
          <MetaModelForm
            fields={meta.fields}
            onSubmit={handleCreate}
            submitLabel="创建"
            loading={creating}
          />
        </div>
      )}

      {/* 主内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 对象列表 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">对象列表</h2>
          <ObjectBrowser
            modelKey={modelKey}
            onObjectSelect={setSelectedObject}
            refreshTrigger={refreshKey}
          />
        </div>

        {/* 对象详情 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">对象详情</h2>
          {selectedObject ? (
            <div className="p-4 border border-gray-200 rounded-lg">
              <ObjectDetail object={selectedObject} metaModel={meta} />
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">
              点击左侧对象查看详情
            </p>
          )}
        </div>
      </div>

      {/* 图谱入口 */}
      {selectedObject && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">关联图谱</h2>
          <GraphViewer startObjId={selectedObject._id} depth={2} height="300px" />
        </div>
      )}
    </div>
  );
}
