'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  MDSSingleSlide, EnhancedMilestonePlanData, DetailedOutlineData,
  OutlineSection, OutlineActivity, OutlineSlide, SlideType,
} from '@/lib/workflow/w1-types';
import {
  uid, createEmptyOutlineSection, createEmptyOutlineActivity,
  createEmptyOutlineSlide, mapOutlineResponse,
} from '@/lib/workflow/w1-types';
import DynamicListInput from './DynamicListInput';
import { exportOutlineToMD } from '@/lib/workflow/export-md';

const SLIDE_TYPE_LABELS: Record<SlideType, string> = {
  content: '内容',
  methodology: '方法论',
  case: '案例',
};

const SLIDE_TYPE_COLORS: Record<SlideType, string> = {
  content: 'bg-blue-50 text-blue-700 border-blue-200',
  methodology: 'bg-purple-50 text-purple-700 border-purple-200',
  case: 'bg-amber-50 text-amber-700 border-amber-200',
};

interface ImplementationOutlineStepProps {
  mdsData: MDSSingleSlide | null;
  planData: EnhancedMilestonePlanData | null;
  outlineData: DetailedOutlineData | null;
  onGenerateSection: (sectionIndex: number) => void;
  onGenerateActivity: (sectionIndex: number, activityIndex: number) => void;
  onConfirm: (data: DetailedOutlineData) => void;
  generatingSection: number | null;
  generatingActivity: [number, number] | null;
  error?: string | null;
}

export default function ImplementationOutlineStep({
  mdsData,
  planData,
  outlineData,
  onGenerateSection,
  onGenerateActivity,
  onConfirm,
  generatingSection,
  generatingActivity,
  error,
}: ImplementationOutlineStepProps) {
  const [data, setData] = useState<DetailedOutlineData | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [expandedSlides, setExpandedSlides] = useState<Set<string>>(new Set());

  // Initialize: restore from outlineData, or create from planData
  useEffect(() => {
    if (outlineData && outlineData.sections.length > 0) {
      setData(outlineData);
      setExpandedSections(new Set(outlineData.sections.map(s => s.id)));
    } else if (planData && planData.phases.length > 0) {
      // Auto-create L1 (sections) and L2 (activities) from planData
      const sections: OutlineSection[] = planData.phases.map(phase => {
        const activities: OutlineActivity[] = (phase.key_activities || []).map(name =>
          createEmptyOutlineActivity(name),
        );
        return {
          id: uid(),
          section_name: phase.phase_name,
          activities,
        };
      });
      setData({ sections });
      setExpandedSections(new Set(sections.map(s => s.id)));
    }
  }, [outlineData, planData]);

  // ── Expand/collapse ──

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Section operations ──

  const updateSectionName = (si: number, name: string) => {
    if (!data) return;
    const updated = { ...data, sections: [...data.sections] };
    updated.sections[si] = { ...updated.sections[si], section_name: name };
    setData(updated);
  };

  const removeSection = (si: number) => {
    if (!data) return;
    setData({ ...data, sections: data.sections.filter((_, i) => i !== si) });
  };

  const addSection = () => {
    if (!data) return;
    setData({
      ...data,
      sections: [...data.sections, createEmptyOutlineSection(`阶段 ${data.sections.length + 1}`)],
    });
  };

  // ── Activity operations ──

  const updateActivityName = (si: number, ai: number, name: string) => {
    if (!data) return;
    const updated = { ...data, sections: [...data.sections] };
    const section = { ...updated.sections[si], activities: [...updated.sections[si].activities] };
    section.activities[ai] = { ...section.activities[ai], activity_name: name };
    updated.sections[si] = section;
    setData(updated);
  };

  const removeActivity = (si: number, ai: number) => {
    if (!data) return;
    const updated = { ...data, sections: [...data.sections] };
    const section = { ...updated.sections[si], activities: [...updated.sections[si].activities] };
    section.activities.splice(ai, 1);
    updated.sections[si] = section;
    setData(updated);
  };

  const addActivity = (si: number) => {
    if (!data) return;
    const updated = { ...data, sections: [...data.sections] };
    const section = { ...updated.sections[si], activities: [...updated.sections[si].activities] };
    section.activities.push(createEmptyOutlineActivity(`关键活动 ${section.activities.length + 1}`));
    updated.sections[si] = section;
    setData(updated);
  };

  // ── Slide operations ──

  const updateSlide = (si: number, ai: number, sli: number, field: string, value: string | string[] | SlideType) => {
    if (!data) return;
    const updated = { ...data, sections: [...data.sections] };
    const section = { ...updated.sections[si], activities: [...updated.sections[si].activities] };
    const activity = { ...section.activities[ai], slides: [...section.activities[ai].slides] };
    (activity.slides[sli] as any)[field] = value;
    section.activities[ai] = activity;
    updated.sections[si] = section;
    setData(updated);
  };

  const removeSlide = (si: number, ai: number, sli: number) => {
    if (!data) return;
    const updated = { ...data, sections: [...data.sections] };
    const section = { ...updated.sections[si], activities: [...updated.sections[si].activities] };
    const activity = { ...section.activities[ai], slides: [...section.activities[ai].slides] };
    activity.slides.splice(sli, 1);
    activity.slides.forEach((s, i) => { s.slide_index = i + 1; });
    section.activities[ai] = activity;
    updated.sections[si] = section;
    setData(updated);
  };

  const addSlide = (si: number, ai: number, slideType: SlideType = 'content') => {
    if (!data) return;
    const updated = { ...data, sections: [...data.sections] };
    const section = { ...updated.sections[si], activities: [...updated.sections[si].activities] };
    const activity = { ...section.activities[ai], slides: [...section.activities[ai].slides] };
    const newIdx = activity.slides.length + 1;
    activity.slides.push(createEmptyOutlineSlide(newIdx, slideType));
    section.activities[ai] = activity;
    updated.sections[si] = section;
    setData(updated);
  };

  // ── Stats ──

  const countSlides = useCallback((section: OutlineSection) =>
    section.activities.reduce((sum, a) => sum + a.slides.length, 0), []);

  const totalSlides = data?.sections.reduce((sum, s) => sum + countSlides(s), 0) || 0;

  const isGenerating = (si: number, ai?: number) => {
    if (generatingSection === si) return true;
    if (ai !== undefined && generatingActivity?.[0] === si && generatingActivity[1] === ai) return true;
    return false;
  };

  // ── Render helpers ──

  const renderSlide = (si: number, ai: number, slide: OutlineSlide, sli: number) => {
    const sk = `${si}-${ai}-${sli}`;
    const expanded = expandedSlides.has(sk);
    const colors = SLIDE_TYPE_COLORS[slide.slide_type];

    return (
      <div key={sk} className="border border-gray-100 rounded-lg overflow-hidden">
        {/* Slide header — use div, not button */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggle(setExpandedSlides, sk)}
          onKeyDown={(e) => e.key === 'Enter' && toggle(setExpandedSlides, sk)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="w-6 h-6 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
              {slide.slide_index}
            </span>
            <input
              type="text"
              value={slide.title}
              onChange={(e) => updateSlide(si, ai, sli, 'title', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 flex-1 min-w-0"
            />
            <select
              value={slide.slide_type}
              onChange={(e) => updateSlide(si, ai, sli, 'slide_type', e.target.value as SlideType)}
              onClick={(e) => e.stopPropagation()}
              className={`text-xs px-1.5 py-0.5 rounded border cursor-pointer flex-shrink-0 ${colors}`}
            >
              <option value="content">内容</option>
              <option value="methodology">方法论</option>
              <option value="case">案例</option>
            </select>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <button
              onClick={(e) => { e.stopPropagation(); removeSlide(si, ai, sli); }}
              className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
              title="删除"
            >
              ✕
            </button>
            <span className={`text-gray-400 text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </div>
        </div>

        {/* Slide details */}
        {expanded && (
          <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3">
            <div>
              <label className="text-xs font-medium text-gray-500">核心观点 (Storyline)</label>
              <textarea
                value={slide.storyline}
                onChange={(e) => updateSlide(si, ai, sli, 'storyline', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none mt-1"
                rows={2}
                placeholder="一句话概括本页要传达的核心信息"
              />
            </div>
            <DynamicListInput
              items={slide.arguments}
              onItemsChange={(v) => updateSlide(si, ai, sli, 'arguments', v)}
              label="论点"
              placeholder="输入论点后按回车"
              addButtonLabel="添加论点"
              rows={1}
            />
            <DynamicListInput
              items={slide.evidence}
              onItemsChange={(v) => updateSlide(si, ai, sli, 'evidence', v)}
              label="论据"
              placeholder="输入论据（数据/案例）后按回车"
              addButtonLabel="添加论据"
              rows={1}
            />
            <DynamicListInput
              items={slide.supporting_materials}
              onItemsChange={(v) => updateSlide(si, ai, sli, 'supporting_materials', v)}
              label="素材"
              placeholder="输入素材后按回车"
              addButtonLabel="添加素材"
              rows={1}
            />
          </div>
        )}
      </div>
    );
  };

  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
        请先完成上一步「MDS 幻灯片」
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      {/* MDS summary */}
      {mdsData && (
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">
              核心信息: <span className="font-medium text-gray-900">{mdsData.key_message}</span>
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-500">{mdsData.phases.length} 个阶段</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}

      {/* Sections */}
      <div className="space-y-3">
        {data.sections.map((section, si) => {
          const secExpanded = expandedSections.has(section.id);
          const slideCount = countSlides(section);
          const secGenerating = isGenerating(si);

          return (
            <div key={section.id} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* L1 Section header — div, not button */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(setExpandedSections, section.id)}
                  onKeyDown={(e) => e.key === 'Enter' && toggle(setExpandedSections, section.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                >
                  <span className={`text-gray-400 transition-transform ${secExpanded ? 'rotate-90' : ''}`}>▸</span>
                  <input
                    type="text"
                    value={section.section_name}
                    onChange={(e) => updateSectionName(si, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-sm text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0"
                  />
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {section.activities.length} 活动, {slideCount} 页
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <button
                    onClick={() => onGenerateSection(si)}
                    disabled={secGenerating}
                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 rounded border border-blue-200 disabled:opacity-50 transition-colors"
                  >
                    {secGenerating ? '生成中...' : 'AI 生成'}
                  </button>
                  <button
                    onClick={() => removeSection(si)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="删除阶段"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* L2 Activities */}
              {secExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  {section.activities.map((activity, ai) => {
                    const actExpanded = expandedActivities.has(activity.id);
                    const actGenerating = isGenerating(si, ai);

                    return (
                      <div key={activity.id} className="border border-gray-100 rounded-lg overflow-hidden">
                        {/* Activity header */}
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50/50">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => toggle(setExpandedActivities, activity.id)}
                            onKeyDown={(e) => e.key === 'Enter' && toggle(setExpandedActivities, activity.id)}
                            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                          >
                            <span className={`text-gray-400 transition-transform ${actExpanded ? 'rotate-90' : ''}`}>▸</span>
                            <input
                              type="text"
                              value={activity.activity_name}
                              onChange={(e) => updateActivityName(si, ai, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 flex-1 min-w-0"
                            />
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {activity.slides.length} 页
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => onGenerateActivity(si, ai)}
                              disabled={actGenerating}
                              className="px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100 rounded border border-blue-200 disabled:opacity-50 transition-colors"
                            >
                              {actGenerating ? '...' : 'AI'}
                            </button>
                            <button
                              onClick={() => removeActivity(si, ai)}
                              className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                              title="删除活动"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* L3 Slides */}
                        {actExpanded && (
                          <div className="px-3 pb-3 space-y-2">
                            {activity.slides.map((slide, sli) =>
                              renderSlide(si, ai, slide, sli),
                            )}
                            {/* Add slide buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => addSlide(si, ai, 'content')}
                                className="flex-1 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded border border-dashed border-gray-300 transition-colors"
                              >
                                + 内容页
                              </button>
                              <button
                                onClick={() => addSlide(si, ai, 'methodology')}
                                className="flex-1 py-1.5 text-xs text-purple-600 hover:bg-purple-50 rounded border border-dashed border-gray-300 transition-colors"
                              >
                                + 方法论页
                              </button>
                              <button
                                onClick={() => addSlide(si, ai, 'case')}
                                className="flex-1 py-1.5 text-xs text-amber-600 hover:bg-amber-50 rounded border border-dashed border-gray-300 transition-colors"
                              >
                                + 案例页
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add activity */}
                  <button
                    onClick={() => addActivity(si)}
                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg border border-dashed border-gray-300 transition-colors"
                  >
                    + 添加活动
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add section */}
      <button
        onClick={addSection}
        className="w-full py-3 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg border border-dashed border-gray-300 transition-colors"
      >
        + 添加阶段
      </button>

      {/* Stats */}
      <div className="text-xs text-gray-400 text-center">
        共 {data.sections.length} 个阶段, {data.sections.reduce((s, sec) => s + sec.activities.length, 0)} 个活动, {totalSlides} 页
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => data && exportOutlineToMD(data)}
          className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          导出 MD
        </button>
        <button
          onClick={() => onConfirm(data)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          确认 → 模板选择
        </button>
      </div>
    </div>
  );
}
