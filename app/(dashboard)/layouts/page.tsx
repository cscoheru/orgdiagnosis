'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDefinition,
  LayoutCategory,
  LAYOUT_CATEGORY_LABELS,
  LAYOUT_CATEGORY_ICONS,
} from '@/lib/layout-types';
import { SYSTEM_LAYOUTS } from '@/lib/layout-api';

export default function LayoutLibraryPage() {
  const [layouts, setLayouts] = useState<LayoutDefinition[]>(SYSTEM_LAYOUTS);
  const [selectedCategory, setSelectedCategory] = useState<LayoutCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load layouts (system + custom from localStorage for demo)
    try {
      const customLayouts = JSON.parse(localStorage.getItem('customLayouts') || '[]');
      setLayouts([...SYSTEM_LAYOUTS, ...customLayouts]);
    } catch (e) {
      console.warn('Failed to load custom layouts:', e);
    }
    setLoading(false);
  }, []);

  // Filter layouts
  const filteredLayouts = layouts.filter((layout) => {
    const matchesCategory = !selectedCategory || layout.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      layout.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      layout.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group by category
  const groupedLayouts = filteredLayouts.reduce((acc, layout) => {
    const cat = layout.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(layout);
    return acc;
  }, {} as Record<LayoutCategory, LayoutDefinition[]>);

  const handleDeleteLayout = (id: string) => {
    if (confirm('确定要删除这个 Layout 吗？')) {
      const customLayouts = JSON.parse(localStorage.getItem('customLayouts') || '[]');
      const updated = customLayouts.filter((l: LayoutDefinition) => l.id !== id);
      localStorage.setItem('customLayouts', JSON.stringify(updated));
      setLayouts([...SYSTEM_LAYOUTS, ...updated]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Layout 智能图形库</h1>
            <p className="text-sm text-gray-500 mt-1">
              管理和使用智能图形模板，类似 PowerPoint SmartArt
            </p>
          </div>
          <Link
            href="/layouts/new/edit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建 Layout
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索 Layout..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                selectedCategory === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              全部 ({layouts.length})
            </button>
            {Object.entries(LAYOUT_CATEGORY_LABELS).map(([cat, label]) => {
              const count = layouts.filter(l => l.category === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat as LayoutCategory)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {LAYOUT_CATEGORY_ICONS[cat as LayoutCategory]} {label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Layout Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredLayouts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-400 text-4xl mb-4">📭</div>
          <p className="text-gray-500">没有找到匹配的 Layout</p>
        </div>
      ) : (
        <div className="space-y-6">
          {selectedCategory ? (
            // Single category view
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLayouts.map((layout) => (
                <LayoutCard key={layout.id} layout={layout} onDelete={handleDeleteLayout} />
              ))}
            </div>
          ) : (
            // Grouped view
            Object.entries(groupedLayouts).map(([category, categoryLayouts]) => (
              <div key={category}>
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span>{LAYOUT_CATEGORY_ICONS[category as LayoutCategory]}</span>
                  {LAYOUT_CATEGORY_LABELS[category as LayoutCategory]}
                  <span className="text-sm font-normal text-gray-400">({categoryLayouts.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryLayouts.map((layout) => (
                    <LayoutCard key={layout.id} layout={layout} onDelete={handleDeleteLayout} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Layout Card Component
function LayoutCard({
  layout,
  onDelete,
}: {
  layout: LayoutDefinition;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow group">
      {/* Preview */}
      <div className="aspect-video bg-gray-50 border-b border-gray-100 relative">
        <LayoutPreview layout={layout} />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Link
            href={`/layouts/${layout.id}/edit`}
            className="px-3 py-1.5 bg-white text-gray-900 rounded-lg text-sm hover:bg-gray-100"
          >
            编辑
          </Link>
          {!layout.isSystem && (
            <button
              onClick={() => onDelete(layout.id)}
              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
            >
              删除
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-gray-900">{layout.name}</h3>
          {layout.isSystem && (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">系统</span>
          )}
        </div>
        <p className="text-sm text-gray-500 line-clamp-2">{layout.description}</p>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
          <span>{layout.slots?.length || 0} 个槽位</span>
          <span>•</span>
          <span>{layout.nodes?.length || 0} 个元素</span>
        </div>
      </div>
    </div>
  );
}

// Simple Layout Preview
function LayoutPreview({ layout }: { layout: LayoutDefinition }) {
  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <div className="relative" style={{ transform: 'scale(0.5)', transformOrigin: 'center' }}>
        {layout.nodes.map((node) => (
          <div
            key={node.id}
            className="absolute flex items-center justify-center text-xs"
            style={{
              left: node.position.x,
              top: node.position.y,
              width: node.data.style?.width || 100,
              height: node.data.style?.height || 40,
              backgroundColor: node.data.style?.backgroundColor || '#f3f4f6',
              border: `1px solid ${node.data.style?.borderColor || '#d1d5db'}`,
              borderRadius: node.data.style?.borderRadius || 4,
              color: node.data.style?.textColor || '#374151',
              fontSize: node.data.style?.fontSize || 12,
            }}
          >
            {node.data.label}
          </div>
        ))}
      </div>
    </div>
  );
}
