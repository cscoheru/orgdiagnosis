'use client';

/**
 * Skeleton loading states for AI analysis pages
 */

export function SkeletonRadar() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 rounded-full bg-gray-200"></div>
        <div className="h-4 w-24 rounded bg-gray-200"></div>
      </div>
      <div className="flex justify-center py-8">
        <div className="w-64 h-64 rounded-full border-4 border-gray-200"></div>
      </div>
      <div className="space-y-2 max-w-md mx-auto">
        <div className="h-3 w-full rounded bg-gray-200"></div>
        <div className="h-3 w-4/5 rounded bg-gray-200"></div>
        <div className="h-3 w-3/5 rounded bg-gray-200"></div>
      </div>
    </div>
  );
}

export function SkeletonScoreBar() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between">
            <div className="h-3 w-16 rounded bg-gray-200"></div>
            <div className="h-3 w-8 rounded bg-gray-200"></div>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200"></div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse space-y-3">
      <div className="h-5 w-1/3 rounded bg-gray-200"></div>
      <div className="h-3 w-full rounded bg-gray-200"></div>
      <div className="h-3 w-5/6 rounded bg-gray-200"></div>
      <div className="h-3 w-2/3 rounded bg-gray-200"></div>
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 w-48 rounded bg-gray-200"></div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-8 w-32 rounded bg-gray-200"></div>
          <div className="h-8 w-32 rounded bg-gray-200"></div>
          <div className="h-8 w-32 rounded bg-gray-200"></div>
        </div>
      ))}
    </div>
  );
}
