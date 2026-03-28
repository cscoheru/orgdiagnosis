'use client';

import { INDUSTRY_OPTIONS } from '@/lib/workflow/w1-types';

interface IndustryDropdownProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export default function IndustryDropdown({ value, onChange, error }: IndustryDropdownProps) {
  return (
    <div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
          error ? 'border-red-300' : 'border-gray-200'
        }`}
      >
        <option value="">请选择行业类型</option>
        {INDUSTRY_OPTIONS.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
