/**
 * W3 交付流程 — 类型定义
 *
 * 与 kernel meta-models 对齐：
 *   Contract, Team_Member, Task, Meeting_Note, Deliverable
 */

/** 付款节点 */
export interface PaymentMilestone {
  percentage: number;       // e.g. 30, 40, 30 (must sum to 100)
  trigger_event: string;   // e.g. "签约时", "中期验收", "终期验收"
  expected_date?: string;  // ISO date
}

/** 合同信息 */
export interface ContractInfo {
  contract_number: string;
  total_amount: number;
  currency: 'CNY' | 'USD' | 'EUR';
  payment_schedule: PaymentMilestone[];
  signed_date?: string;
  client_signatory?: string;
  description?: string;
}

/** 团队成员 */
export interface TeamMemberInfo {
  _key?: string;
  name: string;
  role: 'lead' | 'member' | 'advisor';
  specialization?: string;
  is_external?: boolean;
}

/** 里程碑日期 */
export interface MilestoneDate {
  phase_name: string;
  phase_id?: string;
  planned_start: string;
  planned_end: string;
}

/** 创建订单表单数据 */
export interface CreateOrderFormData {
  contract: ContractInfo;
  team: TeamMemberInfo[];
  project_start: string;
  project_end: string;
  milestone_dates: MilestoneDate[];
}

/** 预设付款模式 */
export const PAYMENT_PRESETS: { label: string; schedule: PaymentMilestone[] }[] = [
  { label: '30/40/30', schedule: [
    { percentage: 30, trigger_event: '签约时' },
    { percentage: 40, trigger_event: '中期验收' },
    { percentage: 30, trigger_event: '终期验收' },
  ]},
  { label: '50/50', schedule: [
    { percentage: 50, trigger_event: '签约时' },
    { percentage: 50, trigger_event: '终期验收' },
  ]},
  { label: '40/30/30', schedule: [
    { percentage: 40, trigger_event: '签约时' },
    { percentage: 30, trigger_event: '方案确认' },
    { percentage: 30, trigger_event: '终期验收' },
  ]},
];
