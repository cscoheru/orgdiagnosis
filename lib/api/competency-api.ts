/**
 * Competency Co-pilot — API 客户端
 */

import type { CompetencyOutput, FinalModel } from '@/lib/workshop/competency-types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export async function fetchCompetencyMaterials(): Promise<CompetencyOutput> {
  const res = await fetch(`${API_BASE}/api/v1/competency/materials`);
  if (!res.ok) throw new Error('Failed to load competency data');
  const json = await res.json();
  return json.data;
}

export async function saveFinalModel(model: FinalModel): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/competency/model/final`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(model),
  });
  if (!res.ok) throw new Error('Failed to save final model');
}
