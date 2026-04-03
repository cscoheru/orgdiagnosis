'use client';

/**
 * Kernel Management Page
 * Re-exported from the original /kernel pages.
 * This page wraps the kernel dashboard as a settings sub-page.
 */

import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import the kernel page from the original location
const KernelPage = dynamic(
  () => import('@/app/(dashboard)/kernel/page'),
  { loading: () => <div className="text-center py-12 text-gray-400">加载内核管理...</div> }
);

export default function SettingsKernelPage() {
  return (
    <div>
      <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          内核管理已迁移至
          <Link href="/settings/system" className="underline font-medium ml-1 text-yellow-900 hover:text-yellow-700">
            系统设置
          </Link>
          ，新增功能开关、工具注册表、Hook 拦截器、记忆巩固和后台任务管理。
        </p>
      </div>
      <KernelPage />
    </div>
  );
}
