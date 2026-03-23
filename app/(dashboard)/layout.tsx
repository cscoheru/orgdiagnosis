'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { useAuth } from '@/lib/auth-context';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: string;
  badge?: string;
}

interface NavGroup {
  title: string;
  icon: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    title: '项目管理',
    icon: '🗂️',
    items: [
      { name: '我的项目', href: '/projects', icon: '📋' },
      { name: '新建项目', href: '/projects?new=true', icon: '➕' },
    ],
  },
  {
    title: '诊断中心',
    icon: '📊',
    items: [
      { name: '新建诊断', href: '/input', icon: '📝' },
      { name: '诊断结果', href: '/result', icon: '📈' },
    ],
  },
  {
    title: '知识库',
    icon: '📚',
    items: [
      { name: '仪表盘', href: '/knowledge/dashboard', icon: '📊' },
      { name: '智能检索', href: '/knowledge/search', icon: '🔍' },
      { name: '文档管理', href: '/knowledge/documents', icon: '📄' },
      { name: '上传中心', href: '/knowledge/upload', icon: '⬆️' },
    ],
  },
  {
    title: '报告工坊',
    icon: '📑',
    items: [
      { name: '需求录入', href: '/report', icon: '📋' },
      { name: '内容编辑', href: '/report/workspace', icon: '✏️' },
      { name: '报告历史', href: '/history', icon: '📁' },
    ],
  },
  {
    title: '资源管理',
    icon: '🎨',
    items: [
      { name: 'Layout 图形库', href: '/layouts', icon: '⊞' },
      { name: '母版管理', href: '/templates', icon: '📄' },
    ],
  },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        <span className="text-xl">{sidebarOpen ? '✕' : '☰'}</span>
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-xl">◈</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">咨询的天空</h1>
              <p className="text-xs text-gray-500">企业管理咨询解决方案中心</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
            {navigationGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                {/* Group Header */}
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <span>{group.icon}</span>
                  <span>{group.title}</span>
                </div>
                {/* Group Items */}
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm">{item.name}</span>
                      {item.badge && (
                        <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Footer / User Section */}
          <div className="px-4 py-4 border-t border-gray-200">
            {loading ? (
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            ) : user ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 px-2 py-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user.email?.[0].toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.email}
                    </p>
                    <p className="text-xs text-gray-500">已登录</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span>🚪</span>
                  <span>退出登录</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-3 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors"
              >
                <span className="text-lg">🔐</span>
                <span className="text-sm font-medium">登录 / 注册</span>
              </Link>
            )}
            <p className="text-xs text-gray-400 mt-3 px-2">
              Powered by 智谱 GLM-4
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
