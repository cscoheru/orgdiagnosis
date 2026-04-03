// 3力3平台维度定义
export type DimensionType =
  | 'sales'        // 销售力
  | 'product'      // 产品力
  | 'delivery'     // 交付力
  | 'hr'           // 人力资源
  | 'finance'      // 财务物资
  | 'digital';     // 流程数字化

export interface DimensionCard {
  id: DimensionType;
  name: string;
  category: 'force' | 'platform'; // force = 3力, platform = 3平台
  isHighlighted: boolean; // AI 标记为可能的问题领域
  reason: string; // AI 给出的初步理由
  score: number; // 问题可能性评分 0-100
}

export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: number;
}

export interface DiagnosticSession {
  selectedDimension: DimensionType | null;
  messages: ChatMessage[];
  rootCause: string | null;
  isCompleted: boolean;
}

export interface Step1Data {
  goals: string;
  actuals: string;
  summary: string;
  dimensions: DimensionCard[];
  diagnosticSession: DiagnosticSession;
  rootCause: string; // 最终锁定的核心短板
}

// ========== Step 2 数据结构 ==========
// 客户需求洞察
export interface CustomerInsight {
  profile: string;
  kbf: string[];
  kbfLocked: boolean;
}

// 竞对优势分析
export interface CompetitorAdvantage {
  id: string;
  competitorName: string;
  advantage: string;
  category?: string;
}

export interface CompetitorAnalysis {
  advantages: CompetitorAdvantage[];
  searchResults?: string;
  analysisLocked: boolean;
}

// KSF 维度（带推导理由）
export interface KSFDimension {
  id: string;
  name: string;
  description: string;
  reasoning: string;
}

// 竞争对标评分
export interface BenchmarkScore {
  dimensionId: string;
  dimensionName: string;
  myScore: number;
  competitorScore: number;
  ranking: 'high' | 'medium' | 'low';
}

// 洞察小结（新增）
export interface InsightSummary {
  strengths: string;   // 用户手动总结或 AI 生成的优势
  weaknesses: string;  // 用户手动总结或 AI 生成的劣势
  opportunities: string; // 用户手动总结或 AI 生成的机会
  threats: string;    // 用户手动总结或 AI 生成的威胁
}

// 产品-客户矩阵（新增）
export interface ProductCustomerMatrix {
  marketPenetration: string[];   // 老客户+老产品
  productDevelopment: string[];    // 老客户+新产品
  marketDevelopment: string[];    // 新客户+老产品
  diversification: string[];       // 新客户+新产品
}

export interface Step2Data {
  // 原始输入
  trends: string;
  trendsFile?: { name: string; content: string };
  competitors: string;
  competitorsFile?: { name: string; content: string };
  companyInfo: string;

  // 客户需求洞察
  customerInsight: CustomerInsight;

  // 竞对优势分析
  competitorAnalysis: CompetitorAnalysis;

  // KSF 分析
  ksfDimensions: KSFDimension[];
  ksfLocked: boolean;

  // 竞争力对标
  benchmarkScores: BenchmarkScore[];
  benchmarkLocked: boolean;

  // 洞察小结（新增）
  insightSummary?: InsightSummary;

  // SWOT（合并洞察小结 + 对标推导）
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  swotLocked?: boolean;

  // TOWS 交叉策略推演
  towsStrategies?: {
    so: string[];
    wo: string[];
    st: string[];
    wt: string[];
  };
  towsGenerated?: boolean;

  // 战略方向决策
  strategicDirection?: string;
  aiStrategicRecommendation?: string;

  // 产品-客户矩阵
  productCustomerMatrix?: ProductCustomerMatrix;
  matrixGenerated?: boolean;

  // 旧版兼容
  strategicPoints?: string[];
}

// ========== Step 3 数据结构 ==========
export interface MatrixData {
  oldClients: string[];    // 老客户/存量市场
  newClients: string[];    // 新客户/增量市场
  oldProducts: string[];   // 原有产品/服务
  newProducts: string[];   // 新产品/服务
  values: {
    [key: string]: number;  // 格式: "client_id_product_id": 金额
  };
}

export interface CalculatedTargets {
  base: number;      // 保底目标
  standard: number;   // 达标目标
  challenge: number;    // 挑战目标
}

export interface Step3Data {
  matrixData: MatrixData;
  calculatedTargets: CalculatedTargets;
  confidenceIndex: number; // 信心指数 100-200

  // 旧版兼容（用于 ReportPage）
  targets?: Array<{ name: string; type: 'revenue' | 'market' | 'other'; currentValue: number; targetValue: number; description: string }>;
}

// ========== Step 4 数据结构（重构：3力3平台行动计划表）==========

// 行动计划表的行结构
export interface ActionPlanRow {
  id: string;
  // 前4列（只读）：序号、客户群、产品、营收目标
  seqNumber: number;
  customerGroup: string;  // 客户群名称
  product: string;  // 产品名称
  revenueTarget: number;  // 营收目标

  // 后6列（3力3平台，可编辑）
  salesForce: string;  // 销售力
  productForce: string;  // 产品力
  deliveryForce: string;  // 交付力
  hr: string;  // 人力（3平台）
  financeAssets: string;  // 财务&资产（3平台）
  digitalProcess: string;  // 数字化&流程（3平台）

  // 元数据
  isCustom: boolean;  // 是否为用户手动添加的行
}

// BSC 战略地图卡片结构（用于显示和生成映射）
export interface BSCCard {
  id: 'financial' | 'customer' | 'internalProcess' | 'learningGrowth';
  title: string;
  description: string;
  icon: string;
  color: string;
  items: string[];
}

// ========== 新版：可视化战略地图数据结构（重构版）==========

// 战略主题类型（AI 智能判断）
export type StrategicTheme =
  | 'product-leadership'    // 产品领先：重点在研发创新
  | 'customer-intimacy'     // 客户亲密：重点在服务体验
  | 'operational-excellence'; // 卓越运营：重点在降本增效

// BSC 层级类型
export type BSCLayer = 'financial' | 'customer' | 'process' | 'learning';

// 战略地图卡片（聚焦式）
export interface StrategyCard {
  id: string;                // 唯一标识，如 "F1", "C1", "P1", "L1"
  layer: BSCLayer;           // 所属层级
  number: number;            // 编号：1, 2, 3...
  title: string;             // 卡片标题（简短动宾短语，如"提升客单价"）
  description: string;       // 详细描述
  items: string[];           // 具体举措列表
  parentCardIds: string[];   // 支撑的父卡片ID（用于成组高亮）
  childCardIds: string[];    // 依赖的子卡片ID
  position?: { x: number; y: number };  // React Flow 节点位置
  isHighlighted: boolean;    // 是否为必赢战役
  isEditable: boolean;       // 是否可编辑
}

// 战略地图完整结构
export interface StrategyMap {
  // 年度战略主题（AI 智能判断）
  theme: StrategicTheme;
  themeDescription: string;  // 主题描述

  // Step 3 的目标金额
  targetAmount: number;

  // 各层级的卡片（按层级分组存储）
  layers: {
    financial: StrategyCard[];    // 财务层
    customer: StrategyCard[];     // 客户层
    process: StrategyCard[];      // 流程层
    learning: StrategyCard[];     // 学习层
  };

  // 是否已确认
  confirmed: boolean;
}

// 保留旧的节点结构以兼容（废弃中）
export interface StrategyMapNode {
  id: string;
  layer: 'A' | 'B' | 'C' | 'D';
  track: 1 | 2 | null;
  label: string;
  description: string;
  items: string[];
  position: { row: number; col: number };
  parentIds: string[];
  isHighlighted?: boolean;
  isEditable?: boolean;
}

// 轨道类型（废弃中）
export type TrackType = 'efficiency' | 'growth';

// 保留旧接口以兼容原有代码
export interface ExecutionTask {
  id: string;
  title: string;
  description: string;
  quadrant: 'marketPenetration' | 'productDevelopment' | 'marketDevelopment' | 'diversification';
  priority: 'high' | 'medium' | 'low';
  deadline: string;
  assignee?: string;
  status: 'pending' | 'inProgress' | 'completed';
}

export interface Step4Data {
  actionPlanTable: ActionPlanRow[];  // 新的3力3平台表
  bscConfirmed: boolean;  // BSC地图是否已确认
  bscCards?: BSCCard[];  // BSC四象限卡片（旧版，保留兼容）

  // 新版：可视化战略地图
  strategyMap?: StrategyMap;

  // 保留旧字段以兼容
  tasks?: ExecutionTask[];
  ganttChart?: any;
  keyBattles?: Array<{ name: string; description: string; owner: string }>;
  quarterlyActions?: Array<{ quarter: string; action: string; deadline: string }>;
}

// ========== 全局数据结构 ==========
export interface StrategicData {
  step1: Step1Data;
  step2: Step2Data;
  step3?: Step3Data;
  step4?: Step4Data;
}

export interface ModelConfig {
  provider: 'zhipu';
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface CompanyInfo {
  name: string;
  industry: string;
}

// ========== Step 类型定义 ==========
export type Step = 1 | 2 | 3 | 4 | 'welcome' | 'report';

// ========== PROVIDER 选项 ==========
export type ModelProvider = 'zhipu';

export interface ProviderOption {
  id: ModelProvider;
  value: ModelProvider;
  label: string;
  requiresBaseUrl: boolean;
  defaultModel: string;
  helpUrl?: string;
  models?: string[];
  baseUrlPlaceholder?: string;
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: 'zhipu',
    value: 'zhipu',
    label: '智谱 AI (GLM-4)',
    requiresBaseUrl: false,
    defaultModel: 'glm-4-flash',
    helpUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    models: ['glm-4-flash', 'glm-4-plus', 'glm-4'],
    baseUrlPlaceholder: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
  },
];
