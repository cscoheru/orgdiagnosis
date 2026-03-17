'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { DimensionRadarChart } from '@/components/charts/radar-chart';
import { WarningCards } from '@/components/charts/warning-cards';
import { DimensionDetailChart } from '@/components/charts/dimension-detail-chart';
import type { FiveDimensionsData, DimensionKey } from '@/types/diagnosis';
import { DIMENSION_KEYS } from '@/types/diagnosis';
import { getScoreColor } from '@/types/diagnosis';

// 模拟数据 - 后续从 API 获取
const mockData: FiveDimensionsData = {
  strategy: {
    label: '战略',
    description: '做正确的事',
    score: 72,
    L2_categories: {
      business_status: {
        label: '业务现状',
        score: 65,
        L3_items: {
          performance_gap: {
            score: 70,
            evidence: '去年营收增长8%，低于目标15%',
            confidence: 'high',
          },
          opportunity_gap: {
            score: 60,
            evidence: '错过了两个重要的市场机会',
            confidence: 'medium',
          },
        },
      },
      strategic_planning: {
        label: '战略规划',
        score: 75,
        L3_items: {
          market_insight: {
            score: 80,
            evidence: '市场分析做得比较系统',
            confidence: 'high',
          },
          strategic_intent: {
            score: 70,
            evidence: '有清晰的3年战略目标',
            confidence: 'high',
          },
          innovation_focus: {
            score: 72,
            evidence: '在两个新赛道有布局',
            confidence: 'medium',
          },
          business_design: {
            score: 78,
            evidence: '商业模式清晰，盈利路径明确',
            confidence: 'high',
          },
        },
      },
      strategy_execution: {
        label: '战略执行',
        score: 68,
        L3_items: {
          critical_tasks: {
            score: 65,
            evidence: '关键任务推进缓慢',
            confidence: 'medium',
          },
          organizational_support: {
            score: 70,
            evidence: '组织阵型基本匹配业务需求',
            confidence: 'high',
          },
          talent_readiness: {
            score: 60,
            evidence: '核心岗位人才不足',
            confidence: 'high',
          },
          corporate_culture: {
            score: 77,
            evidence: '团队凝聚力强，执行力好',
            confidence: 'high',
          },
        },
      },
      strategy_evaluation: {
        label: '战略评估',
        score: 80,
        L3_items: {
          business_analysis: {
            score: 85,
            evidence: '有完善的经营分析体系',
            confidence: 'high',
          },
          execution_evaluation: {
            score: 75,
            evidence: '定期复盘机制',
            confidence: 'high',
          },
          strategy_iteration: {
            score: 80,
            evidence: '能够根据市场变化调整战略',
            confidence: 'medium',
          },
        },
      },
    },
  },
  structure: {
    label: '组织',
    description: '提升系统运转效率',
    score: 65,
    L2_categories: {
      organizational_structure: {
        label: '组织架构',
        score: 60,
        L3_items: {
          structure_type: {
            score: 65,
            evidence: '职能制结构，部门墙明显',
            confidence: 'high',
          },
          layers_and_span: {
            score: 55,
            evidence: '管理层级过多，有5层',
            confidence: 'high',
          },
          departmental_boundaries: {
            score: 60,
            evidence: '部门职责边界不够清晰',
            confidence: 'medium',
          },
        },
      },
      authority_and_responsibility: {
        label: '权责分配',
        score: 70,
        L3_items: {
          decision_mechanism: {
            score: 75,
            evidence: '决策流程相对高效',
            confidence: 'medium',
          },
          delegation_system: {
            score: 65,
            evidence: '授权不够充分',
            confidence: 'high',
          },
          role_definitions: {
            score: 70,
            evidence: '岗位说明书基本完善',
            confidence: 'high',
          },
        },
      },
      collaboration_and_processes: {
        label: '协同流程',
        score: 60,
        L3_items: {
          core_processes: {
            score: 65,
            evidence: '核心流程基本清晰',
            confidence: 'high',
          },
          cross_functional_collaboration: {
            score: 50,
            evidence: '跨部门协作困难',
            confidence: 'high',
          },
          process_digitalization: {
            score: 65,
            evidence: 'IT系统老旧',
            confidence: 'medium',
          },
        },
      },
      organizational_effectiveness: {
        label: '组织效能',
        score: 70,
        L3_items: {
          per_capita_efficiency: {
            score: 72,
            evidence: '人均产值处于行业平均水平',
            confidence: 'high',
          },
          agility: {
            score: 68,
            evidence: '对市场变化响应一般',
            confidence: 'medium',
          },
        },
      },
    },
  },
  performance: {
    label: '绩效',
    description: '明确指挥棒',
    score: 55,
    L2_categories: {
      system_design: {
        label: '体系设计',
        score: 50,
        L3_items: {
          goal_setting_tools: {
            score: 55,
            evidence: 'KPI设置不够科学',
            confidence: 'high',
          },
          metric_cascading: {
            score: 50,
            evidence: '指标分解存在问题',
            confidence: 'high',
          },
          weights_and_standards: {
            score: 45,
            evidence: '权重分配不合理',
            confidence: 'high',
          },
        },
      },
      process_management: {
        label: '过程管理',
        score: 55,
        L3_items: {
          goal_tracking: {
            score: 60,
            evidence: '有月度复盘',
            confidence: 'medium',
          },
          performance_coaching: {
            score: 50,
            evidence: '辅导反馈不足',
            confidence: 'high',
          },
          data_collection: {
            score: 55,
            evidence: '数据收集困难',
            confidence: 'high',
          },
        },
      },
      appraisal_and_feedback: {
        label: '考核反馈',
        score: 60,
        L3_items: {
          appraisal_fairness: {
            score: 55,
            evidence: '员工反映考核不公平',
            confidence: 'high',
          },
          feedback_quality: {
            score: 65,
            evidence: '面谈质量参差不齐',
            confidence: 'medium',
          },
          grievance_mechanism: {
            score: 60,
            evidence: '有申诉渠道',
            confidence: 'high',
          },
        },
      },
      result_application: {
        label: '结果应用',
        score: 55,
        L3_items: {
          link_to_rewards: {
            score: 60,
            evidence: '绩效与奖金挂钩不强',
            confidence: 'high',
          },
          promotion_and_elimination: {
            score: 50,
            evidence: '晋升淘汰机制不清晰',
            confidence: 'high',
          },
          link_to_learning_and_development: {
            score: 55,
            evidence: '培训与绩效脱节',
            confidence: 'high',
          },
        },
      },
    },
  },
  compensation: {
    label: '薪酬',
    description: '提供核心动力',
    score: 70,
    L2_categories: {
      compensation_strategy: {
        label: '薪酬策略',
        score: 72,
        L3_items: {
          market_positioning: {
            score: 70,
            evidence: '薪酬处于市场中位',
            confidence: 'high',
          },
          fixed_vs_variable_mix: {
            score: 75,
            evidence: '固浮比7:3',
            confidence: 'high',
          },
          internal_equity: {
            score: 70,
            evidence: '有职级体系',
            confidence: 'medium',
          },
        },
      },
      compensation_structure: {
        label: '薪酬结构',
        score: 68,
        L3_items: {
          base_pay: {
            score: 70,
            evidence: '有宽带薪酬设计',
            confidence: 'high',
          },
          short_term_incentives: {
            score: 65,
            evidence: '年终奖占1-2个月',
            confidence: 'high',
          },
          long_term_incentives: {
            score: 55,
            evidence: '股权激励不足',
            confidence: 'high',
          },
          benefits_and_allowances: {
            score: 75,
            evidence: '福利项目较丰富',
            confidence: 'high',
          },
        },
      },
      management_and_budgeting: {
        label: '管理预算',
        score: 70,
        L3_items: {
          payroll_management: {
            score: 72,
            evidence: '人力成本控制在25%左右',
            confidence: 'high',
          },
          salary_adjustment: {
            score: 65,
            evidence: '每年调薪5-10%',
            confidence: 'medium',
          },
          pay_transparency: {
            score: 60,
            evidence: '薪酬透明度一般',
            confidence: 'medium',
          },
        },
      },
    },
  },
  talent: {
    label: '人才',
    description: '打造核心资产',
    score: 58,
    L2_categories: {
      planning_and_review: {
        label: '规划盘点',
        score: 60,
        L3_items: {
          competency_models: {
            score: 65,
            evidence: '有胜任力模型但更新不及时',
            confidence: 'high',
          },
          talent_review: {
            score: 55,
            evidence: '人才盘点不系统',
            confidence: 'high',
          },
          pipeline_health: {
            score: 60,
            evidence: '关键岗位有继任者',
            confidence: 'medium',
          },
        },
      },
      acquisition_and_allocation: {
        label: '获取配置',
        score: 55,
        L3_items: {
          employer_branding: {
            score: 60,
            evidence: '在行业有一定知名度',
            confidence: 'high',
          },
          recruitment_precision: {
            score: 50,
            evidence: '招聘人岗匹配度不高',
            confidence: 'high',
          },
          internal_mobility: {
            score: 45,
            evidence: '内部流动渠道不畅',
            confidence: 'high',
          },
        },
      },
      training_and_development: {
        label: '培养发展',
        score: 60,
        L3_items: {
          onboarding: {
            score: 70,
            evidence: '有新员工培训',
            confidence: 'high',
          },
          leadership_development: {
            score: 55,
            evidence: '管理培训不足',
            confidence: 'high',
          },
          career_pathways: {
            score: 55,
            evidence: '职业通道不够清晰',
            confidence: 'high',
          },
        },
      },
      retention_and_engagement: {
        label: '保留激励',
        score: 55,
        L3_items: {
          key_talent_turnover: {
            score: 45,
            evidence: '核心员工流失率较高',
            confidence: 'high',
          },
          employee_engagement: {
            score: 60,
            evidence: '员工敬业度一般',
            confidence: 'medium',
          },
          non_financial_incentives: {
            score: 55,
            evidence: '非物质激励不足',
            confidence: 'high',
          },
        },
      },
    },
  },
  overall_score: 64,
};

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<FiveDimensionsData>(mockData);
  const [isLoading, setIsLoading] = useState(false);

  // TODO: 从 API 获取数据
  // useEffect(() => {
  //   fetch(`/api/diagnosis/${params.id}`)
  //     .then(res => res.json())
  //     .then(result => {
  //       if (result.success) {
  //         setData(result.data);
  //       }
  //       setIsLoading(false);
  //     });
  // }, [params.id]);

  const handleExportPDF = async () => {
    setIsLoading(true);
    // TODO: 实现 PDF 导出
    alert('PDF 导出功能开发中...');
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">诊断结果</h1>
          <p className="text-gray-500 mt-1">
            诊断时间: {new Date().toLocaleString('zh-CN')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/input')}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ← 新建诊断
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isLoading}
            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/25"
          >
            📄 导出 PDF
          </button>
        </div>
      </div>

      {/* Overall Score */}
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm font-medium">整体健康度</p>
            <p className="text-5xl font-bold mt-1">{data.overall_score}</p>
            <p className="text-blue-100 text-sm mt-1">满分 100</p>
          </div>
          <div className="text-8xl opacity-20">◈</div>
        </div>
      </div>

      {/* L1 Radar Chart */}
      <DimensionRadarChart data={data} />

      {/* Warning Cards */}
      <WarningCards data={data} threshold={60} />

      {/* L2 & L3 Dimension Details */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900">各维度详情</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {DIMENSION_KEYS.map((key) => (
            <DimensionDetailChart
              key={key}
              dimensionKey={key}
              data={data[key]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
