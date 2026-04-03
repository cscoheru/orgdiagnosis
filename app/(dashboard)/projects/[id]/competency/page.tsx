'use client';

/**
 * 项目内能力研讨 — 能力模型分析与学习资源盘点
 *
 * 复用 CompetencyExplorer 组件。
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import CompetencyExplorer from '@/components/workshop/CompetencyExplorer';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type ModelType = 'delivery_management' | 'business_management';
type CompetencyTerm = {
  id: string;
  term: string;
  description?: string;
  score: number;
  origin: 'seed' | 'discovered';
  model: ModelType;
  sources: string[];
  secondary_terms: any[];
};

export default function CompetencyPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [competencies, setCompetencies] = useState<CompetencyTerm[]>([]);
  const [confirmedL1Terms, setConfirmedL1Terms] = useState<Record<ModelType, string[]>>({
    delivery_management: [],
    business_management: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/competency/materials?project_id=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.items || []);
          setCompetencies(items);
        }

        // Fetch confirmed model
        const modelRes = await fetch(`${API_BASE}/api/v1/competency/final-model?project_id=${projectId}`);
        if (modelRes.ok) {
          const modelData = await modelRes.json();
          if (modelData.confirmed_l1_terms) {
            setConfirmedL1Terms(modelData.confirmed_l1_terms);
          }
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    fetchData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">能力研讨</h2>
        <p className="text-sm text-gray-500">构建组织能力模型，识别关键能力项与行为标准</p>
      </div>
      <CompetencyExplorer
        competencies={competencies}
        confirmedL1Terms={confirmedL1Terms}
      />
    </div>
  );
}
