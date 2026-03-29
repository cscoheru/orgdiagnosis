"use client";

/**
 * 交互式图谱查看器 — Client Component
 *
 * /kernel/graph
 */

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  listObjects,
  type KernelObject,
} from "@/lib/api/kernel-client";

const GraphViewer = dynamic(() => import("@/components/kernel/GraphViewer"), {
  ssr: false,
});

export default function GraphPageContent() {
  const [objects, setObjects] = useState<KernelObject[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listObjects(100).then((res) => {
      if (res.success && res.data) setObjects(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 面包屑 */}
      <nav className="text-sm text-gray-500 mb-4">
        <a href="/kernel" className="hover:text-blue-600">
          内核管理
        </a>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">图谱查看器</span>
      </nav>

      <h1 className="text-xl font-bold mb-4">图谱查看器</h1>

      {/* 对象选择器 */}
      {loading ? (
        <div className="animate-pulse h-10 bg-gray-200 rounded" />
      ) : (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            选择起点对象
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">-- 请选择 --</option>
            {objects.map((obj) => {
              const label = `${obj.model_key}: ${
                String(
                  obj.properties.name ||
                  obj.properties.goal_name ||
                  obj.properties.unit_name ||
                  obj.properties.role_name ||
                  obj.properties.metric_name ||
                  obj._key
                )
              }`;
              return (
                <option key={obj._id} value={obj._id}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* 图谱 */}
      {selectedId ? (
        <GraphViewer
          startObjId={selectedId}
          depth={3}
          height="500px"
        />
      ) : (
        <div className="text-center text-gray-400 py-16 border border-gray-200 rounded-lg">
          选择一个对象作为图谱起点
        </div>
      )}
    </div>
  );
}
