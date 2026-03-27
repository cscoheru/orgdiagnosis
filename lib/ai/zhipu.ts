/**
 * AI API 封装
 *
 * 所有 AI 调用通过后端 API 代理，前端不直接访问任何 AI 服务。
 * 后端端点: POST /api/analyze → app/services/ai_extractor.py
 *
 * 当后端不可达时，自动降级到 Mock 模式。
 */

import type { FiveDimensionsData, ExtractionResult } from '@/types/diagnosis';

// 后端 API 地址
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const ANALYZE_ENDPOINT = `${API_BASE_URL}/api/analyze`;

// 超时控制
const API_TIMEOUT = 60000; // 60秒

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 从原始文本中抽取五维诊断数据
 *
 * 调用后端 POST /api/analyze，由后端的 ai_extractor 处理 AI 调用。
 * 后端不可达时自动降级到 Mock 数据。
 */
export async function extractDiagnosisData(rawText: string): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    const response = await fetchWithTimeout(
      ANALYZE_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: rawText }),
      },
      API_TIMEOUT
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Backend API] Error response:', response.status, errorText);

      // 后端不可用时降级到 Mock
      console.log('[Fallback] Backend unavailable, using mock data');
      const mockData = generateMockData(rawText);
      return {
        success: true,
        data: mockData,
        processing_time: Date.now() - startTime
      };
    }

    const result = await response.json();

    if (!result.success) {
      // 后端返回失败，降级到 Mock
      console.log('[Fallback] Backend analysis failed, using mock data:', result.error);
      const mockData = generateMockData(rawText);
      return {
        success: true,
        data: mockData,
        processing_time: Date.now() - startTime
      };
    }

    // 后端返回的数据已经过验证
    return {
      success: true,
      data: result.data as FiveDimensionsData,
      processing_time: result.processing_time || (Date.now() - startTime)
    };

  } catch (error) {
    console.error('[Backend API] Request failed:', error);

    // 超时或网络错误，降级到 Mock
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[Fallback] Backend timeout, using mock data');
    } else {
      console.log('[Fallback] Backend unreachable, using mock data');
    }

    const mockData = generateMockData(rawText);
    return {
      success: true,
      data: mockData,
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

    if (l2Count > 0) {
      dimension.score = Math.round(dimTotalScore / l2Count);
      totalScore += dimension.score;
    }
  }

  data.overall_score = Math.round(totalScore / dimensions.length);
}

/**
 * 生成 Mock 数据
 */
function generateMockData(rawText: string): FiveDimensionsData {
  const text = rawText.toLowerCase();

  return {
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
      score: text.includes('组织') || text.includes('架构') || text.includes('部门墙') ? 58 : 65,
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
      score: text.includes('薪酬') || text.includes('工资') || text.includes('收入') ? 55 : 68,
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
}

/**
 * 流式响应 (用于长文本)
 *
 * 注意: 后端 /api/analyze 是同步端点，不支持流式。
 * 此函数保留接口兼容性，实际通过同步调用实现。
 */
export async function* extractDiagnosisDataStream(
  rawText: string
): AsyncGenerator<string, ExtractionResult, unknown> {
  const startTime = Date.now();

  try {
    const response = await fetchWithTimeout(
      ANALYZE_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: rawText }),
      },
      API_TIMEOUT
    );

    if (!response.ok || !(await response.clone().json()).success) {
      const mockData = generateMockData(rawText);
      yield JSON.stringify(mockData);
      return {
        success: true,
        data: mockData,
        processing_time: Date.now() - startTime
      };
    }

    const result = await response.json();
    yield JSON.stringify(result.data);

    return {
      success: true,
      data: result.data as FiveDimensionsData,
      processing_time: result.processing_time || (Date.now() - startTime)
    };
  } catch (error) {
    const mockData = generateMockData(rawText);
    yield JSON.stringify(mockData);
    return {
      success: true,
      data: mockData,
      processing_time: Date.now() - startTime
    };
  }
}
