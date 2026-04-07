'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  FolderKanban,
  BookOpen,
  Settings,
  Cpu,
  FileText,
  Layers,
  LogOut,
  ChevronLeft,
  Menu,
  Sparkles,
  Brain,
  Target,
} from 'lucide-react';

interface DashboardShellProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// Navigation is built dynamically inside the component based on project context

export default function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);

  // Detect current project ID from URL for project-scoped tools
  const projectIdMatch = pathname.match(/^\/projects\/([^/]+)/);
  const currentProjectId = projectIdMatch ? projectIdMatch[1] : null;

  // Build navigation groups — include collaboration tools when inside a project
  const navigationGroups: NavGroup[] = [
    {
      title: '工作台',
      items: [
        { name: '项目总览', href: '/projects', icon: <LayoutDashboard size={18} /> },
        { name: '知识库', href: '/knowledge', icon: <BookOpen size={18} /> },
      ],
    },
    ...(currentProjectId ? [{
      title: '协作工具',
      items: [
        { name: '智能共创', href: `/projects/${currentProjectId}/cowork`, icon: <Sparkles size={18} /> },
        { name: '能力研讨', href: `/projects/${currentProjectId}/competency`, icon: <Brain size={18} /> },
        { name: '战略解码', href: `/projects/${currentProjectId}/strategy`, icon: <Target size={18} /> },
      ],
    }] : []),
    {
      title: '系统',
      items: [
        { name: '内核管理', href: '/kernel', icon: <Cpu size={18} /> },
        { name: '系统设置', href: '/settings', icon: <Settings size={18} /> },
        { name: 'PPT 模板', href: '/templates', icon: <FileText size={18} /> },
        { name: '版式管理', href: '/layouts', icon: <Layers size={18} /> },
      ],
    },
  ];

  // Press H to toggle sidebar (presentation mode)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'h' && !e.ctrlKey && !e.metaKey && !e.altKey
          && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setSidebarHidden((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
        {sidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
      </button>

      {/* Desktop sidebar toggle (presentation mode) */}
      <button
        onClick={() => setSidebarHidden(!sidebarHidden)}
        className="hidden lg:flex fixed top-4 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 transition-colors"
        style={{ left: sidebarHidden ? '16px' : '272px' }}
        title="按 H 切换侧边栏"
      >
        {sidebarHidden ? <Menu size={16} className="text-gray-500" /> : <ChevronLeft size={16} className="text-gray-500" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transition-transform duration-200 ease-in-out ${
          // Mobile: hidden by default, visible when sidebarOpen
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          // Desktop: visible by default, hidden when sidebarHidden
          !sidebarHidden ? 'lg:translate-x-0' : ''
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
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {group.title}
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
                      {item.icon}
                      <span className="text-sm">{item.name}</span>
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
                  <LogOut size={16} />
                  <span>退出登录</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-3 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors"
              >
                <FolderKanban size={18} />
                <span className="text-sm font-medium">登录 / 注册</span>
              </Link>
            )}
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
      <main className={`min-h-screen transition-[margin] duration-200 ease-in-out ${sidebarHidden ? '' : 'lg:ml-64'}`}>
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
