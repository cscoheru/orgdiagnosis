'use client';

import { useState, useEffect } from 'react';
import { getAllLayouts, LayoutInfo, LayoutCategory } from '@/lib/report-api';

// Fallback layouts when API is not available
const FALLBACK_CATEGORIES: LayoutCategory[] = [
  {
    category_id: 'MATRIX',
    category_label: '矩阵布局',
    layouts: [
      { layout_id: 'MATRIX_2X2', layout_name: '2×2 矩阵', category: 'MATRIX', description: '四象限分析，如SWOT、BCG矩阵', element_count_range: [4, 4], keywords: ['矩阵', '四象限'] },
      { layout_id: 'MATRIX_3X3', layout_name: '3×3 矩阵', category: 'MATRIX', description: '九宫格分析，优先级矩阵', element_count_range: [9, 9], keywords: ['九宫格'] },
    ],
    count: 2,
  },
  {
    category_id: 'PROCESS',
    category_label: '流程布局',
    layouts: [
      { layout_id: 'PROCESS_HORIZONTAL', layout_name: '横向流程', category: 'PROCESS', description: '3-6步横向流程展示', element_count_range: [3, 6], keywords: ['流程'] },
      { layout_id: 'PROCESS_VERTICAL', layout_name: '纵向流程', category: 'PROCESS', description: '自上而下的流程步骤', element_count_range: [3, 6], keywords: ['流程'] },
      { layout_id: 'PROCESS_CIRCULAR', layout_name: '循环流程', category: 'PROCESS', description: '闭环流程，持续改进', element_count_range: [4, 6], keywords: ['循环'] },
    ],
    count: 3,
  },
  {
    category_id: 'PARALLEL',
    category_label: '并列布局',
    layouts: [
      { layout_id: 'PARALLEL_CARDS', layout_name: '并列卡片', category: 'PARALLEL', description: '3-6个并列要点', element_count_range: [3, 6], keywords: ['并列'] },
      { layout_id: 'PARALLEL_ICONS', layout_name: '图标并列', category: 'PARALLEL', description: '带图标的关键要点', element_count_range: [3, 5], keywords: ['图标'] },
    ],
    count: 2,
  },
  {
    category_id: 'TABLE',
    category_label: '对比布局',
    layouts: [
      { layout_id: 'TABLE_PRO_CON', layout_name: '对比表格', category: 'TABLE', description: '优劣对比，方案比较', element_count_range: [2, 4], keywords: ['对比'] },
      { layout_id: 'TABLE_BEFORE_AFTER', layout_name: '前后对比', category: 'TABLE', description: '变革前后对比', element_count_range: [2, 2], keywords: ['前后'] },
    ],
    count: 2,
  },
  {
    category_id: 'TIMELINE',
    category_label: '时间线',
    layouts: [
      { layout_id: 'MILESTONE', layout_name: '里程碑', category: 'TIMELINE', description: '项目关键节点', element_count_range: [3, 6], keywords: ['里程碑'] },
      { layout_id: 'TIMELINE_HORIZONTAL', layout_name: '横向时间线', category: 'TIMELINE', description: '按时间顺序展示', element_count_range: [4, 6], keywords: ['时间线'] },
    ],
    count: 2,
  },
  {
    category_id: 'DATA_VIZ',
    category_label: '数据可视化',
    layouts: [
      { layout_id: 'RADAR_DATA', layout_name: '雷达图', category: 'DATA_VIZ', description: '多维度评估对比', element_count_range: [5, 8], keywords: ['雷达'] },
      { layout_id: 'BAR_CHART', layout_name: '柱状图', category: 'DATA_VIZ', description: '数据对比展示', element_count_range: [4, 6], keywords: ['柱状图'] },
    ],
    count: 2,
  },
  {
    category_id: 'KEY_INSIGHT',
    category_label: '核心观点',
    layouts: [
      { layout_id: 'KEY_INSIGHT', layout_name: '核心观点', category: 'KEY_INSIGHT', description: '单一核心观点强调', element_count_range: [1, 1], keywords: ['核心'] },
      { layout_id: 'SUMMARY_3KEY', layout_name: '三点总结', category: 'KEY_INSIGHT', description: '三个关键结论', element_count_range: [3, 3], keywords: ['总结'] },
    ],
    count: 2,
  },
];

interface LayoutSelectorProps {
  currentLayout: string;
  elementCount: number;
  onLayoutChange: (layoutId: string) => void;
  className?: string;
}

export default function LayoutSelector({
  currentLayout,
  elementCount,
  onLayoutChange,
  className = '',
}: LayoutSelectorProps) {
  const [categories, setCategories] = useState<LayoutCategory[]>(FALLBACK_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch layouts from API
  useEffect(() => {
    const fetchLayouts = async () => {
      try {
        const data = await getAllLayouts();
        if (data.categories && data.categories.length > 0) {
          setCategories(data.categories);
        }
      } catch (e) {
        console.warn('[LayoutSelector] Failed to fetch layouts, using fallback:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchLayouts();
  }, []);

  // Find which category the current layout belongs to
  const findCurrentCategory = () => {
    for (const cat of categories) {
      if (cat.layouts.some(l => l.layout_id === currentLayout)) {
        return cat.category_id;
      }
    }
    return 'PARALLEL';
  };

  // Get recommended layouts based on element count
  const getRecommendedLayouts = (): LayoutInfo[] => {
    const recommendations: LayoutInfo[] = [];

    for (const cat of categories) {
      for (const layout of cat.layouts) {
        const [min, max] = layout.element_count_range;
        if (elementCount >= min && elementCount <= max) {
          recommendations.push(layout);
        }
      }
    }

    return recommendations.slice(0, 6);
  };

  // Filter layouts by search
  const getFilteredLayouts = (): Array<{ category: LayoutCategory; layout: LayoutInfo }> => {
    if (!searchQuery) return [];

    const results: Array<{ category: LayoutCategory; layout: LayoutInfo }> = [];

    for (const cat of categories) {
      for (const layout of cat.layouts) {
        if (
          layout.layout_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          layout.description.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          results.push({ category: cat, layout });
        }
      }
    }

    return results;
  };

  const currentCategory = selectedCategory || findCurrentCategory();
  const recommendedLayouts = getRecommendedLayouts();
  const filteredLayouts = getFilteredLayouts();
  const categoryLayouts = selectedCategory
    ? categories.find(c => c.category_id === selectedCategory)?.layouts || []
    : null;

  // Get source badge (for uploaded layouts)
  const getSourceBadge = (source?: string) => {
    if (!source || source === 'default') return null;
    return (
      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded">
        自定义
      </span>
    );
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
        <h3 className="font-semibold text-gray-900">布局选择器</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {loading ? '加载中...' : `共 ${categories.reduce((sum, c) => sum + c.count, 0)} 个布局`}
        </p>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <input
            type="text"
            placeholder="搜索布局..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="p-3 space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto">
        {/* Search Results */}
        {searchQuery && filteredLayouts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">搜索结果</h4>
            <div className="grid grid-cols-1 gap-2">
              {filteredLayouts.map(({ category, layout }) => (
                <button
                  key={layout.layout_id}
                  onClick={() => onLayoutChange(layout.layout_id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    currentLayout === layout.layout_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{layout.layout_name}</span>
                    {getSourceBadge(layout.source)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{layout.description}</p>
                  <span className="text-[10px] text-gray-400">{category.category_label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Default View */}
        {!searchQuery && (
          <>
            {/* Current Element Count */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded-lg text-xs">
              <span className="text-gray-500">当前要素数</span>
              <span className="font-medium text-gray-900">{elementCount} 个</span>
            </div>

            {/* Recommended Layouts */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <span>⭐</span> 推荐布局
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {recommendedLayouts.map((layout) => (
                  <button
                    key={layout.layout_id}
                    onClick={() => onLayoutChange(layout.layout_id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      currentLayout === layout.layout_id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{layout.layout_name}</span>
                      {getSourceBadge(layout.source)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{layout.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Category Tabs */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">按类别浏览</h4>
              <div className="flex flex-wrap gap-1">
                {categories.map((cat) => (
                  <button
                    key={cat.category_id}
                    onClick={() => setSelectedCategory(selectedCategory === cat.category_id ? null : cat.category_id)}
                    className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                      selectedCategory === cat.category_id
                        ? 'bg-blue-600 text-white'
                        : currentCategory === cat.category_id
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat.category_label} ({cat.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Category Layouts */}
            {categoryLayouts && categoryLayouts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {categories.find(c => c.category_id === selectedCategory)?.category_label}
                  </h4>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    关闭
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {categoryLayouts.map((layout) => (
                    <button
                      key={layout.layout_id}
                      onClick={() => onLayoutChange(layout.layout_id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        currentLayout === layout.layout_id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{layout.layout_name}</span>
                        {getSourceBadge(layout.source)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{layout.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400">
                          {layout.element_count_range[0]}-{layout.element_count_range[1]} 要素
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
