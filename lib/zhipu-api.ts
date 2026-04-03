/**
 * 智谱 AI API 集成服务
 */

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

export interface ZhipuMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ZhipuResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
}

/**
 * 调用智谱 AI API
 * 如果没有提供 API Key，则使用后端 API（环境变量）
 */
export async function callZhipuAPI(
  apiKey: string,
  messages: ZhipuMessage[]
): Promise<string> {
  try {
    // 如果没有前端 API Key，使用后端 API
    if (!apiKey) {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`后端 API 调用失败: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.content || '';
    }

    // 使用前端 API Key 直接调用
    const response = await fetch(ZHIPU_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 调用失败: ${response.status} - ${errorText}`);
    }

    const data: ZhipuResponse = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('智谱 AI API 调用错误:', error);
    throw error;
  }
}

/**
 * Step 1: 生成 3力3平台归因地图
 * 返回 6 个维度的分析结果
 */
export async function generateAttributionMap(
  apiKey: string,
  goals: string,
  actuals: string
): Promise<{
  dimensions: Array<{
    id: string;
    name: string;
    category: 'force' | 'platform';
    isHighlighted: boolean;
    reason: string;
    score: number;
  }>;
  summary: string;
}> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的"战略解码引导师"，擅长使用"3力3平台根因诊断模式"帮助企业深度挖掘业绩差距的根本原因。

核心框架（3力3平台）：
【3力 - 业务层】
- 销售力：线索获取、转化率、客户关系、销售团队
- 产品力：产品竞争力、创新能力、质量稳定性、上市速度
- 交付力：履约能力、服务体验、交付效率、客户满意度

【3平台 - 支撑层】
- 人力资源：人才密度、组织能力、激励机制、文化氛围
- 财务物资：资金充足性、成本控制、资源配置、投入产出
- 流程数字化：流程效率、数字化工具、数据决策、协同能力

你的职责是：
1. 基于用户的目标和实际数据，从 6 个维度进行假设性归因分析
2. 不要急于下结论，而是提供"可能性分析"
3. 标记出最可能有问题的 1-3 个维度
4. 为每个维度给出简明的分析理由和可能性评分（0-100）

分析原则：
- 使用"排除法"思维，帮助用户聚焦问题
- 既要看到表面的业绩差距，更要洞察背后的根因
- 用"可能"而非"确定"的语气，引导用户验证`
    },
    {
      role: 'user',
      content: `请作为战略解码引导师，帮我分析以下业绩差距：

【去年目标】
${goals}

【实际完成】
${actuals}

请基于"3力3平台"框架，生成一份"假设性归因地图"，以JSON格式返回：

{
  "summary": "总体复盘简述（100-150字）",
  "dimensions": [
    {
      "id": "sales",
      "name": "销售力",
      "category": "force",
      "isHighlighted": true/false,
      "reason": "具体的可能性分析（2-3句话）",
      "score": 85
    },
    ...（其他5个维度）
  ]
}

要求：
1. 标记 1-3 个最可能有问题的维度（isHighlighted: true）
2. 为每个维度提供简明扼要的理由
3. 评分范围 60-95，越高表示问题可能性越大
4. 保持客观中立，用"可能"、"或许"等探询性语言`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  // 维度名称到 ID 的映射
  const dimensionNameToId: Record<string, string> = {
    '销售力': 'sales',
    '产品力': 'product',
    '交付力': 'delivery',
    '人力资源': 'hr',
    '财务物资': 'finance',
    '流程数字化': 'digital'
  };

  // 解析 JSON 响应
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // 标准化维度数据
      if (parsed.dimensions && Array.isArray(parsed.dimensions)) {
        parsed.dimensions = parsed.dimensions.map((d: any) => {
          // 确保 ID 正确
          if (!d.id || !dimensionNameToId[d.name]) {
            // 根据 name 查找对应的 ID
            const matchedId = Object.entries(dimensionNameToId).find(([name]) => d.name?.includes(name))?.[1];
            if (matchedId) {
              d.id = matchedId;
            }
          }

          // 确保 category 正确
          if (!d.category) {
            const forceIds = ['sales', 'product', 'delivery'];
            d.category = forceIds.includes(d.id) ? 'force' : 'platform';
          }

          // 确保 score 在合理范围内
          if (!d.score || d.score < 0 || d.score > 100) {
            d.score = d.isHighlighted ? 75 : 60;
          }

          return d;
        });
      }

      return parsed;
    }
  } catch (e) {
    console.error('解析归因地图 JSON 失败:', e);
  }

  // 返回默认结构
  return {
    summary: '分析完成，请查看各维度详情',
    dimensions: [
      { id: 'sales', name: '销售力', category: 'force', isHighlighted: false, reason: '待分析', score: 60 },
      { id: 'product', name: '产品力', category: 'force', isHighlighted: false, reason: '待分析', score: 60 },
      { id: 'delivery', name: '交付力', category: 'force', isHighlighted: false, reason: '待分析', score: 60 },
      { id: 'hr', name: '人力资源', category: 'platform', isHighlighted: false, reason: '待分析', score: 60 },
      { id: 'finance', name: '财务物资', category: 'platform', isHighlighted: false, reason: '待分析', score: 60 },
      { id: 'digital', name: '流程数字化', category: 'platform', isHighlighted: false, reason: '待分析', score: 60 },
    ]
  };
}

/**
 * Step 1: 5 问法对话 - 第一问
 * 开始深度诊断对话
 */
export async function startDiagnosticChat(
  apiKey: string,
  dimension: { id: string; name: string; reason: string },
  goals: string,
  actuals: string
): Promise<string> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的战略解码引导师，擅长使用"5 Whys（五问法）"帮助企业挖掘业绩差距的根本原因。

当前用户选择了【${dimension.name}】作为主要问题领域，初步分析：${dimension.reason}

你的任务是：
1. 提出**第一个尖锐的探询性问题**，帮助用户深入思考
2. 问题要具体、有针对性，避免泛泛而谈
3. 使用"是否"、"更可能是...还是..."等二选一或选择题，引导用户聚焦
4. 问题长度控制在 30-50 字
5. 不要给出答案，只提问

示例：
- 销售力："线索数量不够，还是转化率太低？"
- 产品力："是新品上市延期，还是现有产品竞争力不足？"
- 交付力："是交付能力不足，还是客户期望管理问题？"
- 人力资源："是人才密度不够，还是激励机制不完善？"
- 财务物资："是资金紧张，还是资源配置不当？"
- 流程数字化："是流程效率低，还是数字化工具缺失？"`
    },
    {
      role: 'user',
      content: `我们选择了【${dimension.name}】作为主要瓶颈。

【业绩背景】
去年目标：${goals.substring(0, 200)}...
实际完成：${actuals.substring(0, 200)}...

请开始第一问，帮助我深入挖掘 ${dimension.name} 的根本原因。`
    }
  ];

  return callZhipuAPI(apiKey, messages);
}

/**
 * Step 1: 5 问法对话 - 继续追问
 */
export async function continueDiagnosticChat(
  apiKey: string,
  chatHistory: Array<{ role: 'ai' | 'user'; content: string }>,
  userAnswer: string
): Promise<string> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的战略解码引导师，正在使用"5 Whys（五问法）"帮助企业挖掘根本原因。

当前对话进度：${chatHistory.length} 问

你的任务是：
1. 根据用户的回答，提出下一个更深层的追问
2. 逐步从"现象"挖掘到"根因"
3. 使用"为什么会...？"、"具体是什么...？"、"有没有可能是...？"等追问方式
4. 每个问题要具体、有针对性
5. 当达到 5 问左右，或用户回答已经触及核心时，停止追问并总结根因

判断标准：
- 如果是第 1-3 问：继续挖掘表层原因
- 如果是第 4-5 问：接近根因，准备总结
- 如果已触及根因：总结并确认`
    },
    ...chatHistory.map(msg => ({
      role: (msg.role === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: msg.content
    })),
    {
      role: 'user',
      content: userAnswer
    }
  ];

  return callZhipuAPI(apiKey, messages);
}

/**
 * Step 1: 提取根因总结
 */
export async function extractRootCause(
  apiKey: string,
  dimensionName: string,
  chatHistory: Array<{ role: 'ai' | 'user'; content: string }>
): Promise<string> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的战略解码引导师，需要基于对话历史，提炼出业绩差距的根本原因。

请将对话结论总结为：
1. 一条明确的"核心短板"陈述（20-30字）
2. 简要说明这个根因如何影响业绩（50-80字）

要求：
- 具体、可落地、有针对性
- 避免泛泛而谈（如"管理不到位"、"执行力差"）
- 尽可能量化或给出具体场景`
    },
    {
      role: 'user',
      content: `基于以下对话，请提炼出【${dimensionName}】的根本原因：

【对话历史】
${chatHistory.map((msg, i) => `${i + 1}. ${msg.role === 'ai' ? '引导师' : '用户'}: ${msg.content}`).join('\n')}

请给出：
1. 核心短板（一句话，20-30字）
2. 影响分析（50-80字）`
    }
  ];

  return callZhipuAPI(apiKey, messages);
}

/**
 * Step 2 A1: 客户需求洞察 - 验证和优化 KBF
 * 用户输入 KBF 后，AI 帮助验证是否合理，并提供补充建议
 */
export async function analyzeCustomerKBF(
  apiKey: string,
  customerProfile: string,
  kbfList: string[],
  industry: string
): Promise<{
  validated: boolean;
  feedback: string;
  suggestions: string[];
}> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的客户洞察专家，擅长分析 B2B/B2C 客户的购买决策逻辑。

关键购买因素 (Key Buying Factors, KBF) 是指客户在做购买决策时最看重的要素。

你的任务是：
1. 审查用户提供的 KBF 是否合理、是否覆盖关键决策点
2. 给出具体的反馈意见
3. 如果有遗漏，提供补充建议

KBF 示例：
- B2B 制造业：账期、次品率、交付周期、技术支持、产能稳定性
- SaaS 软件：功能完整性、数据安全、易用性、集成能力、价格
- 消费品：品牌认知、价格、品质、便利性、社交认同`
    },
    {
      role: 'user',
      content: `请帮我验证以下客户需求洞察是否完整：

【所属行业】
${industry}

【典型客户画像】
${customerProfile}

【用户提出的 KBF】
${kbfList.map((kbf, i) => `${i + 1}. ${kbf}`).join('\n')}

请以 JSON 格式返回：
{
  "validated": true/false,
  "feedback": "具体的反馈意见（50-100字）",
  "suggestions": ["建议补充的KBF1", "建议补充的KBF2"]
}

要求：
1. 如果 KBF 数量少于 3 个，validated 为 false
2. 如果 KBF 过于笼统（如"质量好"），建议更具体化（如"次品率低于0.1%"）`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('解析 KBF 验证 JSON 失败:', e);
  }

  return {
    validated: kbfList.length >= 3,
    feedback: 'KBF 已记录，建议至少包含 3-5 个关键因素。',
    suggestions: []
  };
}

/**
 * Step 2 A2: 竞对深度侦察 - 分析竞对成功因素 (CSF)
 * 基于竞对资料或搜索结果，提炼竞对的核心必杀技
 */
export async function analyzeCompetitorCSF(
  apiKey: string,
  competitorInput: string,
  searchResults?: string
): Promise<Array<{
  id: string;
  competitorName: string;
  advantage: string;
  category?: string;
}>> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的竞争情报分析专家，擅长从公开信息中挖掘竞争对手的核心竞争力。

竞对成功因素 (Competitor Success Factors, CSF) 是指：竞争对手为什么能拿单？它的核心必杀技是什么？

你的任务是：
1. 基于用户提供的竞对信息（包括手动粘贴的搜索结果）
2. 识别每个竞争对手的 1-2 个核心优势
3. 优势要具体、可验证，避免泛泛而谈

CSF 示例：
- 供应链成本极低
- 客户关系极强（有历史合作）
- 技术专利壁垒
- 品牌知名度高
- 交付速度快
- 产品定制化能力强`
    },
    {
      role: 'user',
      content: `请帮我深度分析竞争对手的核心优势：

【竞对信息】
${competitorInput}

${searchResults ? `【网络搜索结果】\n${searchResults}` : ''}

请以 JSON 格式返回：
[
  {
    "id": "唯一ID",
    "competitorName": "竞对名称",
    "advantage": "核心必杀技（一句话，具体可验证）",
    "category": "可选：优势分类（如价格、渠道、技术、服务等）"
  }
]

每个竞对最多提炼 1-2 个核心优势。`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((item: any) => ({
        id: item.id || `csf_${Date.now()}_${Math.random()}`,
        competitorName: item.competitorName || '未知竞对',
        advantage: item.advantage || '',
        category: item.category
      }));
    }
  } catch (e) {
    console.error('解析 CSF JSON 失败:', e);
  }

  return [];
}

/**
 * Step 2 A3: 提炼行业关键成功要素 (KSF) - 重构版
 * 使用逻辑链：KSF = 满足客户 KBF 的能力 + 抵御竞对 CSF 的能力
 */
export async function extractKSFDimensions(
  apiKey: string,
  trends: string,
  companyInfo: string,
  customerKbf: string[],
  competitorCsf: Array<{
    competitorName: string;
    advantage: string;
  }>
): Promise<Array<{
  id: string;
  name: string;
  description: string;
  reasoning: string;  // 新增：推导理由
}>> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的战略分析专家，擅长识别"关键成功要素" (Key Success Factors, KSF)。

**核心公式：KSF = 满足客户 KBF 的能力 + 抵御竞对 CSF 的能力**

传统 KSF 分析过于通用，容易流于表面。你的任务是使用"逻辑链推导法"：

1. **客户视角**：客户在做购买决策时最看重什么？（KBF）
2. **竞对视角**：竞争对手凭什么拿单？（CSF）
3. **我司视角**：我们需要什么能力才能既满足客户，又抵御竞对？

**示例演示**：

假设：
- 客户 KBF：看重"多品种小批量"、"次品率低于0.1%"
- 竞对A CSF：快速换模能力
- 竞对B CSF：自动化质检设备

推导 KSF：
- KSF 1：柔性生产能力
  理由：客户看重"多品种小批量"（KBF），且竞对A具备"快速换模能力"（CSF）

- KSF 2：质量控制系统
  理由：客户看重"次品率低于0.1%"（KBF），且竞对B具备"自动化质检"（CSF）

- KSF 3：成本控制能力
  理由：客户普遍看重价格（KBF），需要通过规模效应抵消柔性生产的成本劣势

你的输出要求：
1. 生成 3-5 个 KSF 维度
2. 每个维度名称简洁（2-4字）
3. **必须给出明确的推导理由**，引用具体的 KBF 和 CSF
4. 理由格式：因为客户看重"XXX"（KBF），且/或 竞对X具备"XXX"（CSF）`
    },
    {
      role: 'user',
      content: `请基于"逻辑链推导法"，提炼行业关键成功要素：

【行业趋势】
${trends}

【本公司信息】
${companyInfo}

【客户关键购买因素 (KBF)】
${customerKbf.map((kbf, i) => `${i + 1}. ${kbf}`).join('\n')}

【竞对核心优势 (CSF)】
${competitorCsf.map((csf, i) => `${i + 1}. ${csf.competitorName}：${csf.advantage}`).join('\n')}

请以 JSON 格式返回：
[
  {
    "id": "唯一ID（英文，如 capacity）",
    "name": "KSF维度名称（中文，2-4字）",
    "description": "简短说明（1句话）",
    "reasoning": "推导理由（明确引用KBF或CSF）"
  }
]

**重要**：
- reasoning 必须引用具体的 KBF 或 CSF
- 格式示例：因为客户看重"多品种小批量"（KBF），且竞对A具备"快速换模能力"（CSF），所以需要柔性生产能力`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((item: any) => ({
        id: item.id || `dim_${Date.now()}`,
        name: item.name || '未命名',
        description: item.description || '',
        reasoning: item.reasoning || ''
      }));
    }
  } catch (e) {
    console.error('解析 KSF 维度 JSON 失败:', e);
  }

  return [];
}

/**
 * Step 2 B: 竞争力对标打分
 */
export async function generateBenchmarkScores(
  apiKey: string,
  dimensions: Array<{ id: string; name: string; description: string; reasoning?: string }>,
  competitors: string,
  companyInfo: string
): Promise<Array<{
  dimensionId: string;
  dimensionName: string;
  myScore: number;
  competitorScore: number;
  ranking: 'high' | 'medium' | 'low';
  analysis: string;
}>> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的竞争力分析专家，擅长企业对标分析。

你的任务是：
1. 基于给定的竞争力维度，评估"我司"与"主要竞争对手"的表现
2. 给出 1-10 分的评分（10分=行业顶尖，1分=严重不足）
3. 判断我司在每个维度上的排名水平（high/medium/low）
4. 提供简短的分析说明

评分标准：
- 9-10分：行业领先，明显优势
- 7-8分：行业中上，有竞争力
- 5-6分：行业中等，不突出
- 3-4分：行业中下，存在差距
- 1-2分：严重不足，急需改进`
    },
    {
      role: 'user',
      content: `请进行竞争力对标分析：

【竞争力维度】
${dimensions.map(d => `- ${d.name}：${d.description}${d.reasoning ? `（推导理由：${d.reasoning}）` : ''}`).join('\n')}

【竞争对手信息】
${competitors}

【本公司信息】
${companyInfo}

请以JSON格式返回：
[
  {
    "dimensionId": "维度ID",
    "dimensionName": "维度名称",
    "myScore": 评分数字(1-10),
    "competitorScore": 对手评分数字(1-10),
    "ranking": "high"或"medium"或"low",
    "analysis": "简短分析（1-2句话）"
  }
]`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((item: any) => ({
        dimensionId: item.dimensionId,
        dimensionName: item.dimensionName,
        myScore: Math.min(10, Math.max(1, Number(item.myScore) || 5)),
        competitorScore: Math.min(10, Math.max(1, Number(item.competitorScore) || 5)),
        ranking: item.ranking || 'medium',
        analysis: item.analysis || ''
      }));
    }
  } catch (e) {
    console.error('解析对标评分 JSON 失败:', e);
  }

  return [];
}

/**
 * Step 2 C: 基于对标结果生成 SWOT
 */
export async function generateSWOTFromBenchmark(
  apiKey: string,
  dimensions: Array<{
    dimensionId: string;
    dimensionName: string;
    myScore: number;
    competitorScore: number;
    ranking: string;
  }>,
  trends: string,
  advantages: string
): Promise<{
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  strategicPoints: string[];
}> {
  const highDimensions = dimensions.filter(d => d.myScore >= 7);
  const lowDimensions = dimensions.filter(d => d.myScore <= 4);

  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的战略专家，擅长基于竞争力对标分析生成 SWOT 矩阵。

SWOT 分析逻辑：
- Strengths（优势）：我司得分高于竞对或排名为 high 的维度
- Weaknesses（劣势）：我司得分低于竞对或排名为 low 的维度
- Opportunities（机会）：基于行业趋势和我司优势可以把握的机会
- Threats（威胁）：行业趋势、竞争压力或我司劣势带来的风险

当前对标分析结果：
${dimensions.map(d => `- ${d.dimensionName}：我司${d.myScore}分 vs 竞对${d.competitorScore}分（${d.ranking}）`).join('\n')}

我司优势维度：${highDimensions.map(d => d.dimensionName).join('、') || '无'}
我司劣势维度：${lowDimensions.map(d => d.dimensionName).join('、') || '无'}`
    },
    {
      role: 'user',
      content: `请基于竞争力对标分析，生成 SWOT 矩阵和战略机会点：

【行业趋势】
${trends}

【我司优势（补充信息）】
${advantages || '暂无'}

请以JSON格式返回：
{
  "swot": {
    "strengths": ["优势1", "优势2", "优势3"],
    "weaknesses": ["劣势1", "劣势2"],
    "opportunities": ["机会1", "机会2", "机会3"],
    "threats": ["威胁1", "威胁2"]
  },
  "strategicPoints": ["战略机会点1", "战略机会点2", "战略机会点3", "战略机会点4", "战略机会点5"]
}

要求：
1. 优势/劣势要直接引用对标分析的具体维度
2. 机会要结合行业趋势和我司优势
3. 威胁要考虑竞争压力和我司劣势
4. 战略机会点要具体可落地`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('解析 SWOT JSON 失败:', e);
  }

  return {
    swot: {
      strengths: ['待分析'],
      weaknesses: ['待分析'],
      opportunities: ['待分析'],
      threats: ['待分析']
    },
    strategicPoints: ['待分析']
  };
}

/**
 * Step 2: 生成 SWOT 矩阵和战略机会点（旧版，保留兼容）
 */
export async function generateSWOTAndOpportunities(
  apiKey: string,
  trends: string,
  competitors: string,
  advantages: string
): Promise<{ swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] }; strategicPoints: string[] }> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: '你是一位战略专家，擅长SWOT分析和战略机会识别。请基于输入的信息，生成专业的SWOT矩阵和战略机会点。'
    },
    {
      role: 'user',
      content: `请基于以下信息，生成SWOT分析矩阵和战略机会点：

行业趋势：
${trends}

竞争对手情况：
${competitors}

核心优势：
${advantages}

请以JSON格式返回：
{
  "swot": {
    "strengths": ["优势1", "优势2", "优势3"],
    "weaknesses": ["劣势1", "劣势2"],
    "opportunities": ["机会1", "机会2", "机会3"],
    "threats": ["威胁1", "威胁2"]
  },
  "strategicPoints": ["战略机会点1", "战略机会点2", "战略机会点3", "战略机会点4", "战略机会点5"]
}

每个SWOT维度列出3-5项，战略机会点列出5项。`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  // 尝试解析JSON，如果失败则返回默认结构
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('解析SWOT JSON失败:', e);
  }

  // 返回默认结构
  return {
    swot: {
      strengths: ['待分析'],
      weaknesses: ['待分析'],
      opportunities: ['待分析'],
      threats: ['待分析']
    },
    strategicPoints: ['待分析']
  };
}

/**
 * Step 3: 生成建议目标
 */
export async function generateTargets(
  apiKey: string,
  summary: string,
  strategicPoints: string[]
): Promise<Array<{ name: string; type: 'revenue' | 'market' | 'other'; currentValue: number; targetValue: number; description: string }>> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: '你是一位战略规划专家，擅长设定企业年度目标。请基于业绩复盘和战略机会，生成具体的年度目标建议。'
    },
    {
      role: 'user',
      content: `请基于以下信息，生成年度的关键目标建议：

业绩复盘总结：
${summary}

战略机会点：
${strategicPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

请以JSON格式返回：
[
  {
    "name": "目标名称（如：营收增长、市场份额等）",
    "type": "revenue" 或 "market" 或 "other",
    "currentValue": 当前数值（数字）,
    "targetValue": 目标数值（数字）,
    "description": "目标描述"
  }
]

生成5-8个关键目标，覆盖财务、市场、产品、运营等维度。`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((item: any) => ({
        name: item.name || '未命名目标',
        type: item.type || 'other',
        currentValue: Number(item.currentValue) || 0,
        targetValue: Number(item.targetValue) || 0,
        description: item.description || ''
      }));
    }
  } catch (e) {
    console.error('解析目标JSON失败:', e);
  }

  return [];
}

/**
 * Step 4: 生成作战地图
 */
export async function generateExecutionMap(
  apiKey: string,
  targets: Array<{ name: string; description: string }>
): Promise<{ keyBattles: Array<{ name: string; description: string; owner: string }>; quarterlyActions: Array<{ quarter: string; action: string; deadline: string }> }> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: '你是一位战略执行专家，擅长将战略目标拆解为具体的行动计划。请基于年度目标，生成关键战役和季度行动计划。'
    },
    {
      role: 'user',
      content: `请基于以下年度目标，生成战略执行方案：

年度目标：
${targets.map((t, i) => `${i + 1}. ${t.name}: ${t.description}`).join('\n')}

请以JSON格式返回：
{
  "keyBattles": [
    {
      "name": "战役名称",
      "description": "战役描述",
      "owner": "负责人/部门"
    }
  ],
  "quarterlyActions": [
    {
      "quarter": "Q1/Q2/Q3/Q4",
      "action": "具体行动",
      "deadline": "截止时间"
    }
  ]
}

生成3-5个关键战役，每个季度至少2-3个关键行动。`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('解析执行方案JSON失败:', e);
  }

  return {
    keyBattles: [],
    quarterlyActions: []
  };
}

// ========== Step 2 新增：文件分析与对话功能 ==========

/**
 * 分析上传的文件内容（模拟读取，实际可集成真实文件解析）
 */
export async function analyzeUploadedFile(
  apiKey: string,
  fileName: string,
  fileContent: string,
  analysisType: 'trends' | 'competitors' | 'customer' | 'company'
): Promise<{
  summary: string;
  keyPoints: string[];
  suggestions: string[];
}> {
  const typePrompts = {
    trends: '行业趋势分析',
    competitors: '竞争对手分析',
    customer: '客户需求分析',
    company: '公司情况分析'
  };

  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的战略分析专家，擅长从文档中提取关键信息。

**⚠️ 重要约束 - 必须严格遵守**：
1. 你只能分析【文件内容】中提供的文本信息
2. 如果【文件内容】为空、无法识别或只是乱码，必须直接回复"无法读取文件内容，请检查文件是否为扫描件"
3. 严禁编造、猜测或使用通用模板填充内容
4. 所有分析结果必须基于【文件内容】中的真实数据
5. 如果文件内容不足，请明确说明"文件提供的信息有限"

当前分析类型：${typePrompts[analysisType]}

你的任务是：
1. 提取文档的核心内容摘要（100-150字）- 必须基于真实文件内容
2. 列出 3-5 个关键要点 - 必须来自文件内容
3. 给出 2-3 个分析建议或后续行动 - 基于文件内容的分析

请以简洁、专业的语言输出。`
    },
    {
      role: 'user',
      content: `请分析以下文件内容：

【文件名】
${fileName}

【文件内容】
${fileContent}

请以 JSON 格式返回：
{
  "summary": "内容摘要（100-150字）",
  "keyPoints": ["关键要点1", "关键要点2", "关键要点3"],
  "suggestions": ["建议1", "建议2"]
}`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('解析文件分析 JSON 失败:', e);
  }

  // 检查文件内容是否为空或过短
  if (!fileContent || fileContent.trim().length < 10) {
    return {
      summary: '❌ 无法读取文件内容：文件似乎是空的或无法解析。',
      keyPoints: [],
      suggestions: ['请检查文件是否为扫描件', '尝试使用包含可提取文本的 PDF']
    };
  }

  // 文件内容存在但解析失败，返回原始内容片段
  return {
    summary: '文件已读取，但 AI 解析失败。以下是文件内容片段：',
    keyPoints: [fileContent.substring(0, 300) + (fileContent.length > 300 ? '...' : '')],
    suggestions: ['请手动提取关键信息', '或尝试重新上传文件']
  };
}

/**
 * 对话式分析助手 - 适用于各模块的深度互动
 * 支持多轮对话，帮助用户逐步完善分析
 */
export async function chatAnalysisAssistant(
  apiKey: string,
  module: 'trends' | 'competitors' | 'customer' | 'company',
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userInput: string
): Promise<{
  response: string;
  extractedData?: string[];
  questions?: string[];
  isComplete?: boolean;
}> {
  const moduleConfigs = {
    trends: {
      role: '行业趋势分析专家',
      goal: '帮助用户深入理解行业发展趋势、政策变化、技术革新等关键信息',
      prompts: [
        '当前行业的核心发展趋势是什么？',
        '有哪些政策或法规变化可能影响行业？',
        '新兴技术对行业有什么影响？'
      ]
    },
    competitors: {
      role: '竞争情报分析专家',
      goal: '帮助用户全面分析竞争对手的优劣势、市场地位、核心能力等',
      prompts: [
        '主要竞争对手有哪些？',
        '他们的核心优势是什么？',
        '他们的市场策略如何？'
      ]
    },
    customer: {
      role: '客户洞察专家',
      goal: '帮助用户深入了解目标客户的画像、需求、购买决策因素等',
      prompts: [
        '核心客户群体是谁？',
        '客户在购买时最看重什么？',
        '客户的痛点是什么？'
      ]
    },
    company: {
      role: '企业诊断专家',
      goal: '帮助用户客观分析公司的现状、优势、短板、资源等',
      prompts: [
        '公司的核心优势是什么？',
        '当前面临的主要挑战是什么？',
        '有哪些关键资源或能力？'
      ]
    }
  };

  const config = moduleConfigs[module];

  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位${config.role}。

**目标**：${config.goal}

**对话策略**：
1. 通过提问引导用户逐步完善信息
2. 对用户输入的内容进行分析和提炼
3. 当信息足够完整时，输出结构化总结
4. 保持专业、友好的语气

**输出格式**：
根据对话进展，以 JSON 格式返回：
{
  "response": "你的回复内容",
  "extractedData": ["提炼的信息1", "提炼的信息2"],
  "questions": ["下一步追问1"],
  "isComplete": false
}

- response：给用户的回复
- extractedData：已提炼的关键信息（当有新信息时）
- questions：下一步的追问（当需要更多信息时）
- isComplete：分析是否完成（true 时可结束对话）`
    },
    ...chatHistory.map(msg => ({
      role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.content
    })),
    {
      role: 'user',
      content: userInput
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        response: parsed.response || response,
        extractedData: parsed.extractedData || [],
        questions: parsed.questions || [],
        isComplete: parsed.isComplete || false
      };
    }
  } catch (e) {
    // JSON 解析失败时，返回纯文本响应
    console.error('解析对话分析 JSON 失败，返回纯文本:', e);
  }

  return {
    response,
    isComplete: false
  };
}

/**
 * 简化的文件读取（模拟）
 * 实际项目中可以集成 pdf-parse、tesseract.js 等库
 */
export async function extractTextFromFile(file: File): Promise<string> {
  // 检查文件类型
  const isPDF = file.type === 'application/pdf';
  const isImage = file.type.startsWith('image/');

  if (isPDF) {
    // 模拟 PDF 读取
    // 实际项目需要使用 pdf-parse 或 pdf.js 等库
    return `[PDF 文件] ${file.name}\n文件大小: ${(file.size / 1024).toFixed(2)} KB\n\n这是一个 PDF 文件。在真实环境中，我们会使用 PDF 解析库提取文本内容。\n\n模拟提取的内容：\n1. 行业发展趋势概述\n2. 关键数据指标\n3. 重要结论和建议`;
  }

  if (isImage) {
    // 模拟图片 OCR 读取
    // 实际项目需要使用 tesseract.js 或云端 OCR 服务
    return `[图片文件] ${file.name}\n文件大小: ${(file.size / 1024).toFixed(2)} KB\n\n这是一张图片文件。在真实环境中，我们会使用 OCR 技术识别图片中的文字内容。\n\n模拟识别的内容：\n1. 图片中的关键信息\n2. 数据和图表内容\n3. 重要标注和说明`;
  }

  // 对于其他类型，返回基本信息
  return `[文件] ${file.name}\n文件类型: ${file.type}\n大小: ${(file.size / 1024).toFixed(2)} KB`;
}

// ========== Step 2 新增：洞察小结和 TOWS 交叉策略 ==========

/**
 * 生成洞察小结 (AI 分析外部环境)
 * 基于行业趋势、客户需求、竞对优势等信息，生成 SWOT 洞察
 */
export async function generateInsightSummary(
  apiKey: string,
  trends: string,
  customerKbf: string[],
  competitorCsf: Array<{ competitorName: string; advantage: string }>,
  companyInfo: string
): Promise<{
  strengths: string;
  weaknesses: string;
  opportunities: string;
  threats: string;
}> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的战略分析专家，擅长从外部环境分析中提炼 SWOT 洞察。

**任务目标**：
基于用户提供的行业趋势、客户需求、竞对优势、公司情况，生成一份"外部环境洞察小结"。

**分析逻辑**：
- **Strengths (优势)**：我司相对于竞对的独特能力（基于竞对CSF分析）
- **Weaknesses (劣势)**：我司存在的短板（基于竞对CSF对比）
- **Opportunities (机会)**：行业趋势中带来的增长点
- **Threats (威胁)**：行业趋势或竞争压力带来的风险

**输出要求**：
- 每个 SWOT 维度用 2-4 句话总结
- 具体化、可落地，避免泛泛而谈
- 直接引用输入信息中的关键要素`
    },
    {
      role: 'user',
      content: `请基于以下信息，生成外部环境洞察小结：

【行业趋势】
${trends}

【客户关键购买因素 (KBF)】
${customerKbf.map((kbf, i) => `${i + 1}. ${kbf}`).join('\n')}

【竞对核心优势 (CSF)】
${competitorCsf.map((csf, i) => `${i + 1}. ${csf.competitorName}：${csf.advantage}`).join('\n')}

【本公司情况】
${companyInfo}

请以 JSON 格式返回：
{
  "strengths": "我司优势总结（2-4句话）",
  "weaknesses": "我司劣势总结（2-4句话）",
  "opportunities": "行业机会总结（2-4句话）",
  "threats": "行业威胁总结（2-4句话）"
}`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('解析洞察小结 JSON 失败:', e);
  }

  return {
    strengths: '待分析',
    weaknesses: '待分析',
    opportunities: '待分析',
    threats: '待分析'
  };
}

/**
 * 生成 TOWS 交叉策略
 * 基于 SWOT 分析，生成 SO/WO/ST/WT 四类交叉策略
 */
export async function generateTOWSStrategies(
  apiKey: string,
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  },
  strategicDirection?: string
): Promise<{
  so: string[];
  wo: string[];
  st: string[];
  wt: string[];
}> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的战略规划专家，擅长使用 TOWS 矩阵（SWOT 交叉分析）生成战略选项。

**TOWS 分析框架**：
1. **SO 策略 (优势-机会)**：利用内部优势把握外部机会
   - 示例："利用我司技术领先优势，拓展新兴市场"

2. **WO 策略 (劣势-机会)**：弥补内部劣势以把握外部机会
   - 示例："通过战略合作补齐产能短板，抓住行业增长机遇"

3. **ST 策略 (优势-威胁)**：利用内部优势抵御外部威胁
   - 示例："发挥品牌优势，抵御低价竞争冲击"

4. **WT 策略 (劣势-威胁)**：减少内部劣势并规避外部威胁
   - 示例："收缩非核心业务，降低经营风险"

**输出要求**：
- 每类策略生成 2-3 条
- 策略要具体可落地，避免泛泛而谈
- 明确引用 SWOT 中的具体要素`
    },
    {
      role: 'user',
      content: `请基于以下 SWOT 分析，生成 TOWS 交叉策略：

【SWOT 分析】
**优势 (S)**：
${swot.strengths.map((s, i) => `${i + 1}. ${s}`).join('\n')}

**劣势 (W)**：
${swot.weaknesses.map((w, i) => `${i + 1}. ${w}`).join('\n')}

**机会 (O)**：
${swot.opportunities.map((o, i) => `${i + 1}. ${o}`).join('\n')}

**威胁 (T)**：
${swot.threats.map((t, i) => `${i + 1}. ${t}`).join('\n')}

${strategicDirection ? `【初步战略方向】\n${strategicDirection}\n` : ''}请以 JSON 格式返回：
{
  "so": ["SO策略1", "SO策略2"],
  "wo": ["WO策略1", "WO策略2"],
  "st": ["ST策略1", "ST策略2"],
  "wt": ["WT策略1", "WT策略2"]
}

要求：
- 每类策略至少 2 条
- 策略要明确引用 SWOT 中的具体要素`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('解析 TOWS JSON 失败:', e);
  }

  return {
    so: ['待分析：利用优势把握机会'],
    wo: ['待分析：弥补劣势把握机会'],
    st: ['待分析：利用优势抵御威胁'],
    wt: ['待分析：减少劣势规避威胁']
  };
}

/**
 * 生成产品-客户矩阵 (Ansoff 矩阵映射)
 * 基于 SWOT 和战略方向，推荐四个象限的具体策略
 */
export async function generateProductCustomerMatrix(
  apiKey: string,
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  },
  strategicDirection: string
): Promise<{
  marketPenetration: string[];
  productDevelopment: string[];
  marketDevelopment: string[];
  diversification: string[];
}> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的战略规划专家，擅长使用 Ansoff 矩阵（产品-市场矩阵）制定增长策略。

**Ansoff 矩阵框架**：
1. **市场渗透 (老客户+老产品)**：提高现有产品在现有市场的占有率
   - 策略：提升客户复购、交叉销售、价格优化、客户忠诚度计划

2. **产品开发 (老客户+新产品)**：向现有客户推出新产品/服务
   - 策略：产品线延伸、升级换代、增值服务、捆绑销售

3. **市场开发 (新产品+老客户)**：将现有产品推向新客户群/新区域
   - 策略：区域扩张、新客户群体、渠道拓展、出口贸易

4. **多元化 (新客户+新产品)**：进入全新业务领域
   - 策略：并购、战略投资、新业务孵化、战略联盟

**输出要求**：
- 每个象限推荐 2-3 条具体策略
- 策略要基于 SWOT 分析和战略方向
- 考虑风险收益平衡`
    },
    {
      role: 'user',
      content: `请基于以下信息，生成产品-客户增长矩阵：

【战略方向】
${strategicDirection}

【SWOT 分析】
**优势**：${swot.strengths.join('、')}
**劣势**：${swot.weaknesses.join('、')}
**机会**：${swot.opportunities.join('、')}
**威胁**：${swot.threats.join('、')}

请以 JSON 格式返回：
{
  "marketPenetration": ["策略1", "策略2", "策略3"],
  "productDevelopment": ["策略1", "策略2", "策略3"],
  "marketDevelopment": ["策略1", "策略2", "策略3"],
  "diversification": ["策略1", "策略2"]
}

要求：
- 每个象限至少 2 条策略
- 策略要具体可落地
- 优先推荐风险可控、收益明显的策略`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('解析产品-客户矩阵 JSON 失败:', e);
  }

  return {
    marketPenetration: [
      '提高现有客户复购率',
      '优化定价策略提升利润',
      '加强客户忠诚度计划'
    ],
    productDevelopment: [
      '向现有客户推出新产品',
      '提供增值服务套餐',
      '产品升级换代'
    ],
    marketDevelopment: [
      '拓展新的区域市场',
      '开发新的客户群体',
      '拓展新的销售渠道'
    ],
    diversification: [
      '探索新业务领域',
      '考虑战略并购机会'
    ]
  };
}

/**
 * Step 4: 生成 BSC 战略地图卡片
 * 基于 Step 2 的 SWOT 和 TOWS 分析，生成平衡计分卡四象限内容
 */
export async function generateBSCCards(
  apiKey: string,
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  },
  towsStrategies?: {
    so: string[];
    wo: string[];
    st: string[];
    wt: string[];
  },
  strategicDirection?: string
): Promise<{
  financial: { description: string; items: string[] };
  customer: { description: string; items: string[] };
  internalProcess: { description: string; items: string[] };
  learningGrowth: { description: string; items: string[] };
}> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的战略规划专家，擅长使用平衡计分卡（Balanced Scorecard, BSC）将战略目标转化为可视化的战略地图。

**BSC 四象限说明**：
1. **财务层面**：我们要如何满足股东期望？
   - 关注：营收增长、利润率、ROI、资产回报率
   - 指标：营收、利润、现金流、资产周转率

2. **客户层面**：我们要如何满足客户期望？
   - 关注：客户满意度、市场份额、客户忠诚度
   - 指标：客户保留率、NPS、市场份额、客户获取成本

3. **内部流程层面**：我们要在哪些业务流程上做到卓越？
   - 关注：运营效率、创新能力、流程优化
   - 指标：生产周期、次品率、流程效率、响应速度

4. **学习与成长层面**：我们要如何保持持续改进和创造价值的能力？
   - 关注：人才发展、组织文化、创新能力
   - 指标：员工满意度、培训覆盖率、创新项目数、员工流失率

**输出要求**：
- 每个象限包含：描述性标题（1句话）+ 3-5个关键战略目标
- 基于用户的 SWOT 和 TOWS 分析结果
- 确保四个象限之间有因果逻辑关系（学习成长 → 内部流程 → 客户 → 财务）`
    },
    {
      role: 'user',
      content: `请基于以下 SWOT 和 TOWS 分析，生成 BSC 战略地图四象限内容：

**战略方向**：
${strategicDirection || '未明确'}

**SWOT 分析**：
优势 (S)：${swot.strengths.join('、')}
劣势 (W)：${swot.weaknesses.join('、')}
机会 (O)：${swot.opportunities.join('、')}
威胁 (T)：${swot.threats.join('、')}

${towsStrategies ? `**TOWS 交叉策略**：
SO 策略（优势-机会）：${towsStrategies.so.join('；')}
WO 策略（劣势-机会）：${towsStrategies.wo.join('；')}
ST 策略（优势-威胁）：${towsStrategies.st.join('；')}
WT 策略（劣势-威胁）：${towsStrategies.wt.join('；')}` : ''}

请以 JSON 格式返回：
{
  "financial": {
    "description": "财务层面的战略描述（1句话，15-30字）",
    "items": ["财务目标1", "财务目标2", "财务目标3", "财务目标4"]
  },
  "customer": {
    "description": "客户层面的战略描述（1句话，15-30字）",
    "items": ["客户目标1", "客户目标2", "客户目标3", "客户目标4"]
  },
  "internalProcess": {
    "description": "内部流程层面的战略描述（1句话，15-30字）",
    "items": ["流程目标1", "流程目标2", "流程目标3", "流程目标4"]
  },
  "learningGrowth": {
    "description": "学习与成长层面的战略描述（1句话，15-30字）",
    "items": ["学习目标1", "学习目标2", "学习目标3", "学习目标4"]
  }
}

**要求**：
- 每个象限至少 3-5 个关键目标
- 目标要具体可衡量，避免泛泛而谈
- 四个象限之间要有因果逻辑链
- 基于用户的 SWOT 和 TOWS 分析结果`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        financial: {
          description: parsed.financial?.description || '提升财务绩效',
          items: parsed.financial?.items || ['增加营收', '提高利润率']
        },
        customer: {
          description: parsed.customer?.description || '提升客户价值',
          items: parsed.customer?.items || ['提高客户满意度', '扩大市场份额']
        },
        internalProcess: {
          description: parsed.internalProcess?.description || '优化运营效率',
          items: parsed.internalProcess?.items || ['提高生产效率', '优化流程']
        },
        learningGrowth: {
          description: parsed.learningGrowth?.description || '培养组织能力',
          items: parsed.learningGrowth?.items || ['加强人才培养', '提升创新能力']
        }
      };
    }
  } catch (e) {
    console.error('解析 BSC 卡片 JSON 失败:', e);
  }

  // 返回默认 BSC 结构
  return {
    financial: {
      description: '提升财务绩效，实现可持续增长',
      items: ['增加营收规模', '提高利润率', '优化现金流', '提升资产回报率']
    },
    customer: {
      description: '提升客户价值，增强市场竞争力',
      items: ['提高客户满意度', '扩大市场份额', '降低客户流失率', '提升品牌影响力']
    },
    internalProcess: {
      description: '优化内部流程，提升运营效率',
      items: ['提高生产效率', '优化产品质量', '缩短交付周期', '降低运营成本']
    },
    learningGrowth: {
      description: '培养组织能力，支撑持续发展',
      items: ['加强人才培养', '提升创新能力', '优化组织文化', '完善激励机制']
    }
  };
}

/**
 * Step 4: AI 智能映射 - 将 BSC 战略地图映射到 3力3平台行动计划表
 * 基于用户确认的 BSC 四象限内容，智能填充表格的后 6 列
 */
export async function mapBSCToActionPlan(
  apiKey: string,
  bscCards: {
    financial: { description: string; items: string[] };
    customer: { description: string; items: string[] };
    internalProcess: { description: string; items: string[] };
    learningGrowth: { description: string; items: string[] };
  },
  actionPlanRows: Array<{
    seqNumber: number;
    customerGroup: string;
    product: string;
    revenueTarget: number;
  }>
): Promise<{
  salesForce: Record<number, string>;
  productForce: Record<number, string>;
  deliveryForce: Record<number, string>;
  hr: Record<number, string>;
  financeAssets: Record<number, string>;
  digitalProcess: Record<number, string>;
}> {
  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的战略执行专家，擅长将战略地图（BSC 平衡计分卡）转化为可执行的行动计划。

**任务目标**：
将用户已确认的 BSC（平衡计分卡）四象限内容，智能映射填充到"3力3平台战略行动计划表"的后 6 列（3力+3平台）。

**BSC 四象限说明**：
1. **财务层面**：关注财务目标、ROI、营收增长
2. **客户层面**：关注客户满意度、市场份额、客户关系
3. **内部流程层面**：关注运营效率、流程优化、协同能力
4. **学习与成长层面**：关注人才培养、创新能力、组织学习

**表格结构**：
- 前 4 列：序号、客户群、产品、营收目标（只读，来自 Step 3）
- 后 6 列：销售力、产品力、交付力、人力、财务&资产、数字化&流程（可编辑，你需要填充）

**映射规则**：
- **财务层面**卡片的描述 → 财务&资产列
- **客户层面**卡片的描述 → 根据内容判断：
  * 提到"渠道"、"关系"、"拓展" → 分入【销售力】列
  * 提到"性能"、"质量"、"研发"、"创新" → 分入【产品力】列
  * 提到"响应"、"物流"、"交付"、"服务" → 分入【交付力】列
- **内部流程层面**卡片的描述 → 人力列
- **学习与成长层面**卡片的描述 → 数字化&流程列

**重要约束**：
- 如果描述涉及多个维度，优先填入最相关的列
- 保持语言简洁、可执行（每条1-2句话）
- 避免空值，如果无法判断就填入"待分析"

请为每一行生成对应列的策略内容，以 JSON 格式返回。`
    },
    {
      role: 'user',
      content: `请根据以下 BSC 战略地图和行动计划表数据，智能填充后 6 列：

**BSC 四象限内容**：

【财务层面】
描述：${bscCards.financial.description}
项目：${bscCards.financial.items.join('、')}

【客户层面】
描述：${bscCards.customer.description}
项目：${bscCards.customer.items.join('、')}

【内部流程层面】
描述：${bscCards.internalProcess.description}
项目：${bscCards.internalProcess.items.join('、')}

【学习与成长层面】
描述：${bscCards.learningGrowth.description}
项目：${bscCards.learningGrowth.items.join('、')}

**行动计划表（当前数据）**：
${actionPlanRows.map((row, idx) => `
第 ${row.seqNumber} 行：
- 客户群：${row.customerGroup}
- 产品：${row.product}
- 营收目标：${row.revenueTarget}万元
`).join('\n')}

请为每一行生成对应的6列策略内容，以JSON格式返回：
{
  "salesForce": {
    "0": "第0行的销售力策略",
    "1": "第1行的销售力策略"
  },
  "productForce": {
    "0": "第0行的产品力策略",
    "1": "第1行的产品力策略"
  },
  "deliveryForce": {
    "0": "第0行的交付力策略",
    "1": "第1行的交付力策略"
  },
  "hr": {
    "0": "第0行的人力策略",
    "1": "第1行的人力策略"
  },
  "financeAssets": {
    "0": "第0行的财务&资产策略",
    "1": "第1行的财务&资产策略"
  },
  "digitalProcess": {
    "0": "第0行的数字化&流程策略",
    "1": "第1行的数字化&流程策略"
  }
}

**要求**：
- 每个策略1-2句话，具体可执行
- 优先匹配最相关的维度
- 保持与BSC内容一致
- 避免空值，无法判断时填"-"`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const mapped = JSON.parse(jsonMatch[0]);
      return {
        salesForce: mapped.salesForce || {},
        productForce: mapped.productForce || {},
        deliveryForce: mapped.deliveryForce || {},
        hr: mapped.hr || {},
        financeAssets: mapped.financeAssets || {},
        digitalProcess: mapped.digitalProcess || {}
      };
    }
  } catch (e) {
    console.error('解析 BSC 映射 JSON 失败:', e);
  }

  // 返回默认映射（如果解析失败）
  return {
    salesForce: {},
    productForce: {},
    deliveryForce: {},
    hr: {},
    financeAssets: {},
    digitalProcess: {}
  };
}

/**
 * Step 4: 生成聚焦式战略地图（重构版）
 * 采用"倒推法"思维链，基于 Step 1-3 上下文智能判断战略主题
 */
export async function generateStrategyMap(
  apiKey: string,
  step1RootCause: string,
  step2Swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  },
  step2TowsStrategies?: {
    so: string[];
    wo: string[];
    st: string[];
    wt: string[];
  },
  step3MatrixData?: {
    oldClients: string[];
    newClients: string[];
    oldProducts: string[];
    newProducts: string[];
    values: { [key: string]: number };
  },
  step3TargetAmount?: number
): Promise<{
  theme: 'product-leadership' | 'customer-intimacy' | 'operational-excellence';
  themeDescription: string;
  targetAmount: number;
  layers: {
    financial: Array<{
      id: string;
      layer: 'financial';
      number: number;
      title: string;
      description: string;
      items: string[];
      parentCardIds: string[];
      childCardIds: string[];
      isHighlighted: boolean;
      isEditable: boolean;
    }>;
    customer: Array<{
      id: string;
      layer: 'customer';
      number: number;
      title: string;
      description: string;
      items: string[];
      parentCardIds: string[];
      childCardIds: string[];
      isHighlighted: boolean;
      isEditable: boolean;
    }>;
    process: Array<{
      id: string;
      layer: 'process';
      number: number;
      title: string;
      description: string;
      items: string[];
      parentCardIds: string[];
      childCardIds: string[];
      isHighlighted: boolean;
      isEditable: boolean;
    }>;
    learning: Array<{
      id: string;
      layer: 'learning';
      number: number;
      title: string;
      description: string;
      items: string[];
      parentCardIds: string[];
      childCardIds: string[];
      isHighlighted: boolean;
      isEditable: boolean;
    }>;
  };
  confirmed: boolean;
}> {
  // 第一步：分析增长来源，判断战略主题
  let theme: 'product-leadership' | 'customer-intimacy' | 'operational-excellence' = 'operational-excellence';
  let themeDescription = '卓越运营：重点在降本增效';
  let growthAnalysis = '';

  if (step3MatrixData) {
    let newProductRevenue = 0;     // 新产品收入
    let newCustomerRevenue = 0;    // 新客户收入
    let existingCustomerDeepDive = 0; // 老客户深挖收入

    // 计算新产品收入
    for (const client of [...step3MatrixData.oldClients, ...step3MatrixData.newClients]) {
      for (const product of step3MatrixData.newProducts) {
        newProductRevenue += step3MatrixData.values[`${client}_${product}`] || 0;
      }
    }

    // 计算新客户收入
    for (const client of step3MatrixData.newClients) {
      for (const product of [...step3MatrixData.oldProducts, ...step3MatrixData.newProducts]) {
        newCustomerRevenue += step3MatrixData.values[`${client}_${product}`] || 0;
      }
    }

    // 计算老客户深挖（老客户+老产品）
    for (const client of step3MatrixData.oldClients) {
      for (const product of step3MatrixData.oldProducts) {
        existingCustomerDeepDive += step3MatrixData.values[`${client}_${product}`] || 0;
      }
    }

    // 判断战略主题
    if (newProductRevenue > existingCustomerDeepDive * 1.3) {
      theme = 'product-leadership';
      themeDescription = '产品领先：重点在研发创新，打造差异化产品';
      growthAnalysis = `主要增长来自新产品（¥${newProductRevenue}万），战略重心应放在产品创新和研发能力上。`;
    } else if (newCustomerRevenue > existingCustomerDeepDive * 1.3) {
      theme = 'customer-intimacy';
      themeDescription = '客户亲密：重点在服务体验，深化客户关系';
      growthAnalysis = `主要增长来自新客户获取（¥${newCustomerRevenue}万），战略重心应放在客户获客和服务体验上。`;
    } else {
      // 检查是否有成本相关的核心短板
      const rootCauseLower = step1RootCause.toLowerCase();
      if (rootCauseLower.includes('成本') || rootCauseLower.includes('效率') || rootCauseLower.includes('费用') || rootCauseLower.includes('利润')) {
        theme = 'operational-excellence';
        themeDescription = '卓越运营：重点在降本增效，提升运营效率';
        growthAnalysis = `核心短板与成本/效率相关，且主要收入来自现有客户（¥${existingCustomerDeepDive}万），战略重心应放在提升运营效率和降低成本上。`;
      } else {
        // 默认：根据最大增长来源决定
        const maxRevenue = Math.max(newProductRevenue, newCustomerRevenue, existingCustomerDeepDive);
        if (maxRevenue === newProductRevenue) {
          theme = 'product-leadership';
          themeDescription = '产品领先：重点在研发创新，打造差异化产品';
          growthAnalysis = `主要收入来自新产品（¥${newProductRevenue}万），战略重心应放在产品创新上。`;
        } else if (maxRevenue === newCustomerRevenue) {
          theme = 'customer-intimacy';
          themeDescription = '客户亲密：重点在服务体验，深化客户关系';
          growthAnalysis = `主要收入来自新客户（¥${newCustomerRevenue}万），战略重心应放在客户关系上。`;
        } else {
          theme = 'operational-excellence';
          themeDescription = '卓越运营：重点在降本增效，深耕现有客户';
          growthAnalysis = `主要收入来自现有客户深挖（¥${existingCustomerDeepDive}万），战略重心应放在提升客户满意度和运营效率上。`;
        }
      }
    }
  }

  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的战略规划专家，擅长使用"倒推法"（Cascading Goals）构建聚焦式的平衡计分卡战略地图。

**核心理念：不要面面俱到，要聚焦**

企业资源有限，一年内只能打赢 1-2 场关键战役。因此：
- 不要在每个层级都列满指标
- 每个层级只列出 2-3 个最关键的战略目标
- 所有目标都必须直接支撑年度财务目标

**倒推法思维链**（从上往下拆解）：

1. **财务层 (Financial)** - 顶层锚点
   - 目标金额：¥${step3TargetAmount || 0}万
   - 拆解：为了达成这个目标，我们需要在"营收增长"和"利润提升"之间如何权衡？

2. **客户层 (Customer)** - 价值主张
   - 思考：为了实现财务目标，我们要给客户创造什么独特价值？
   - ${theme === 'product-leadership' ? '产品领先战略：客户购买的是"创新"和"差异化"' : ''}
   - ${theme === 'customer-intimacy' ? '客户亲密战略：客户购买的是"贴心服务"和"定制化"' : ''}
   - ${theme === 'operational-excellence' ? '卓越运营战略：客户购买的是"性价比"和"可靠性"' : ''}

3. **流程层 (Process)** - 关键能力
   - 思考：为了提供上述客户价值，哪个内部流程必须做到行业顶尖？
   - ${theme === 'product-leadership' ? '聚焦：研发流程、产品迭代流程、创新管理流程' : ''}
   - ${theme === 'customer-intimacy' ? '聚焦：客户服务流程、客户关系管理、需求挖掘流程' : ''}
   - ${theme === 'operational-excellence' ? '聚焦：供应链流程、成本控制流程、质量管理流程' : ''}

4. **学习层 (Learning)** - 支撑体系
   - 思考：为了让这个流程卓越，我们需要什么样的人才和系统？
   - 聚焦：关键人才能力、数据系统、组织激励

**输出规则**：
- 每个层级 2-3 个卡片即可
- 卡片标题：简短的动宾短语（如"提升客单价"、"加速产品迭代"）
- 每个卡片 3-5 个具体举措
- 高亮 3-5 个"必赢战役"（通常在流程层和学习层）

**编号系统**：
- 财务层：F1, F2, F3...
- 客户层：C1, C2, C3...
- 流程层：P1, P2, P3...
- 学习层：L1, L2, L3...

**因果连接**（parentCardIds 和 childCardIds）：
- F1 → C1（F1 依赖 C1 的达成）
- C1 → P1（C1 需要 P1 的支撑）
- P1 → L1（P1 需要 L1 的支撑）
- 确保形成完整的因果链条`
    },
    {
      role: 'user',
      content: `请基于以下信息，生成聚焦式战略地图：

**年度战略主题**：${themeDescription}

**增长来源分析**：
${growthAnalysis}

**Step 1 - 核心短板（根因）**：
${step1RootCause}

**Step 2 - SWOT 分析**：
优势 (S)：${step2Swot.strengths.join('、')}
劣势 (W)：${step2Swot.weaknesses.join('、')}
机会 (O)：${step2Swot.opportunities.join('、')}
威胁 (T)：${step2Swot.threats.join('、')}

${step2TowsStrategies ? `**TOWS 交叉策略**：
SO 策略：${step2TowsStrategies.so.join('；')}
WO 策略：${step2TowsStrategies.wo.join('；')}
ST 策略：${step2TowsStrategies.st.join('；')}
WT 策略：${step2TowsStrategies.wt.join('；')}` : ''}

**Step 3 - 目标金额**：¥${step3TargetAmount || 0}万

请以 JSON 格式返回战略地图：
{
  "theme": "${theme}",
  "themeDescription": "${themeDescription}",
  "targetAmount": ${step3TargetAmount || 0},
  "layers": {
    "financial": [
      {
        "id": "F1",
        "layer": "financial",
        "number": 1,
        "title": "财务目标1",
        "description": "详细描述",
        "items": ["举措1", "举措2", "举措3"],
        "parentCardIds": [],
        "childCardIds": ["C1"],
        "isHighlighted": false,
        "isEditable": true
      }
    ],
    "customer": [...],
    "process": [...],
    "learning": [...]
  },
  "confirmed": false
}

**重要**：
- 根据战略主题 ${theme} 聚焦关键目标
- 每个层级 2-3 个卡片
- 必赢战役标记在流程层和学习层
- 确保因果链条完整（F→C→P→L）`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    }
  } catch (e) {
    console.error('解析战略地图 JSON 失败:', e);
  }

  // 返回默认结构
  return {
    theme,
    themeDescription,
    targetAmount: step3TargetAmount || 0,
    layers: {
      financial: [],
      customer: [],
      process: [],
      learning: []
    },
    confirmed: false
  };
}

/**
 * 生成单个层级的战略卡片建议（用于 AI 侧边栏）
 * 根据用户点击的泳道，提供针对性的战略要素建议
 */
export async function generateCardSuggestions(
  apiKey: string,
  context: {
    targetAmount: number;
    rootCause: string;
    swot?: {
      strengths: string[];
      weaknesses: string[];
      opportunities: string[];
      threats: string[];
    };
    towsStrategies?: {
      so: string[];
      wo: string[];
      st: string[];
      wt: string[];
    };
  },
  swimlane: 'financial' | 'customer' | 'process' | 'learning',
  existingNodes: any[] = []
): Promise<Array<{
  title: string;
  description: string;
  items: string[];
}>> {
  // 分析已存在的卡片，避免重复
  const existingTitles = existingNodes.map(n => n.data?.title || '').filter(Boolean);

  const layerPrompts = {
    financial: {
      question: '为了达成年度目标，在财务层面我们应该关注哪些关键指标？',
      focus: '财务层面的核心指标通常包括：营收增长、利润率、成本控制、现金流等。'
    },
    customer: {
      question: '为了实现财务目标，我们应该给客户创造什么独特价值？',
      focus: '客户价值主张可以是：产品差异化、价格优势、服务体验、品牌形象等。'
    },
    process: {
      question: '为了提供上述客户价值，哪个内部流程必须做到行业顶尖？',
      focus: '关键流程包括：研发创新、生产制造、供应链、客户服务、营销获客等。'
    },
    learning: {
      question: '为了让关键流程卓越，我们需要什么样的人才和系统支撑？',
      focus: '学习成长要素包括：关键人才、技能培训、数据系统、组织文化、激励机制等。'
    }
  };

  const messages: ZhipuMessage[] = [
    {
      role: 'system',
      content: `你是一位资深的战略规划专家，擅长为平衡计分卡的各个层级提供精准的战略要素建议。

**你的任务**：
当用户点击某个层级（泳道）时，为该层级推荐 3-5 个具体的战略目标卡片。

**层级特点**：
- **财务层**：关注营收、利润、成本、现金流等财务指标
- **客户层**：关注价值主张、客户满意度、市场份额、品牌形象
- **流程层**：关注研发、生产、供应链、服务等关键流程
- **学习层**：关注人才、技能、系统、文化、激励等支撑体系

**输出规则**：
- 每个建议包含：标题（动宾短语）、描述、3-5个具体举措
- 标题要简短有力（如"提升客户满意度"、"加速产品迭代"）
- 避免与已存在的卡片重复
- 结合用户的具体情况（根因、SWOT）提供针对性建议`
    },
    {
      role: 'user',
      content: `请为 ${layerPrompts[swimlane].question}

**上下文信息**：
- 年度目标金额：¥${context.targetAmount}万
- 核心短板：${context.rootCause}

${context.swot ? `**SWOT 分析**：
优势：${context.swot.strengths.join('、')}
劣势：${context.swot.weaknesses.join('、')}
机会：${context.swot.opportunities.join('、')}
威胁：${context.swot.threats.join('、')}` : ''}

${context.towsStrategies ? `**TOWS 策略**：
SO：${context.towsStrategies.so.join('；')}
WO：${context.towsStrategies.wo.join('；')}
ST：${context.towsStrategies.st.join('；')}
WT：${context.towsStrategies.wt.join('；')}` : ''}

${existingTitles.length > 0 ? `**已存在的卡片**：${existingTitles.join('、')}（请避免重复）` : ''}

**指导说明**：
${layerPrompts[swimlane].focus}

请以 JSON 数组格式返回建议：
[
  {
    "title": "提升客户满意度",
    "description": "通过提升服务质量，增强客户粘性",
    "items": ["建立客户反馈机制", "优化服务流程", "提升客服响应速度", "定期客户回访"]
  },
  ...
]`
    }
  ];

  const response = await callZhipuAPI(apiKey, messages);

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('解析卡片建议 JSON 失败:', e);
  }

  // 返回默认建议
  const defaultSuggestions = {
    financial: [
      {
        title: '提升营收增长率',
        description: '通过扩大客户基础和提升客单价实现营收增长',
        items: ['拓展新客户', '提升复购率', '优化产品定价', '推出增值服务']
      },
      {
        title: '优化成本结构',
        description: '通过运营优化降低成本，提升利润率',
        items: ['降低采购成本', '提升运营效率', '减少浪费', '优化人员配置']
      }
    ],
    customer: [
      {
        title: '提升客户满意度',
        description: '提供卓越的客户体验，增强客户忠诚度',
        items: ['建立客户反馈机制', '优化服务流程', '提升客服响应速度', '定期客户回访']
      },
      {
        title: '打造品牌差异化',
        description: '建立独特的品牌定位，与竞争对手区分开来',
        items: ['明确品牌定位', '塑造品牌故事', '统一品牌形象', '加强品牌传播']
      }
    ],
    process: [
      {
        title: '加速产品创新',
        description: '快速响应市场需求，推出有竞争力的产品',
        items: ['建立研发流程', '加强市场调研', '缩短产品迭代周期', '鼓励创新思维']
      },
      {
        title: '优化供应链管理',
        description: '建立高效稳定的供应链体系',
        items: ['优化供应商选择', '建立安全库存', '提升物流效率', '数字化供应链管理']
      }
    ],
    learning: [
      {
        title: '培养关键人才',
        description: '建立人才梯队，支撑业务发展',
        items: ['建立培训体系', '导师制度', '职业发展规划', '激励机制']
      },
      {
        title: '建设数据系统',
        description: '用数据驱动决策，提升运营效率',
        items: ['建立数据仓库', 'BI分析系统', '数据治理体系', '培养数据思维']
      }
    ]
  };

  return defaultSuggestions[swimlane] || [];
}
