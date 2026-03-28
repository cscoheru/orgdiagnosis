/**
 * Kernel API Client
 *
 * 与后端 /api/v1/kernel/* 端点交互的客户端。
 * 所有函数返回 { success, data?, error? } 统一格式。
 */

import { API_BASE_URL } from "@/lib/api-config";

// ──────────────────────────────────────────────
// 类型定义
// ──────────────────────────────────────────────

export interface FieldDefinition {
  field_name: string;
  field_type: "string" | "text" | "integer" | "float" | "money" | "boolean" | "datetime" | "array" | "object" | "enum" | "reference";
  is_required: boolean;
  default_value?: unknown;
  description?: string;
  enum_options?: string[];
  reference_model?: string;
}

export interface MetaModel {
  _key: string;
  model_key: string;
  name: string;
  fields: FieldDefinition[];
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface KernelObject {
  _key: string;
  _id: string;
  model_key: string;
  properties: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface KernelRelation {
  _key: string;
  _id: string;
  from_obj_id: string;
  to_obj_id: string;
  relation_type: string;
  properties?: Record<string, unknown>;
  created_at?: string;
}

export interface GraphData {
  root: KernelObject;
  relations: KernelRelation[];
  tree: Record<string, unknown>;
  total_vertices: number;
  total_edges: number;
}

export interface KernelApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ──────────────────────────────────────────────
// 通用请求包装
// ──────────────────────────────────────────────

async function kernelRequest<T>(
  path: string,
  options?: RequestInit
): Promise<KernelApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/kernel${path}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `服务器错误 ${response.status}: ${text}` };
    }

    const json = await response.json();
    return { success: true, data: json };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "网络错误",
    };
  }
}

// ──────────────────────────────────────────────
// 元模型 API
// ──────────────────────────────────────────────

/** 获取所有元模型 */
export async function listMetaModels(limit = 100): Promise<KernelApiResponse<MetaModel[]>> {
  return kernelRequest<MetaModel[]>(`/meta?limit=${limit}`);
}

/** 获取单个元模型 */
export async function getMetaModel(key: string): Promise<KernelApiResponse<MetaModel>> {
  return kernelRequest<MetaModel>(`/meta/${encodeURIComponent(key)}`);
}

/** 创建元模型 */
export async function createMetaModel(
  data: { model_key: string; name: string; fields: FieldDefinition[]; description?: string }
): Promise<KernelApiResponse<MetaModel>> {
  return kernelRequest<MetaModel>("/meta", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** 更新元模型 */
export async function updateMetaModel(
  key: string,
  data: Partial<{ name: string; fields: FieldDefinition[]; description: string }>
): Promise<KernelApiResponse<MetaModel>> {
  return kernelRequest<MetaModel>(`/meta/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** 删除元模型 */
export async function deleteMetaModel(key: string): Promise<KernelApiResponse<void>> {
  return kernelRequest<void>(`/meta/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
}

// ──────────────────────────────────────────────
// 对象 API
// ──────────────────────────────────────────────

/** 获取所有对象 */
export async function listObjects(limit = 100): Promise<KernelApiResponse<KernelObject[]>> {
  return kernelRequest<KernelObject[]>(`/objects?limit=${limit}`);
}

/** 获取指定模型的对象 */
export async function getObjectsByModel(
  modelKey: string,
  limit = 100
): Promise<KernelApiResponse<KernelObject[]>> {
  return kernelRequest<KernelObject[]>(
    `/objects?model_key=${encodeURIComponent(modelKey)}&limit=${limit}`
  );
}

/** 获取单个对象 */
export async function getObject(key: string): Promise<KernelApiResponse<KernelObject>> {
  return kernelRequest<KernelObject>(`/objects/${encodeURIComponent(key)}`);
}

/** 创建对象 */
export async function createObject(
  modelKey: string,
  properties: Record<string, unknown>
): Promise<KernelApiResponse<KernelObject>> {
  return kernelRequest<KernelObject>("/objects", {
    method: "POST",
    body: JSON.stringify({ model_key: modelKey, properties }),
  });
}

/** 更新对象 */
export async function updateObject(
  key: string,
  properties: Record<string, unknown>
): Promise<KernelApiResponse<KernelObject>> {
  return kernelRequest<KernelObject>(`/objects/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

/** 删除对象 */
export async function deleteObject(key: string): Promise<KernelApiResponse<void>> {
  return kernelRequest<void>(`/objects/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
}

// ──────────────────────────────────────────────
// 关系 API
// ──────────────────────────────────────────────

/** 获取所有关系 */
export async function listRelations(limit = 100): Promise<KernelApiResponse<KernelRelation[]>> {
  return kernelRequest<KernelRelation[]>(`/relations?limit=${limit}`);
}

/** 创建关系 */
export async function createRelation(
  fromObjId: string,
  toObjId: string,
  relationType: string,
  properties?: Record<string, unknown>
): Promise<KernelApiResponse<KernelRelation>> {
  return kernelRequest<KernelRelation>("/relations", {
    method: "POST",
    body: JSON.stringify({
      from_obj_id: fromObjId,
      to_obj_id: toObjId,
      relation_type: relationType,
      properties,
    }),
  });
}

/** 删除关系 */
export async function deleteRelation(key: string): Promise<KernelApiResponse<void>> {
  return kernelRequest<void>(`/relations/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
}

// ──────────────────────────────────────────────
// 图谱 API
// ──────────────────────────────────────────────

/** 查询图谱 */
export async function queryGraph(
  startObjId: string,
  depth = 2,
  direction: "OUTBOUND" | "INBOUND" | "ANY" = "OUTBOUND"
): Promise<KernelApiResponse<GraphData>> {
  const params = new URLSearchParams({
    start_obj_id: startObjId,
    depth: String(depth),
    direction,
  });
  return kernelRequest<GraphData>(`/graph?${params.toString()}`);
}
