'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewLayoutPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to edit page with new layout ID
    router.replace('/layouts/new/edit');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
