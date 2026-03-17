'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Dashboard 首页
 * 自动重定向到录入页面
 */
export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/input');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}
