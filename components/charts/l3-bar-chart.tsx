'use client';

import { useState, useEffect } from 'react';
import type { L2Category, L3Item } from '@/types/diagnosis';
import { getScoreColor } from '@/types/diagnosis';

interface L3BarChartProps {
  data: L2Category;
}

// L3 中文标签映射
const L3_LABELS: Record<string, string> = {
  // 战略 - 业务现状
  performance_gap: '业绩差距',
  opportunity_gap: '机会差距',
  // 战略 - 战略规划
  market_insight: '市场洞察',
  strategic_intent: '战略意图',
  innovation_focus: '创新焦点',
  business_design: '业务设计',
  // 战略 - 战略执行
  critical_tasks: '关键任务',
  organizational_support: '组织支撑',
  talent_readiness: '人才准备',
  corporate_culture: '企业文化',
  // 战略 - 战略评估
  business_analysis: '经营分析',
  execution_evaluation: '执行评价',
  strategy_iteration: '战略迭代',
  // 组织 - 组织架构
  structure_type: '架构形态',
  layers_and_span: '管理层级',
  departmental_boundaries: '部门边界',
  // 组织 - 权责分配
  decision_mechanism: '决策机制',
  delegation_system: '授权体系',
  role_definitions: '岗位指引',
  // 组织 - 协同流程
  core_processes: '核心流程',
  cross_functional_collaboration: '跨部门协作',
  process_digitalization: '流程数字化',
  // 组织 - 组织效能
  per_capita_efficiency: '人效指标',
  agility: '响应速度',
  // 绩效 - 体系设计
  goal_setting_tools: '目标设定',
  metric_cascading: '指标分解',
  weights_and_standards: '权重标准',
  // 绩效 - 过程管理
  goal_tracking: '目标跟进',
  performance_coaching: '绩效辅导',
  data_collection: '数据收集',
  // 绩效 - 考核反馈
  appraisal_fairness: '考核公平',
  feedback_quality: '面谈质量',
  grievance_mechanism: '申诉机制',
  // 绩效 - 结果应用
  link_to_rewards: '激励挂钩',
  promotion_and_elimination: '晋升淘汰',
  link_to_learning_and_development: '培训发展',
  // 薪酬 - 薪酬策略
  market_positioning: '市场定位',
  fixed_vs_variable_mix: '固浮比',
  internal_equity: '内部公平',
  // 薪酬 - 薪酬结构
  base_pay: '基本工资',
  short_term_incentives: '短期激励',
  long_term_incentives: '长期激励',
  benefits_and_allowances: '弹性福利',
  // 薪酬 - 管理预算
  payroll_management: '总额管控',
  salary_adjustment: '调薪机制',
  pay_transparency: '薪酬沟通',
  // 人才 - 规划盘点
  competency_models: '胜任力模型',
  talent_review: '人才盘点',
  pipeline_health: '梯队健康',
  // 人才 - 获取配置
  employer_branding: '雇主品牌',
  recruitment_precision: '招聘精准',
  internal_mobility: '内部流动',
  // 人才 - 培养发展
  onboarding: '融入体系',
  leadership_development: '骨干培养',
  career_pathways: '职业通道',
  // 人才 - 保留激励
  key_talent_turnover: '核心流失率',
  employee_engagement: '员工敬业',
  non_financial_incentives: '非物质激励',
};

export function L3BarChart({ data }: L3BarChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 准备柱状图数据
  const chartData = Object.entries(data.L3_items)
    .filter(([_, item]) => item.score !== null && item.score !== undefined)
    .map(([key, item]) => ({
      key,
      name: L3_LABELS[key] || key,
      score: item.score,
      evidence: item.evidence,
      confidence: item.confidence,
    }))
    .sort((a, b) => b.score - a.score); // 按分数降序排列

  if (chartData.length === 0) {
    return (
      <div className="text-center text-gray-400 py-4">
        暂无 L3 评估数据
      </div>
    );
  }

  return (
    <div>
      {/* 柱状图 */}
      <div style={{ height: Math.max(150, chartData.length * 32 + 50) }}>
        {mounted ? (
          (() => {
            const {
              BarChart,
              Bar,
              XAxis,
              YAxis,
              ResponsiveContainer,
              Cell,
              LabelList,
            } = require('recharts');

            return (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 60, left: 5, bottom: 5 }}
                >
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tick={{ fill: '#374151', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
                    ))}
                    <LabelList
                      dataKey="score"
                      position="right"
                      formatter={(value: number) => `${value}`}
                      style={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            );
          })()
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-gray-400 text-sm">加载图表...</div>
          </div>
        )}
      </div>

      {/* L3 详情列表 */}
      <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
        {chartData.map((item) => (
          <div
            key={item.key}
            className="bg-gray-50 rounded-lg p-3 text-sm"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-800">{item.name}</span>
              <div className="flex items-center gap-2">
                <span
                  className="font-bold"
                  style={{ color: getScoreColor(item.score) }}
                >
                  {item.score}
                </span>
                <ConfidenceBadge confidence={item.confidence} />
              </div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {item.evidence}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 置信度徽章
 */
function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const styles = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-500',
  };
  const labels = {
    high: '高',
    medium: '中',
    low: '低',
  };

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${styles[confidence]}`}>
      {labels[confidence]}
    </span>
  );
}
