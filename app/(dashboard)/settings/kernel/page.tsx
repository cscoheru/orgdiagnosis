'use client';

/**
 * Kernel Management Page
 * Re-exported from the original /kernel pages.
 * This page wraps the kernel dashboard as a settings sub-page.
 */

import dynamic from 'next/dynamic';

// Dynamically import the kernel page from the original location
const KernelPage = dynamic(
  () => import('@/app/(dashboard)/kernel/page'),
  { loading: () => <div className="text-center py-12 text-gray-400">加载内核管理...</div> }
);

export default function SettingsKernelPage() {
  return <KernelPage />;
}
