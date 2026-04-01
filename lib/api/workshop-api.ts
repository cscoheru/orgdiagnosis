/**
 * Workshop API Client
 *
 * 与后端 /api/v1/workshop/* 端点交互。
 *
 * IMPORTANT: Kernel objects use _key (e.g. "1") for URL paths,
 * not _id (e.g. "sys_objects/1") which contains a "/" that
 * breaks FastAPI path parsing. The `toKeyId()` helper extracts _key
 * from kernel objects for use in URLs.
 */

import { API_BASE_URL } from "@/lib/api-config";

// ──────────────────────────────────────────────
// 类型定义
// ──────────────────────────────────────────────

export interface WorkshopSession {
  _key: string;
  _id: string;
  model_key: string;
  properties: {
    title: string;
    industry_context: string;
    project_id?: string;
  };
}

export interface CanvasNode {
  _key: string;
  _id: string;
  model_key: string;
  properties: {
    name: string;
    node_type: "scene" | "painpoint" | "idea" | "task";
    description?: string;
    workshop_id: string;
  };
}

export interface CanvasRelation {
  _key: string;
  _id: string;
  from_obj_id: string;
  to_obj_id: string;
  relation_type: string;
}

export interface EvaluationItem {
  _key: string;
  _id: string;
  model_key: string;
  properties: {
    name: string;
    dim_x: number;
    dim_y: number;
    dim_z: number;
    dim_w: number;
    workshop_id: string;
  };
}

export interface TagCategory {
  _key: string;
  _id: string;
  properties: {
    name: string;
    color: string;
    display_order: number;
    workshop_id: string;
  };
}

export interface SmartTag {
  _key: string;
  _id: string;
  properties: {
    name: string;
    color: string;
    category_id?: string;
    workshop_id: string;
  };
}

export interface SessionDetail {
  session: WorkshopSession;
  nodes: CanvasNode[];
  relations: CanvasRelation[];
}

export interface AiSuggestion {
  name: string;
  type: string;
  reason: string;
}

export interface AiTagSuggestion {
  name: string;
  is_new: boolean;
}

export interface ExportData {
  workshop_title: string;
  industry: string;
  items: ExportItem[];
}

export interface ExportItem {
  node_id: string;
  path: string;
  node_name: string;
  node_type: string;
  dim_x?: number;
  dim_y?: number;
  dim_z?: number;
  dim_w?: number;
  tags: string[];
}

// ──────────────────────────────────────────────
// ID Helper
// ──────────────────────────────────────────────

/** Extract _key (e.g. "1") from a kernel object or _id string for use in URL paths. */
function toKeyId(obj: { _key?: string; _id?: string } | string): string {
  if (typeof obj === "string") {
    return obj.startsWith("sys_objects/") ? obj.split("/", 1)[1] : obj;
  }
  return obj._key || (obj._id?.startsWith("sys_objects/") ? obj._id.split("/", 1)[1] : obj._id || "");
}

// ──────────────────────────────────────────────
// 通用请求
// ──────────────────────────────────────────────

async function workshopRequest<T>(path: string, options?: RequestInit): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/workshop${path}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `服务器错误 ${response.status}: ${text}` };
    }
    if (response.status === 204) return { success: true };
    const json = await response.json();
    return { success: true, data: json };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "网络错误" };
  }
}

// ──────────────────────────────────────────────
// Session API
// ──────────────────────────────────────────────

export async function createSession(title: string, industry_context: string, project_id?: string) {
  return workshopRequest<WorkshopSession>("/sessions", {
    method: "POST",
    body: JSON.stringify({ title, industry_context, project_id }),
  });
}

export async function listSessions(project_id?: string) {
  const params = project_id ? `?project_id=${encodeURIComponent(project_id)}` : "";
  return workshopRequest<WorkshopSession[]>(`/sessions${params}`);
}

export async function getSession(sessionId: string) {
  return workshopRequest<SessionDetail>(`/sessions/${toKeyId(sessionId)}`);
}

// ──────────────────────────────────────────────
// Node API
// ──────────────────────────────────────────────

export async function createNode(sessionId: string, name: string, nodeType: string, description?: string, parentNodeId?: string) {
  return workshopRequest<CanvasNode>(`/sessions/${toKeyId(sessionId)}/nodes`, {
    method: "POST",
    body: JSON.stringify({ name, node_type: nodeType, description, parent_node_id: parentNodeId }),
  });
}

export async function updateNode(sessionId: string, nodeId: string, patch: { name?: string; node_type?: string; description?: string }) {
  return workshopRequest<CanvasNode>(`/sessions/${toKeyId(sessionId)}/nodes/${toKeyId(nodeId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteNode(sessionId: string, nodeId: string) {
  return workshopRequest<void>(`/sessions/${toKeyId(sessionId)}/nodes/${toKeyId(nodeId)}`, {
    method: "DELETE",
  });
}

// ──────────────────────────────────────────────
// AI Suggest
// ──────────────────────────────────────────────

export async function suggestNodes(sessionId: string, data: {
  current_node_id: string;
  current_node_name: string;
  current_node_type: string;
  industry_context: string;
  existing_children: string[];
}) {
  return workshopRequest<{ suggestions: AiSuggestion[] }>(`/sessions/${toKeyId(sessionId)}/suggest`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ──────────────────────────────────────────────
// Evaluation API
// ──────────────────────────────────────────────

export async function listEvaluations(sessionId: string) {
  return workshopRequest<EvaluationItem[]>(`/sessions/${toKeyId(sessionId)}/evaluations`);
}

export async function createEvaluation(sessionId: string, data: { name: string; dim_x?: number; dim_y?: number; dim_z?: number; dim_w?: number }) {
  return workshopRequest<EvaluationItem>(`/sessions/${toKeyId(sessionId)}/evaluations`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateEvaluation(sessionId: string, evalId: string, patch: Partial<{ name: string; dim_x: number; dim_y: number; dim_z: number; dim_w: number }>) {
  return workshopRequest<EvaluationItem>(`/sessions/${toKeyId(sessionId)}/evaluations/${toKeyId(evalId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteEvaluation(sessionId: string, evalId: string) {
  return workshopRequest<void>(`/sessions/${toKeyId(sessionId)}/evaluations/${toKeyId(evalId)}`, {
    method: "DELETE",
  });
}

// ──────────────────────────────────────────────
// Tag API
// ──────────────────────────────────────────────

export async function listTags(sessionId: string) {
  return workshopRequest<Record<string, { category: TagCategory; tags: SmartTag[] }>>(`/sessions/${toKeyId(sessionId)}/tags`);
}

export async function createTag(sessionId: string, name: string, categoryId?: string, color?: string) {
  return workshopRequest<SmartTag>(`/sessions/${toKeyId(sessionId)}/tags`, {
    method: "POST",
    body: JSON.stringify({ name, category_id: categoryId, color: color || "#6b7280" }),
  });
}

export async function updateTag(sessionId: string, tagId: string, patch: { name?: string; color?: string; category_id?: string }) {
  return workshopRequest<SmartTag>(`/sessions/${toKeyId(sessionId)}/tags/${toKeyId(tagId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function suggestTags(sessionId: string, data: {
  target_text: string;
  node_id: string;
  existing_tags: { name: string; category: string }[];
}) {
  return workshopRequest<{
    context_tags: AiTagSuggestion[];
    pain_tags: AiTagSuggestion[];
    skill_tags: AiTagSuggestion[];
    format_tags: AiTagSuggestion[];
  }>(`/sessions/${toKeyId(sessionId)}/suggest-tags`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ──────────────────────────────────────────────
// Export API
// ──────────────────────────────────────────────

export async function exportSession(sessionId: string) {
  return workshopRequest<ExportData>(`/sessions/${toKeyId(sessionId)}/export`);
}

// ──────────────────────────────────────────────
// Relation helpers (via kernel API)
// ──────────────────────────────────────────────

import { createRelation } from "@/lib/api/kernel-client";

export { createRelation };
export async function tagNode(nodeId: string, tagId: string) {
  return createRelation(nodeId, tagId, "canvas_node_to_tag");
}

export async function untagNode(relationKey: string) {
  const { deleteRelation } = await import("@/lib/api/kernel-client");
  return deleteRelation(relationKey);
}
