'use client';

import Link from 'next/link';
import { useState } from 'react';

const settingsSections = [
  {
    name: '内核管理',
    description: '元模型、对象、关系和图谱管理',
    href: '/settings/kernel',
    icon: '⚙️',
  },
  {
    name: 'AI 配置',
    description: 'AI 模型选择、提示词模板和参数调优',
    href: '/settings/ai',
    icon: '🤖',
    badge: 'coming soon',
  },
  {
    name: '导出配置',
    description: 'PPT 模板、布局样式和导出格式设置',
    href: '/settings/export',
    icon: '📄',
    badge: 'coming soon',
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-gray-500 mt-1">系统配置和管理</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsSections.map(section => (
          <Link
            key={section.name}
            href={section.href}
            className={`bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow ${
              section.badge ? 'opacity-70 pointer-events-none' : ''
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{section.icon}</span>
              <div>
                <h2 className="text-lg font-medium flex items-center gap-2">
                  {section.name}
                  {section.badge && (
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                      {section.badge}
                    </span>
                  )}
                </h2>
              </div>
            </div>
            <p className="text-sm text-gray-500">{section.description}</p>
          </Link>
        ))}
      </div>

      {/* System info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-medium text-gray-700 mb-4">系统信息</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">API 地址</span>
            <p className="text-gray-900 mt-0.5 font-mono text-xs">
              {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}
            </p>
          </div>
          <div>
            <span className="text-gray-500">环境</span>
            <p className="text-gray-900 mt-0.5">
              {process.env.NODE_ENV === 'production' ? '生产' : '开发'}
            </p>
          </div>
          <div>
            <span className="text-gray-500">内核模式</span>
            <p className="text-gray-900 mt-0.5">
              {process.env.NEXT_PUBLIC_KERNEL_MODE || 'demo'}
            </p>
          </div>
          <div>
            <span className="text-gray-500">版本</span>
            <p className="text-gray-900 mt-0.5">2.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
