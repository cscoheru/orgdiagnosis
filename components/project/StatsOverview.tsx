'use client';

import { FolderKanban, Clock, CheckCircle2, TrendingUp } from 'lucide-react';

interface Stats {
  total: number;
  active: number;
  completed: number;
  recent: number;
}

interface StatsOverviewProps {
  stats: Stats;
}

export default function StatsOverview({ stats }: StatsOverviewProps) {
  const cards = [
    {
      label: '全部项目',
      value: stats.total,
      icon: <FolderKanban className="w-5 h-5 text-gray-400" />,
      color: 'text-gray-900',
    },
    {
      label: '进行中',
      value: stats.active,
      icon: <Clock className="w-5 h-5 text-blue-400" />,
      color: 'text-blue-700',
    },
    {
      label: '已完成',
      value: stats.completed,
      icon: <CheckCircle2 className="w-5 h-5 text-green-400" />,
      color: 'text-green-700',
    },
    {
      label: '本月新增',
      value: stats.recent,
      icon: <TrendingUp className="w-5 h-5 text-purple-400" />,
      color: 'text-purple-700',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(card => (
        <div
          key={card.label}
          className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3"
        >
          {card.icon}
          <div>
            <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-500">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
