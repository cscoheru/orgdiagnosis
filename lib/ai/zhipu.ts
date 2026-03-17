/**
 * 智谱 AI (ZhipuAI) 封装
 * 使用直接 HTTP 请求调用 API
 */

import { SYSTEM_PROMPT, generateUserPrompt } from './prompts/five-dimensions';
import type { FiveDimensionsData, ExtractionResult } from '@/types/diagnosis';

// 智谱 API 配置
const ZHIPU_API_URL = process.env.ZHIPU_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_API_KEY = process.env.ZHIPUAI_API_KEY;

// Mock 模式：当 API 不可用时使用模拟数据
const USE_MOCK = process.env.USE_MOCK_AI === 'true' || !ZHIPU_API_KEY || ZHIPU_API_KEY === 'your_zhipuai_api_key_here';

// Mock 数据生成函数
function generateMockData(rawText: string): FiveDimensionsData {
  // 简单的关键词匹配来模拟 AI 分析
  const text = rawText.toLowerCase();

  const mockData: FiveDimensionsData = {
    strategy: {
      label: '战略',
      description: '做正确的事',
      score: 72,
      L2_categories: {
        business_status: {
          score: 65,
          label: '业务现状',
          L3_items: {
            performance_gap: {
              score: text.includes('营收') || text.includes('增长') ? 60 : 70,
              evidence: text.includes('增长') ? '原文提及营收增长相关内容' : '未提及具体业绩差距',
              confidence: 'medium'
            },
            opportunity_gap: {
              score: text.includes('机会') || text.includes('错过') ? 55 : 70,
              evidence: text.includes('机会') ? '原文提及市场机会相关内容' : '未提及机会差距',
              confidence: 'medium'
            }
          }
        },
        strategic_planning: {
          score: 75,
          label: '战略规划',
          L3_items: {
            market_insight: { score: 78, evidence: '模拟数据 - 市场洞察', confidence: 'low' },
            strategic_intent: { score: 75, evidence: '模拟数据 - 战略意图', confidence: 'low' },
            innovation_focus: { score: 72, evidence: '模拟数据 - 创新焦点', confidence: 'low' },
            business_design: { score: 75, evidence: '模拟数据 - 业务设计', confidence: 'low' }
          }
        },
        strategy_execution: {
          score: 68,
          label: '战略执行',
          L3_items: {
            critical_tasks: { score: 65, evidence: '模拟数据 - 关键任务', confidence: 'low' },
            organizational_support: { score: 70, evidence: '模拟数据 - 组织支撑', confidence: 'low' },
            talent_readiness: { score: 60, evidence: '模拟数据 - 人才准备', confidence: 'low' },
            corporate_culture: { score: 77, evidence: '模拟数据 - 企业文化', confidence: 'low' }
          }
        },
        strategy_evaluation: {
          score: 80,
          label: '战略评估',
          L3_items: {
            business_analysis: { score: 82, evidence: '模拟数据 - 经营分析', confidence: 'low' },
            execution_evaluation: { score: 78, evidence: '模拟数据 - 执行评价', confidence: 'low' },
            strategy_iteration: { score: 80, evidence: '模拟数据 - 战略迭代', confidence: 'low' }
          }
        }
      }
    },
    structure: {
      label: '组织',
      description: '提升系统运转效率',
      score: 65,
      L2_categories: {
        organizational_structure: {
          score: 60,
          label: '组织架构',
          L3_items: {
            structure_type: { score: 62, evidence: '模拟数据 - 架构形态', confidence: 'low' },
            layers_and_span: { score: 55, evidence: '模拟数据 - 管理层级', confidence: 'low' },
            departmental_boundaries: { score: 63, evidence: '模拟数据 - 部门边界', confidence: 'low' }
          }
        },
        authority_and_responsibility: {
          score: 68,
          label: '权责分配',
          L3_items: {
            decision_mechanism: { score: 70, evidence: '模拟数据 - 决策机制', confidence: 'low' },
            delegation_system: { score: 65, evidence: '模拟数据 - 授权体系', confidence: 'low' },
            role_definitions: { score: 69, evidence: '模拟数据 - 岗位指引', confidence: 'low' }
          }
        },
        collaboration_and_processes: {
          score: text.includes('协作') || text.includes('部门墙') ? 55 : 65,
          label: '协同流程',
          L3_items: {
            core_processes: { score: 68, evidence: '模拟数据 - 核心流程', confidence: 'low' },
            cross_functional_collaboration: { score: text.includes('协作') ? 50 : 65, evidence: text.includes('协作') ? '原文提及跨部门协作问题' : '模拟数据', confidence: 'medium' },
            process_digitalization: { score: 62, evidence: '模拟数据 - 流程数字化', confidence: 'low' }
          }
        },
        organizational_effectiveness: {
          score: 68,
          label: '组织效能',
          L3_items: {
            per_capita_efficiency: { score: 70, evidence: '模拟数据 - 人效指标', confidence: 'low' },
            agility: { score: 66, evidence: '模拟数据 - 响应速度', confidence: 'low' }
          }
        }
      }
    },
    performance: {
      label: '绩效',
      description: '明确指挥棒',
      score: text.includes('绩效') || text.includes('考核') || text.includes('kpi') ? 52 : 60,
      L2_categories: {
        system_design: {
          score: 50,
          label: '绩效体系设计',
          L3_items: {
            goal_setting_tools: { score: 52, evidence: '模拟数据 - 目标设定', confidence: 'low' },
            metric_cascading: { score: 48, evidence: '模拟数据 - 指标分解', confidence: 'low' },
            weights_and_standards: { score: 50, evidence: '模拟数据 - 权重标准', confidence: 'low' }
          }
        },
        process_management: {
          score: 55,
          label: '过程管理',
          L3_items: {
            goal_tracking: { score: 58, evidence: '模拟数据 - 目标跟进', confidence: 'low' },
            performance_coaching: { score: 52, evidence: '模拟数据 - 绩效辅导', confidence: 'low' },
            data_collection: { score: 55, evidence: '模拟数据 - 数据收集', confidence: 'low' }
          }
        },
        appraisal_and_feedback: {
          score: text.includes('公平') ? 48 : 58,
          label: '考核与反馈',
          L3_items: {
            appraisal_fairness: { score: text.includes('公平') ? 45 : 60, evidence: text.includes('公平') ? '原文提及考核公平性问题' : '模拟数据', confidence: 'medium' },
            feedback_quality: { score: 60, evidence: '模拟数据 - 面谈质量', confidence: 'low' },
            grievance_mechanism: { score: 58, evidence: '模拟数据 - 申诉机制', confidence: 'low' }
          }
        },
        result_application: {
          score: 55,
          label: '结果应用',
          L3_items: {
            link_to_rewards: { score: 58, evidence: '模拟数据 - 激励挂钩', confidence: 'low' },
            promotion_and_elimination: { score: 52, evidence: '模拟数据 - 晋升淘汰', confidence: 'low' },
            link_to_learning_and_development: { score: 55, evidence: '模拟数据 - 培训发展', confidence: 'low' }
          }
        }
      }
    },
    compensation: {
      label: '薪酬',
      description: '提供核心动力',
      score: 68,
      L2_categories: {
        compensation_strategy: {
          score: 70,
          label: '薪酬策略',
          L3_items: {
            market_positioning: { score: 68, evidence: '模拟数据 - 市场定位', confidence: 'low' },
            fixed_vs_variable_mix: { score: 72, evidence: '模拟数据 - 固浮比', confidence: 'low' },
            internal_equity: { score: 70, evidence: '模拟数据 - 内部公平', confidence: 'low' }
          }
        },
        compensation_structure: {
          score: 66,
          label: '薪酬结构',
          L3_items: {
            base_pay: { score: 68, evidence: '模拟数据 - 基本工资', confidence: 'low' },
            short_term_incentives: { score: 65, evidence: '模拟数据 - 短期激励', confidence: 'low' },
            long_term_incentives: { score: 55, evidence: '模拟数据 - 长期激励', confidence: 'low' },
            benefits_and_allowances: { score: 72, evidence: '模拟数据 - 弹性福利', confidence: 'low' }
          }
        },
        management_and_budgeting: {
          score: 68,
          label: '管理与预算',
          L3_items: {
            payroll_management: { score: 70, evidence: '模拟数据 - 总额管控', confidence: 'low' },
            salary_adjustment: { score: 65, evidence: '模拟数据 - 调薪机制', confidence: 'low' },
            pay_transparency: { score: 60, evidence: '模拟数据 - 薪酬沟通', confidence: 'low' }
          }
        }
      }
    },
    talent: {
      label: '人才',
      description: '打造核心资产',
      score: text.includes('人才') || text.includes('流失') || text.includes('离职') ? 50 : 58,
      L2_categories: {
        planning_and_review: {
          score: 58,
          label: '规划与盘点',
          L3_items: {
            competency_models: { score: 60, evidence: '模拟数据 - 胜任力模型', confidence: 'low' },
            talent_review: { score: 55, evidence: '模拟数据 - 人才盘点', confidence: 'low' },
            pipeline_health: { score: 59, evidence: '模拟数据 - 梯队健康', confidence: 'low' }
          }
        },
        acquisition_and_allocation: {
          score: 55,
          label: '获取与配置',
          L3_items: {
            employer_branding: { score: 58, evidence: '模拟数据 - 雇主品牌', confidence: 'low' },
            recruitment_precision: { score: 52, evidence: '模拟数据 - 招聘精准', confidence: 'low' },
            internal_mobility: { score: 48, evidence: '模拟数据 - 内部流动', confidence: 'low' }
          }
        },
        training_and_development: {
          score: 60,
          label: '培养与发展',
          L3_items: {
            onboarding: { score: 65, evidence: '模拟数据 - 融入体系', confidence: 'low' },
            leadership_development: { score: 55, evidence: '模拟数据 - 骨干培养', confidence: 'low' },
            career_pathways: { score: 55, evidence: '模拟数据 - 职业通道', confidence: 'low' }
          }
        },
        retention_and_engagement: {
          score: text.includes('流失') || text.includes('离职') ? 45 : 55,
          label: '保留与激励',
          L3_items: {
            key_talent_turnover: { score: text.includes('流失') || text.includes('离职') ? 40 : 55, evidence: text.includes('流失') ? '原文提及人才流失问题' : '模拟数据', confidence: 'medium' },
            employee_engagement: { score: 58, evidence: '模拟数据 - 员工敬业', confidence: 'low' },
            non_financial_incentives: { score: 52, evidence: '模拟数据 - 非物质激励', confidence: 'low' }
          }
        }
      }
    },
    overall_score: 62
  };

  // 重新计算聚合分数
  calculateAggregatedScores(mockData);

  return mockData;
}

/**
 * 从原始文本中抽取五维诊断数据
 */
export async function extractDiagnosisData(rawText: string): Promise<ExtractionResult> {
  const startTime = Date.now();

  // Mock 模式：使用模拟数据
  if (USE_MOCK) {
    console.log('[Mock Mode] Using mock data instead of AI API');
    await new Promise(resolve => setTimeout(resolve, 1500)); // 模拟延迟
    const mockData = generateMockData(rawText);
    return {
      success: true,
      data: mockData,
      processing_time: Date.now() - startTime
    };
  }

  try {
    const response = await fetch(ZHIPU_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'glm-4',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: generateUserPrompt(rawText) }
        ],
        temperature: 0.3,
        max_tokens: 4096
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ZhipuAI API error response:', errorText);

      // 429 或余额不足时自动切换到 Mock 模式
      if (response.status === 429 ||
          errorText.includes('余额不足') ||
          errorText.includes('无可用资源包') ||
          errorText.includes('请充值') ||
          errorText.includes('1113')) {
        console.log('[Auto Mock] API quota exceeded, using mock data');
        const mockData = generateMockData(rawText);
        return {
          success: true,
          data: mockData,
          processing_time: Date.now() - startTime
        };
      }

      return {
        success: false,
        error: `${response.status} ${errorText}`,
        processing_time: Date.now() - startTime
      };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        error: 'No response content from AI',
        processing_time: Date.now() - startTime
      };
    }

    // 解析 JSON 响应
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;

    try {
      const data = JSON.parse(jsonStr) as FiveDimensionsData;

      // 验证数据结构
      if (!validateDiagnosisData(data)) {
        return {
          success: false,
          error: 'Invalid diagnosis data structure',
          processing_time: Date.now() - startTime
        };
      }

      // 计算聚合分数
      calculateAggregatedScores(data);

      return {
        success: true,
        data,
        processing_time: Date.now() - startTime
      };
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return {
        success: false,
        error: `Failed to parse AI response as JSON: ${parseError}`,
        processing_time: Date.now() - startTime
      };
    }
  } catch (error) {
    console.error('ZhipuAI API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time: Date.now() - startTime
    };
  }
}

/**
 * 验证诊断数据结构
 */
function validateDiagnosisData(data: any): data is FiveDimensionsData {
  const requiredDimensions = ['strategy', 'structure', 'performance', 'compensation', 'talent'];

  for (const dim of requiredDimensions) {
    if (!data[dim] || typeof data[dim].score !== 'number') {
      return false;
    }
    if (!data[dim].L2_categories || typeof data[dim].L2_categories !== 'object') {
      return false;
    }
  }

  return true;
}

/**
 * 计算聚合分数 (L3 -> L2 -> L1)
 */
function calculateAggregatedScores(data: FiveDimensionsData): void {
  let totalScore = 0;
  const dimensions = ['strategy', 'structure', 'performance', 'compensation', 'talent'] as const;

  for (const dimKey of dimensions) {
    const dimension = data[dimKey];
    let dimTotalScore = 0;
    let l2Count = 0;

    for (const l2Key of Object.keys(dimension.L2_categories)) {
      const l2Category = dimension.L2_categories[l2Key];
      let l2TotalScore = 0;
      let l3Count = 0;

      // 计算 L2 分数 (L3 平均)
      for (const l3Key of Object.keys(l2Category.L3_items)) {
        const l3Item = l2Category.L3_items[l3Key];
        if (l3Item.score !== null && l3Item.score !== undefined) {
          l2TotalScore += l3Item.score;
          l3Count++;
        }
      }

      if (l3Count > 0) {
        l2Category.score = Math.round(l2TotalScore / l3Count);
        dimTotalScore += l2Category.score;
        l2Count++;
      }
    }

    // 计算 L1 分数 (L2 平均)
    if (l2Count > 0) {
      dimension.score = Math.round(dimTotalScore / l2Count);
      totalScore += dimension.score;
    }
  }

  // 计算整体分数 (L1 平均)
  data.overall_score = Math.round(totalScore / dimensions.length);
}

/**
 * 使用流式响应进行抽取 (用于长文本)
 */
export async function* extractDiagnosisDataStream(
  rawText: string
): AsyncGenerator<string, ExtractionResult, unknown> {
  const startTime = Date.now();

  if (!ZHIPU_API_KEY) {
    return {
      success: false,
      error: 'ZHIPUAI_API_KEY environment variable is not set',
      processing_time: Date.now() - startTime
    };
  }

  try {
    const response = await fetch(ZHIPU_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'glm-4',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: generateUserPrompt(rawText) }
        ],
        temperature: 0.3,
        max_tokens: 4096,
        stream: true
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `${response.status} ${errorText}`,
        processing_time: Date.now() - startTime
      };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return {
        success: false,
        error: 'No response body',
        processing_time: Date.now() - startTime
      };
    }

    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              yield content;
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

    // 解析完整响应
    const jsonMatch = fullContent.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : fullContent;

    try {
      const data = JSON.parse(jsonStr) as FiveDimensionsData;

      if (validateDiagnosisData(data)) {
        calculateAggregatedScores(data);
        return {
          success: true,
          data,
          processing_time: Date.now() - startTime
        };
      }

      return {
        success: false,
        error: 'Invalid diagnosis data structure',
        processing_time: Date.now() - startTime
      };
    } catch {
      return {
        success: false,
        error: 'Failed to parse JSON response',
        processing_time: Date.now() - startTime
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time: Date.now() - startTime
    };
  }
}
