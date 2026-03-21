'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Knowledge Base Entry Page
 * Redirects to dashboard by default
 */
export default function KnowledgePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/knowledge/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-500">正在跳转到知识库仪表盘...</p>
      </div>
    </div>
  );
}
