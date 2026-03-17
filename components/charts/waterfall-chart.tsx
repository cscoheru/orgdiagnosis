'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { DimensionData, BarChartData, L3Item } from '@/types/diagnosis';
import { getScoreColor } from '@/types/diagnosis';

interface DimensionBarChartProps {
  dimensionKey: string;
  data: DimensionData;
}

export function DimensionBarChart({ dimensionKey, data }: DimensionBarChartProps) {
  const [expandedL2, setExpandedL2] = useState<string | null>(null);

  // L2 维度数据
  const chartData: BarChartData[] = Object.entries(data.L2_categories).map(
    ([key, category]) => ({
      name: category.label || key,
      score: category.score,
      category: key,
    })
  );

  // 切换 L2 展开状态
  const toggleL2 = (l2Key: string) => {
    setExpandedL2(expandedL2 === l2Key ? null : l2Key);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {/* 维度标题 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{data.label}</h3>
          <p className="text-sm text-gray-500">{data.description}</p>
        </div>
        <span
          className="px-3 py-1 rounded-full text-sm font-medium"
          style={{
            backgroundColor: `${getScoreColor(data.score)}20`,
            color: getScoreColor(data.score),
          }}
        >
          {data.score} 分
        </span>
      </div>

      {/* L2 维度条形图 */}
      <div className="h-48 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fill: '#374151', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value) => [`${value} 分`, '评分']}
            />
            <Bar
              dataKey="score"
              radius={[0, 4, 4, 0]}
              barSize={20}
              className="cursor-pointer"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getScoreColor(entry.score)}
                  stroke={expandedL2 === entry.category ? '#3b82f6' : 'none'}
                  strokeWidth={2}
                  onClick={() => toggleL2(entry.category)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 点击提示 */}
      <p className="text-xs text-gray-400 text-center mb-3">点击条形查看 L3 详情</p>

      {/* L3 详情展开 */}
      {expandedL2 && data.L2_categories[expandedL2] && (
        <div className="border-t border-gray-100 pt-4 mt-2">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            {data.L2_categories[expandedL2].label} - L3 评估项
          </h4>
          <div className="space-y-3">
            {Object.entries(data.L2_categories[expandedL2].L3_items).map(
              ([l3Key, item]) => (
                <L3ItemCard key={l3Key} l3Key={l3Key} item={item} />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * L3 评估项卡片
 */
function L3ItemCard({ l3Key, item }: { l3Key: string; item: L3Item }) {
  // 从 key 生成中文标签
  const labelMap: Record<string, string> = {
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

  const label = labelMap[l3Key] || l3Key;
  const confidenceColors = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-600',
  };
  const confidenceLabels = {
    high: '高置信',
    medium: '中置信',
    low: '低置信',
  };

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-bold"
            style={{ color: getScoreColor(item.score) }}
          >
            {item.score}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${confidenceColors[item.confidence]}`}
          >
            {confidenceLabels[item.confidence]}
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{item.evidence}</p>
    </div>
  );
}
