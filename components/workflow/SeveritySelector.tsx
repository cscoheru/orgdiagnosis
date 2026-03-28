'use client';

import { PAIN_SEVERITY_OPTIONS, type PainSeverity } from '@/lib/workflow/w1-types';

interface SeveritySelectorProps {
  value: PainSeverity;
  onChange: (severity: PainSeverity) => void;
}

export default function SeveritySelector({ value, onChange }: SeveritySelectorProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PAIN_SEVERITY_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            value === opt.value
              ? `${opt.bg} ${opt.color} ${opt.border}`
              : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
