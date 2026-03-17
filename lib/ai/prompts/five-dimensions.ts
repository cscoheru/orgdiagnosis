/**
 * 五维诊断 AI Prompt
 * 用于智谱 GLM 进行信息抽取和 L3 维度映射
 */

import fiveDimensionsSchema from '@/docs/five-dimensions-schema.json';

// 五维模型的简化版本（用于 Prompt）
const FIVE_DIMENSIONS_PROMPT = `
## 五维组织诊断模型

### 1. 战略 (Strategy) - 做正确的事
- 业务现状 (business_status)
  - performance_gap: 业绩差距 - 实际财务指标与预期目标的差距
  - opportunity_gap: 机会差距 - 错失的新市场、新产品或新客户机会
- 战略规划 (strategic_planning)
  - market_insight: 市场洞察 - 宏观环境、竞争对手与客户需求分析
  - strategic_intent: 战略意图 - 企业愿景、使命与中长期战略目标
  - innovation_focus: 创新焦点 - 未来的业务增长引擎与核心技术布局
  - business_design: 业务设计 - 商业模式、价值主张与盈利逻辑
- 战略执行 (strategy_execution)
  - critical_tasks: 关键任务 - 支撑业务设计的必赢之战
  - organizational_support: 组织支撑 - 组织阵型是否匹配关键任务
  - talent_readiness: 人才准备 - 核心岗位的人才数量与能力是否达标
  - corporate_culture: 企业文化 - 团队氛围与价值观是否支持战略落地
- 战略评估 (strategy_evaluation)
  - business_analysis: 经营分析 - 战略解码后的财务与运营指标监控
  - execution_evaluation: 执行评价 - 关键任务的里程碑与进度复盘
  - strategy_iteration: 战略迭代 - 面对市场变化的战略纠偏与调整机制

### 2. 组织 (Structure) - 提升系统运转效率
- 组织架构 (organizational_structure)
  - structure_type: 架构形态 - 职能制、事业部制、矩阵制或敏捷团队
  - layers_and_span: 管理层级与跨度 - 扁平化程度与管理幅度
  - departmental_boundaries: 部门职责边界 - 职能重叠或灰色地带
- 权责分配 (authority_and_responsibility)
  - decision_mechanism: 决策机制 - 集权与分权的平衡
  - delegation_system: 授权体系 - 人权、财权、事权的下放程度
  - role_definitions: 岗位指引 - 责权利定义是否清晰
- 协同流程 (collaboration_and_processes)
  - core_processes: 核心业务流程 - 端到端价值链的运转效率
  - cross_functional_collaboration: 跨部门协同 - 部门墙厚度与沟通摩擦力
  - process_digitalization: 流程数字化 - IT系统对流程的支撑度
- 组织效能 (organizational_effectiveness)
  - per_capita_efficiency: 人效指标 - 人均产值、人均利润
  - agility: 响应速度 - 对市场需求和危机的响应速度

### 3. 绩效 (Performance) - 明确指挥棒
- 绩效体系设计 (system_design)
  - goal_setting_tools: 目标设定工具 - KPI、OKR或BSC
  - metric_cascading: 指标分解机制 - 目标纵向承接
  - weights_and_standards: 权重与标准 - SMART原则
- 过程管理 (process_management)
  - goal_tracking: 目标跟进 - 定期review机制
  - performance_coaching: 绩效辅导 - 过程纠偏与资源赋能
  - data_collection: 数据收集 - 数据准确性与获取成本
- 考核与反馈 (appraisal_and_feedback)
  - appraisal_fairness: 考核公平性 - 打分客观性与强制分布
  - feedback_quality: 面谈质量 - 建设性反馈与改进计划
  - grievance_mechanism: 申诉机制 - 异议处理通道
- 结果应用 (result_application)
  - link_to_rewards: 物质激励挂钩 - 与奖金、调薪的关联度
  - promotion_and_elimination: 晋升与淘汰 - 人才密度维持
  - link_to_learning_and_development: 培训与发展 - 针对性能力提升

### 4. 薪酬 (Compensation) - 提供核心动力
- 薪酬策略 (compensation_strategy)
  - market_positioning: 市场定位 - 领先、跟随还是滞后策略
  - fixed_vs_variable_mix: 固浮比设计 - 固定工资与浮动奖金比例
  - internal_equity: 内部公平性 - 岗位价值评估与职级体系
- 薪酬结构 (compensation_structure)
  - base_pay: 基本工资体系 - 宽带薪酬与薪级薪档
  - short_term_incentives: 短期激励 - 提成、项目奖、年终奖
  - long_term_incentives: 中长期激励 - 股权、期权、合伙人机制
  - benefits_and_allowances: 弹性福利 - 法定福利外的关怀与津贴
- 管理与预算 (management_and_budgeting)
  - payroll_management: 总额管控 - 人力成本占营收/利润比例
  - salary_adjustment: 调薪机制 - 动态调薪矩阵
  - pay_transparency: 薪酬沟通 - 制度宣贯与保密/透明机制

### 5. 人才 (Talent) - 打造核心资产
- 规划与盘点 (planning_and_review)
  - competency_models: 胜任力模型 - 核心价值观、领导力与专业能力
  - talent_review: 人才盘点机制 - 九宫格落位，识别高潜人才
  - pipeline_health: 梯队健康度 - 继任者计划
- 获取与配置 (acquisition_and_allocation)
  - employer_branding: 雇主品牌 - 企业声誉
  - recruitment_precision: 招聘精准度 - 人岗匹配度与渠道ROI
  - internal_mobility: 内部流动 - 活水机制与跨部门调动效率
- 培养与发展 (training_and_development)
  - onboarding: 融入体系 - 新员工/空降高管着陆与文化融入
  - leadership_development: 骨干培养 - 训战结合体系
  - career_pathways: 职业通道 - 管理与专业双通道
- 保留与激励 (retention_and_engagement)
  - key_talent_turnover: 核心流失率 - 关键人才离职率
  - employee_engagement: 员工敬业度 - 团队士气与内驱力
  - non_financial_incentives: 非物质激励 - 荣誉、授权、成长空间
`;

export const SYSTEM_PROMPT = `你是企业组织诊断专家，拥有丰富的管理咨询经验。你的任务是从用户提供的会议记录、访谈文字或语音转写中，提取关键信息，并将其映射到五维组织诊断模型的 L3 维度上。

${FIVE_DIMENSIONS_PROMPT}

## 任务说明

1. **信息提取**：从原始文字中识别出与组织诊断相关的关键信息
2. **维度映射**：将每条信息映射到最相关的 L3 维度
3. **评分**：根据信息内容，给出 0-100 分的评价
   - 0-30: 严重问题，需要立即改进
   - 31-50: 明显不足，需要重点关注
   - 51-70: 基本达标，有提升空间
   - 71-85: 表现良好，持续优化
   - 86-100: 优秀实践，值得推广
4. **证据**：引用原文中的具体描述作为评分依据
5. **置信度**：标注评估的置信度 (high/medium/low)

## 输出格式

请严格按照以下 JSON 格式输出：

\`\`\`json
{
  "strategy": {
    "label": "战略",
    "description": "做正确的事",
    "score": 0,
    "L2_categories": {
      "business_status": {
        "score": 0,
        "L3_items": {
          "performance_gap": {
            "score": 70,
            "evidence": "原文引用",
            "confidence": "high",
            "notes": "可选备注"
          }
        }
      }
    }
  },
  "structure": { ... },
  "performance": { ... },
  "compensation": { ... },
  "talent": { ... },
  "overall_score": 65
}
\`\`\`

## 注意事项

1. 只输出 JSON，不要包含其他解释文字
2. 对于未提及的 L3 维度，可以不输出或设置 score 为 null
3. overall_score 是所有维度评分的加权平均（权重相等）
4. evidence 必须是原文的直接引用，不能编造
5. 如果信息不足以评估某个维度，confidence 设为 low`;

export const USER_PROMPT_TEMPLATE = `以下是来自客户访谈的原始记录，请分析并输出五维诊断结果：

---
{raw_text}
---

请输出 JSON 格式的诊断结果。`;

/**
 * 获取完整的 schema JSON
 */
export function getFiveDimensionsSchema() {
  return fiveDimensionsSchema;
}

/**
 * 生成用户 Prompt
 */
export function generateUserPrompt(rawText: string): string {
  return USER_PROMPT_TEMPLATE.replace('{raw_text}', rawText);
}
