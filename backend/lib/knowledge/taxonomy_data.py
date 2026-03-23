"""
五维分类数据管理

基于 docs/five-dimensions-schema.json 的五维模型:
- L1: 5个维度 (战略、组织、绩效、薪酬、人才)
- L2: 19个分类
- L3: 58个指标

Created: 2026-03-22
"""

import json
from typing import List, Dict, Any, Optional
from pathlib import Path
from loguru import logger


class TaxonomyManager:
    """
    五维分类管理器

    管理三级分类体系:
    - L1: 维度 (strategy, structure, performance, compensation, talent)
    - L2: 分类 (如 business_status, strategic_planning)
    - L3: 指标 (如 performance_gap, opportunity_gap)
    """

    # 五维分类完整数据 (基于 five-dimensions-schema.json)
    TAXONOMY_DATA = {
        "strategy": {
            "label": "战略",
            "description": "做正确的事",
            "L2_categories": {
                "business_status": {
                    "label": "业务现状",
                    "keywords": ["业绩", "差距", "机会", "现状", "目标"],
                    "L3_items": {
                        "performance_gap": {
                            "label": "业绩差距",
                            "description": "实际财务指标与预期目标的差距",
                            "keywords": ["业绩差距", "财务指标", "预期目标", "业绩分析"]
                        },
                        "opportunity_gap": {
                            "label": "机会差距",
                            "description": "错失的新市场、新产品或新客户机会",
                            "keywords": ["机会差距", "新市场", "新产品", "错失机会"]
                        }
                    }
                },
                "strategic_planning": {
                    "label": "战略规划",
                    "keywords": ["战略规划", "愿景", "使命", "目标", "商业模式"],
                    "L3_items": {
                        "market_insight": {
                            "label": "市场洞察",
                            "description": "宏观环境、竞争对手与客户需求分析",
                            "keywords": ["市场洞察", "宏观环境", "竞争对手", "客户需求", "PEST", "五力模型"]
                        },
                        "strategic_intent": {
                            "label": "战略意图",
                            "description": "企业愿景、使命与中长期战略目标",
                            "keywords": ["战略意图", "愿景", "使命", "战略目标", "中长期"]
                        },
                        "innovation_focus": {
                            "label": "创新焦点",
                            "description": "未来的业务增长引擎与核心技术布局",
                            "keywords": ["创新焦点", "增长引擎", "核心技术", "创新战略", "第二曲线"]
                        },
                        "business_design": {
                            "label": "业务设计",
                            "description": "商业模式、价值主张与盈利逻辑",
                            "keywords": ["业务设计", "商业模式", "价值主张", "盈利模式", "BMC"]
                        }
                    }
                },
                "strategy_execution": {
                    "label": "战略执行",
                    "keywords": ["战略执行", "关键任务", "必赢之战", "组织支撑"],
                    "L3_items": {
                        "critical_tasks": {
                            "label": "关键任务",
                            "description": "支撑业务设计的必赢之战 (Must-win battles)",
                            "keywords": ["关键任务", "必赢之战", "MWB", "战略落地"]
                        },
                        "organizational_support": {
                            "label": "组织支撑",
                            "description": "组织阵型是否匹配关键任务",
                            "keywords": ["组织支撑", "组织阵型", "组织匹配"]
                        },
                        "talent_readiness": {
                            "label": "人才准备",
                            "description": "核心岗位的人才数量与能力是否达标",
                            "keywords": ["人才准备", "人才盘点", "能力达标"]
                        },
                        "corporate_culture": {
                            "label": "企业文化",
                            "description": "团队氛围与价值观是否支持战略落地",
                            "keywords": ["企业文化", "价值观", "团队氛围", "文化建设"]
                        }
                    }
                },
                "strategy_evaluation": {
                    "label": "战略评估",
                    "keywords": ["战略评估", "经营分析", "复盘", "迭代"],
                    "L3_items": {
                        "business_analysis": {
                            "label": "经营分析",
                            "description": "战略解码后的财务与运营指标监控",
                            "keywords": ["经营分析", "财务指标", "运营指标", "战略解码"]
                        },
                        "execution_evaluation": {
                            "label": "执行评价",
                            "description": "关键任务的里程碑与进度复盘",
                            "keywords": ["执行评价", "里程碑", "复盘", "进度跟踪"]
                        },
                        "strategy_iteration": {
                            "label": "战略迭代",
                            "description": "面对市场变化的战略纠偏与调整机制",
                            "keywords": ["战略迭代", "纠偏", "调整机制", "敏捷战略"]
                        }
                    }
                }
            }
        },
        "structure": {
            "label": "组织",
            "description": "提升系统运转效率",
            "L2_categories": {
                "organizational_structure": {
                    "label": "组织架构",
                    "keywords": ["组织架构", "架构形态", "管理层级", "部门"],
                    "L3_items": {
                        "structure_type": {
                            "label": "架构形态",
                            "description": "职能制、事业部制、矩阵制或敏捷团队的适配度",
                            "keywords": ["架构形态", "职能制", "事业部", "矩阵制", "敏捷组织"]
                        },
                        "layers_and_span": {
                            "label": "管理层级与跨度",
                            "description": "管理扁平化程度与管理幅度是否合理",
                            "keywords": ["管理层级", "管理跨度", "扁平化", "管理幅度"]
                        },
                        "departmental_boundaries": {
                            "label": "部门职责边界",
                            "description": "是否存在职能重叠或灰色地带",
                            "keywords": ["部门边界", "职责边界", "职能重叠", "灰色地带"]
                        }
                    }
                },
                "authority_and_responsibility": {
                    "label": "权责分配",
                    "keywords": ["权责分配", "决策机制", "授权", "岗位"],
                    "L3_items": {
                        "decision_mechanism": {
                            "label": "决策机制",
                            "description": "集权与分权的平衡，决策链路长短",
                            "keywords": ["决策机制", "集权", "分权", "决策链路"]
                        },
                        "delegation_system": {
                            "label": "授权体系",
                            "description": "人权、财权、事权的下放程度",
                            "keywords": ["授权体系", "人权", "财权", "事权", "下放"]
                        },
                        "role_definitions": {
                            "label": "岗位指引",
                            "description": "关键岗位的责权利定义是否清晰",
                            "keywords": ["岗位指引", "岗位职责", "责权利", "岗位说明书"]
                        }
                    }
                },
                "collaboration_and_processes": {
                    "label": "协同流程",
                    "keywords": ["协同流程", "业务流程", "跨部门", "数字化"],
                    "L3_items": {
                        "core_processes": {
                            "label": "核心业务流程",
                            "description": "端到端价值链的运转效率",
                            "keywords": ["核心流程", "业务流程", "端到端", "价值链", "E2E"]
                        },
                        "cross_functional_collaboration": {
                            "label": "跨部门协同",
                            "description": "部门墙厚度与沟通摩擦力",
                            "keywords": ["跨部门协同", "部门墙", "沟通", "协作"]
                        },
                        "process_digitalization": {
                            "label": "流程数字化",
                            "description": "IT系统与工具对流程的支撑度",
                            "keywords": ["流程数字化", "IT系统", "数字化", "流程工具"]
                        }
                    }
                },
                "organizational_effectiveness": {
                    "label": "组织效能",
                    "keywords": ["组织效能", "人效", "响应速度", "效率"],
                    "L3_items": {
                        "per_capita_efficiency": {
                            "label": "人效指标",
                            "description": "人均产值、人均利润等核心效能",
                            "keywords": ["人效", "人均产值", "人均利润", "效能指标"]
                        },
                        "agility": {
                            "label": "响应速度",
                            "description": "组织对市场需求和危机的响应与处理速度",
                            "keywords": ["响应速度", "敏捷", "市场响应", "危机处理"]
                        }
                    }
                }
            }
        },
        "performance": {
            "label": "绩效",
            "description": "明确指挥棒",
            "L2_categories": {
                "system_design": {
                    "label": "绩效体系设计",
                    "keywords": ["绩效体系", "KPI", "OKR", "BSC", "目标设定"],
                    "L3_items": {
                        "goal_setting_tools": {
                            "label": "目标设定工具",
                            "description": "KPI、OKR或BSC的选择与适配性",
                            "keywords": ["目标设定", "KPI", "OKR", "BSC", "平衡计分卡"]
                        },
                        "metric_cascading": {
                            "label": "指标分解机制",
                            "description": "公司目标向部门、个人的纵向承接",
                            "keywords": ["指标分解", "目标承接", "纵向分解", "战略解码"]
                        },
                        "weights_and_standards": {
                            "label": "权重与标准",
                            "description": "考核指标的权重分配与挑战性(SMART原则)",
                            "keywords": ["权重分配", "考核标准", "SMART", "挑战性"]
                        }
                    }
                },
                "process_management": {
                    "label": "过程管理",
                    "keywords": ["过程管理", "目标跟进", "辅导", "数据收集"],
                    "L3_items": {
                        "goal_tracking": {
                            "label": "目标跟进",
                            "description": "定期review机制（周报、月会）",
                            "keywords": ["目标跟进", "定期review", "周报", "月会"]
                        },
                        "performance_coaching": {
                            "label": "绩效辅导",
                            "description": "主管对下属的过程纠偏与资源赋能",
                            "keywords": ["绩效辅导", "过程纠偏", "资源赋能", "1on1"]
                        },
                        "data_collection": {
                            "label": "数据收集",
                            "description": "绩效考核数据的准确性与获取成本",
                            "keywords": ["数据收集", "绩效数据", "数据准确性"]
                        }
                    }
                },
                "appraisal_and_feedback": {
                    "label": "考核与反馈",
                    "keywords": ["考核", "反馈", "面谈", "申诉"],
                    "L3_items": {
                        "appraisal_fairness": {
                            "label": "考核公平性",
                            "description": "绩效打分的客观性与强制分布机制",
                            "keywords": ["考核公平", "客观性", "强制分布", "正态分布"]
                        },
                        "feedback_quality": {
                            "label": "面谈质量",
                            "description": "建设性反馈与改进计划的达成",
                            "keywords": ["面谈质量", "建设性反馈", "改进计划", "绩效面谈"]
                        },
                        "grievance_mechanism": {
                            "label": "申诉机制",
                            "description": "员工对绩效结果的异议处理通道",
                            "keywords": ["申诉机制", "异议处理", "绩效申诉"]
                        }
                    }
                },
                "result_application": {
                    "label": "结果应用",
                    "keywords": ["结果应用", "激励挂钩", "晋升", "淘汰"],
                    "L3_items": {
                        "link_to_rewards": {
                            "label": "物质激励挂钩",
                            "description": "与奖金、调薪的强关联度",
                            "keywords": ["激励挂钩", "奖金", "调薪", "绩效奖金"]
                        },
                        "promotion_and_elimination": {
                            "label": "晋升与淘汰",
                            "description": "人才密度的维持（如末位淘汰/胜任力晋升）",
                            "keywords": ["晋升", "淘汰", "末位淘汰", "人才密度"]
                        },
                        "link_to_learning_and_development": {
                            "label": "培训与发展",
                            "description": "针对绩效短板的针对性能力提升",
                            "keywords": ["培训发展", "能力提升", "绩效短板", "IDP"]
                        }
                    }
                }
            }
        },
        "compensation": {
            "label": "薪酬",
            "description": "提供核心动力",
            "L2_categories": {
                "compensation_strategy": {
                    "label": "薪酬策略",
                    "keywords": ["薪酬策略", "市场定位", "固浮比", "内部公平"],
                    "L3_items": {
                        "market_positioning": {
                            "label": "市场定位",
                            "description": "领先、跟随还是滞后策略（如P75分位水平）",
                            "keywords": ["市场定位", "薪酬定位", "P75", "分位值", "领先策略"]
                        },
                        "fixed_vs_variable_mix": {
                            "label": "固浮比设计",
                            "description": "固定工资与浮动奖金的杠杆比例",
                            "keywords": ["固浮比", "固定工资", "浮动奖金", "薪酬结构"]
                        },
                        "internal_equity": {
                            "label": "内部公平性",
                            "description": "岗位价值评估体系与职级体系的科学性",
                            "keywords": ["内部公平", "岗位价值", "职级体系", "IPE"]
                        }
                    }
                },
                "compensation_structure": {
                    "label": "薪酬结构",
                    "keywords": ["薪酬结构", "基本工资", "激励", "福利"],
                    "L3_items": {
                        "base_pay": {
                            "label": "基本工资体系",
                            "description": "宽带薪酬设计与薪级薪档",
                            "keywords": ["基本工资", "宽带薪酬", "薪级", "薪档"]
                        },
                        "short_term_incentives": {
                            "label": "短期激励",
                            "description": "提成、项目奖、年终奖机制",
                            "keywords": ["短期激励", "提成", "项目奖", "年终奖"]
                        },
                        "long_term_incentives": {
                            "label": "中长期激励",
                            "description": "股权、期权、利润分享或合伙人机制",
                            "keywords": ["中长期激励", "股权", "期权", "ESOP", "合伙人"]
                        },
                        "benefits_and_allowances": {
                            "label": "弹性福利",
                            "description": "法定福利之外的关怀与津贴",
                            "keywords": ["弹性福利", "福利", "津贴", "补充福利"]
                        }
                    }
                },
                "management_and_budgeting": {
                    "label": "管理与预算",
                    "keywords": ["薪酬管理", "总额管控", "调薪", "薪酬沟通"],
                    "L3_items": {
                        "payroll_management": {
                            "label": "总额管控",
                            "description": "薪酬包（人力成本）占营收/利润的比例健康度",
                            "keywords": ["总额管控", "人力成本", "薪酬包", "人效"]
                        },
                        "salary_adjustment": {
                            "label": "调薪机制",
                            "description": "基于绩效、通胀或晋升的动态调薪矩阵",
                            "keywords": ["调薪机制", "调薪矩阵", "年度调薪", "晋升调薪"]
                        },
                        "pay_transparency": {
                            "label": "薪酬沟通",
                            "description": "薪酬制度的宣贯与保密/透明机制的管理",
                            "keywords": ["薪酬沟通", "薪酬透明", "制度宣贯", "保密"]
                        }
                    }
                }
            }
        },
        "talent": {
            "label": "人才",
            "description": "打造核心资产",
            "L2_categories": {
                "planning_and_review": {
                    "label": "规划与盘点",
                    "keywords": ["人才规划", "盘点", "胜任力", "梯队"],
                    "L3_items": {
                        "competency_models": {
                            "label": "胜任力模型",
                            "description": "核心价值观、领导力与专业能力画像",
                            "keywords": ["胜任力模型", "能力画像", "领导力", "核心能力"]
                        },
                        "talent_review": {
                            "label": "人才盘点机制",
                            "description": "九宫格落位，识别高潜人才(HiPo)与负资产",
                            "keywords": ["人才盘点", "九宫格", "高潜人才", "HiPo"]
                        },
                        "pipeline_health": {
                            "label": "梯队健康度",
                            "description": "关键岗位的继任者计划 (Succession Planning)",
                            "keywords": ["梯队健康", "继任者计划", "人才梯队", "后备人才"]
                        }
                    }
                },
                "acquisition_and_allocation": {
                    "label": "获取与配置",
                    "keywords": ["人才获取", "招聘", "雇主品牌", "内部流动"],
                    "L3_items": {
                        "employer_branding": {
                            "label": "雇主品牌",
                            "description": "对外吸引优秀人才的企业声誉",
                            "keywords": ["雇主品牌", "企业声誉", "人才吸引", "EVP"]
                        },
                        "recruitment_precision": {
                            "label": "招聘精准度",
                            "description": "人岗匹配度与招聘渠道ROI",
                            "keywords": ["招聘精准", "人岗匹配", "招聘ROI", "渠道效果"]
                        },
                        "internal_mobility": {
                            "label": "内部流动",
                            "description": "活水机制与跨部门人才调动效率",
                            "keywords": ["内部流动", "活水机制", "人才调动", "转岗"]
                        }
                    }
                },
                "training_and_development": {
                    "label": "培养与发展",
                    "keywords": ["人才培养", "培训", "发展", "职业通道"],
                    "L3_items": {
                        "onboarding": {
                            "label": "融入体系",
                            "description": "新员工/空降高管的着陆与文化融入",
                            "keywords": ["融入体系", "新员工", "着陆", "文化融入", "onboarding"]
                        },
                        "leadership_development": {
                            "label": "骨干培养",
                            "description": "管理干部与核心专家的训战结合体系",
                            "keywords": ["骨干培养", "干部培养", "训战结合", "领导力发展"]
                        },
                        "career_pathways": {
                            "label": "职业通道",
                            "description": "管理(M)与专业(P)双通道设计及晋升标准",
                            "keywords": ["职业通道", "双通道", "M通道", "P通道", "晋升标准"]
                        }
                    }
                },
                "retention_and_engagement": {
                    "label": "保留与激励",
                    "keywords": ["人才保留", "敬业度", "流失率", "激励"],
                    "L3_items": {
                        "key_talent_turnover": {
                            "label": "核心流失率",
                            "description": "关键人才的离职率及真实离职原因管理",
                            "keywords": ["核心流失率", "离职率", "离职原因", "人才流失"]
                        },
                        "employee_engagement": {
                            "label": "员工敬业度",
                            "description": "团队士气、认同感与工作内驱力",
                            "keywords": ["敬业度", "员工满意度", "团队士气", "Q12"]
                        },
                        "non_financial_incentives": {
                            "label": "非物质激励",
                            "description": "荣誉、授权、成长空间等精神激励",
                            "keywords": ["非物质激励", "精神激励", "荣誉体系", "认可"]
                        }
                    }
                }
            }
        }
    }

    def __init__(self, store):
        """
        初始化分类管理器

        Args:
            store: KnowledgeBaseStore 实例
        """
        self.store = store
        self._initialized = False

    def initialize_taxonomy(self, force: bool = False) -> int:
        """
        初始化五维分类数据到数据库

        Args:
            force: 是否强制重新初始化（删除现有数据）

        Returns:
            初始化的分类项数量
        """
        if self._initialized and not force:
            return 0

        count = 0
        sort_order = 0

        for l1_code, l1_data in self.TAXONOMY_DATA.items():
            # 插入 L1 维度
            self._insert_taxonomy(
                id=l1_code,
                level=1,
                parent_id=None,
                code=l1_code,
                name=l1_data["label"],
                description=l1_data["description"],
                keywords=l1_data.get("keywords", []),
                sort_order=sort_order
            )
            count += 1
            sort_order += 1

            # 插入 L2 分类
            for l2_code, l2_data in l1_data["L2_categories"].items():
                l2_id = f"{l1_code}_{l2_code}"
                self._insert_taxonomy(
                    id=l2_id,
                    level=2,
                    parent_id=l1_code,
                    code=l2_code,
                    name=l2_data["label"],
                    description=l2_data.get("description", ""),
                    keywords=l2_data.get("keywords", []),
                    sort_order=sort_order
                )
                count += 1
                sort_order += 1

                # 插入 L3 指标
                for l3_code, l3_data in l2_data["L3_items"].items():
                    l3_id = f"{l1_code}_{l2_code}_{l3_code}"
                    self._insert_taxonomy(
                        id=l3_id,
                        level=3,
                        parent_id=l2_id,
                        code=l3_code,
                        name=l3_data["label"],
                        description=l3_data["description"],
                        keywords=l3_data.get("keywords", []),
                        sort_order=sort_order
                    )
                    count += 1
                    sort_order += 1

        self._initialized = True
        logger.info(f"Taxonomy initialized: {count} items (5 L1, 19 L2, 58 L3)")
        return count

    def _insert_taxonomy(
        self,
        id: str,
        level: int,
        parent_id: Optional[str],
        code: str,
        name: str,
        description: str,
        keywords: List[str],
        sort_order: int
    ):
        """插入分类项到数据库"""
        conn = self.store._get_conn()
        conn.execute("""
            INSERT OR REPLACE INTO taxonomy_dimensions
            (id, level, parent_id, code, name, description, keywords, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            id,
            level,
            parent_id,
            code,
            name,
            description,
            json.dumps(keywords) if keywords else None,
            sort_order
        ))
        conn.commit()
        conn.close()

    def get_taxonomy_tree(self) -> List[Dict[str, Any]]:
        """
        获取完整的分类树结构

        Returns:
            嵌套的分类树
        """
        conn = self.store._get_conn()
        cursor = conn.execute("""
            SELECT * FROM taxonomy_dimensions ORDER BY level, sort_order
        """)
        rows = cursor.fetchall()
        conn.close()

        # 构建树结构
        tree = []
        l1_map = {}
        l2_map = {}

        for row in rows:
            item = dict(row)
            if item["keywords"]:
                item["keywords"] = json.loads(item["keywords"])

            if item["level"] == 1:
                item["children"] = []
                l1_map[item["id"]] = item
                tree.append(item)
            elif item["level"] == 2:
                item["children"] = []
                l2_map[item["id"]] = item
                if item["parent_id"] in l1_map:
                    l1_map[item["parent_id"]]["children"].append(item)
            elif item["level"] == 3:
                if item["parent_id"] in l2_map:
                    l2_map[item["parent_id"]]["children"].append(item)

        return tree

    def get_all_keywords(self) -> Dict[str, List[str]]:
        """
        获取所有关键词及其对应的分类ID

        Returns:
            {classification_id: [keywords]} 映射
        """
        conn = self.store._get_conn()
        cursor = conn.execute("""
            SELECT id, keywords FROM taxonomy_dimensions WHERE keywords IS NOT NULL
        """)
        rows = cursor.fetchall()
        conn.close()

        result = {}
        for row in rows:
            if row["keywords"]:
                result[row["id"]] = json.loads(row["keywords"])

        return result

    def find_by_keywords(self, text: str) -> List[Dict[str, Any]]:
        """
        根据关键词匹配分类

        Args:
            text: 待匹配的文本

        Returns:
            匹配的分类列表，按匹配度排序
        """
        conn = self.store._get_conn()
        cursor = conn.execute("""
            SELECT id, level, parent_id, code, name, description, keywords
            FROM taxonomy_dimensions
            WHERE keywords IS NOT NULL
        """)
        rows = cursor.fetchall()
        conn.close()

        matches = []
        text_lower = text.lower()

        for row in rows:
            keywords = json.loads(row["keywords"]) if row["keywords"] else []
            matched_keywords = [kw for kw in keywords if kw.lower() in text_lower]

            if matched_keywords:
                matches.append({
                    "id": row["id"],
                    "level": row["level"],
                    "parent_id": row["parent_id"],
                    "code": row["code"],
                    "name": row["name"],
                    "matched_keywords": matched_keywords,
                    "score": len(matched_keywords) / len(keywords) if keywords else 0
                })

        # 按匹配分数排序
        matches.sort(key=lambda x: x["score"], reverse=True)
        return matches

    def get_l1_dimensions(self) -> List[Dict[str, Any]]:
        """获取所有 L1 维度"""
        conn = self.store._get_conn()
        cursor = conn.execute("""
            SELECT id, code, name, description FROM taxonomy_dimensions
            WHERE level = 1 ORDER BY sort_order
        """)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def get_l2_categories(self, l1_id: str = None) -> List[Dict[str, Any]]:
        """获取 L2 分类，可按 L1 维度筛选"""
        conn = self.store._get_conn()

        if l1_id:
            cursor = conn.execute("""
                SELECT id, parent_id, code, name, description
                FROM taxonomy_dimensions
                WHERE level = 2 AND parent_id = ?
                ORDER BY sort_order
            """, (l1_id,))
        else:
            cursor = conn.execute("""
                SELECT id, parent_id, code, name, description
                FROM taxonomy_dimensions
                WHERE level = 2 ORDER BY sort_order
            """)

        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def get_l3_items(self, l2_id: str = None) -> List[Dict[str, Any]]:
        """获取 L3 指标，可按 L2 分类筛选"""
        conn = self.store._get_conn()

        if l2_id:
            cursor = conn.execute("""
                SELECT id, parent_id, code, name, description
                FROM taxonomy_dimensions
                WHERE level = 3 AND parent_id = ?
                ORDER BY sort_order
            """, (l2_id,))
        else:
            cursor = conn.execute("""
                SELECT id, parent_id, code, name, description
                FROM taxonomy_dimensions
                WHERE level = 3 ORDER BY sort_order
            """)

        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]


# 统计信息
TAXONOMY_STATS = {
    "L1_count": 5,  # 战略、组织、绩效、薪酬、人才
    "L2_count": 19,  # 各维度下的分类数
    "L3_count": 58,  # 具体指标数
    "dimensions": ["strategy", "structure", "performance", "compensation", "talent"]
}
