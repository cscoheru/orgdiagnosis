"""
五维分类数据

定义了 5 个 L1 维度, 19 个 L2 分类, 58 个 L3 分类项
"""

TAXONOMY_DATA = [
    # L1: 战略
    {
        'id': 'strategy',
        'level': 1,
        'code': 'strategy',
        'name': '战略',
        'description': '企业战略规划与发展方向、使命愿景等',
        'keywords': ['战略', '使命', '愿景', '目标', '规划', '发展', '方向'],
        'examples': ['战略规划报告', '企业愿景报告', '三年发展规划'],
        'sort_order': 1
    },
    # L1: 组织
    {
        'id': 'organization',
        'level': 1,
        'code': 'organization',
        'name': '组织',
        'description': '组织架构、组织设计,人力资源配置等',
        'keywords': ['组织', '架构', '结构', '人力资源', 'HR', '组织设计'],
        'examples': ['组织架构图', '人力资源规划报告'],
        'sort_order': 2
    },
    # L1: 绩效
    {
        'id': 'performance',
        'level': 1,
        'code': 'performance',
        'name': '绩效',
        'description': '绩效管理、绩效考核、 KPI体系等',
        'keywords': ['绩效', 'KPI', '考核', '指标', '评估', 'OKR', 'BSC'],
        'examples': ['绩效管理报告', 'KPI分析报告', '绩效考核方案'],
        'sort_order': 3
    },
    # L1: 薪酬
    {
        'id': 'compensation',
        'level': 1,
        'code': 'compensation',
        'name': '薪酬',
        'description': '薪酬体系、激励机制,福利待遇等',
        'keywords': ['薪酬', '工资', '激励', '福利', '奖金', '待遇'],
        'examples': ['薪酬调研报告', '激励机制设计', '福利分析报告'],
        'sort_order': 4
    },
    # L1: 人才
    {
        'id': 'talent',
        'level': 1,
        'code': 'talent',
        'name': '人才',
        'description': '人才发展,能力建设,人才梯队等',
        'keywords': ['人才', '培养', '发展', '能力', '培训', '梯队', '素质'],
        'examples': ['人才发展规划',  '培训需求分析',  '能力素质模型'],
        'sort_order': 5
    },
    # L2: 战略
    {
                'id': 'strategy.mission',
                'level': 2,
                'code': 'strategy.mission',
                'parent_code': 'strategy',
                'name': '使命愿景',
                'description': '企业使命,愿景和价值观',
                'keywords': ['使命', '愿景', '价值观', '文化'],
                'examples': ['使命愿景报告',  '价值观宣导'],
                'sort_order': 1
            },
            {
                'id': 'strategy.positioning',
                'level': 2,
                'code': 'strategy.positioning',
                'parent_code': 'strategy',
                'name': '市场定位',
                'description': '市场定位,竞争优势,竞争策略',
                'keywords': ['定位', '市场', '竞争', '优势', '差异化'],
                'examples': ['市场分析报告',  '竞争分析报告'],
                'sort_order': 2
            },
            {
                'id': 'strategy.growth',
                'level': 2,
                'code': 'strategy.growth',
                'parent_code': 'strategy',
                'name': '增长策略',
                'description': '业务增长,扩张策略,多元化发展',
                'keywords': ['增长', '扩张', '多元化', '发展', '业务'],
                'examples': ['增长战略报告',  '业务规划报告'],
                'sort_order': 3
            },
            {
                'id': 'strategy.innovation',
                'level': 2,
                'code': 'strategy.innovation',
                'parent_code': 'strategy',
                'name': '创新战略',
                'description': '技术创新,产品创新,模式创新',
                'keywords': ['创新', '技术', '产品', '研发', 'R&D'],
                'examples': ['创新战略报告',  '技术路线图'],
                'sort_order': 4
            },
            {
                'id': 'strategy.risk',
                'level': 2,
                'code': 'strategy.risk',
                'parent_code': 'strategy',
                'name': '风险管理',
                'description': '风险识别,风险评估,风险应对',
                'keywords': ['风险', '危机', '挑战', '威胁', '机会'],
                'examples': ['风险评估报告',  '风险应对方案'],
                'sort_order': 5
            },
        # L2: 组织
            {
                'id': 'organization.structure',
                'level': 2,
                'code': 'organization.structure',
                'parent_code': 'organization',
                'name': '组织结构',
                'description': '组织架构设计,部门设置,层级关系',
                'keywords': ['结构', '架构', '部门', '层级', '分工'],
                'examples': ['组织架构图',  '部门职能说明'],
                'sort_order': 1
            },
            {
                'id': 'organization.process',
                'level': 2,
                'code': 'organization.process',
                'parent_code': 'organization',
                'name': '流程管理',
                'description': '业务流程,工作流程,流程优化',
                'keywords': ['流程', '业务', '工作', 'SOP', '优化'],
                'examples': ['流程图',  'SOP文档'],
                'sort_order': 2
            },
            {
                'id': 'organization.culture',
                'level': 2,
                'code': 'organization.culture',
                'parent_code': 'organization',
                'name': '组织文化',
                'description': '企业文化,团队氛围,价值观传导',
                'keywords': ['文化', '价值观', '氛围', '氛围', '理念'],
                'examples': ['文化建设报告',  '价值观报告'],
                'sort_order': 3
            },
            {
                'id': 'organization.governance',
                'level': 2,
                'code': 'organization.governance',
                'parent_code': 'organization',
                'name': '公司治理',
                'description': '治理结构,决策机制,内控体系',
                'keywords': ['治理', '决策', '内控', '合规', '风险'],
                'examples': ['治理报告',  '内控评估报告'],
                'sort_order': 4
            },
        # L2: 绩效
            {
                'id': 'performance.kpi',
                'level': 2,
                'code': 'performance.kpi',
                'parent_code': 'performance',
                'name': 'KPI体系',
                'description': '关键绩效指标,考核指标,指标体系',
                'keywords': ['KPI', '指标', '考核', '度量', '衡量'],
                'examples': ['KPI报告',  '绩效考核表'],
                'sort_order': 1
            },
            {
                'id': 'performance.evaluation',
                'level': 2,
                'code': 'performance.evaluation',
                'parent_code': 'performance',
                'name': '绩效评估',
                'description': '绩效评价,考核结果,绩效分析',
                'keywords': ['评估', '评价', '考核', '评分', '等级'],
                'examples': ['绩效评估报告',  '考核结果分析'],
                'sort_order': 2
            },
            {
                'id': 'performance.improvement',
                'level': 2,
                'code': 'performance.improvement',
                'parent_code': 'performance',
                'name': '绩效改进',
                'description': '绩效改进计划,提升方案,改进措施',
                'keywords': ['改进', '提升', '优化', '改善', '措施'],
                'examples': ['改进计划报告',  '提升方案'],
                'sort_order': 3
            },
        # L2: 薪酬
            {
                'id': 'compensation.structure',
                'level': 2,
                'code': 'compensation.structure',
                'parent_code': 'compensation',
                'name': '薪酬结构',
                'description': '薪酬体系设计,薪资结构,宽带薪酬',
                'keywords': ['薪酬', '结构', '体系', '工资', '宽带'],
                'examples': ['薪酬结构报告',  '薪酬体系设计'],
                'sort_order': 1
            },
            {
                'id': 'compensation.incentive',
                'level': 2,
                'code': 'compensation.incentive',
                'parent_code': 'compensation',
                'name': '激励机制',
                'description': '激励政策,奖金方案,股权激励',
                'keywords': ['激励', '奖金', '股权', '期权', '奖励'],
                'examples': ['激励方案报告',  '奖金制度'],
                'sort_order': 2
            },
            {
                'id': 'compensation.benefits',
                'level': 2,
                'code': 'compensation.benefits',
                'parent_code': 'compensation',
                'name': '福利体系',
                'description': '员工福利,福利计划,福利待遇',
                'keywords': ['福利', '待遇', '保障', '补贴', '津贴'],
                'examples': ['福利方案报告',  '福利手册'],
                'sort_order': 3
            },
        # L2: 人才
            {
                'id': 'talent.development',
                'level': 2,
                'code': 'talent.development',
                'parent_code': 'talent',
                'name': '人才发展',
                'description': '人才培养,职业发展,能力提升',
                'keywords': ['培养', '发展', '培训', '晋升', '能力'],
                'examples': ['培训计划报告', '职业发展规划'],
                'sort_order': 1
            },
            {
                'id': 'talent.succession',
                'level': 2,
                'code': 'talent.succession',
                'parent_code': 'talent',
                'name': '继任计划',
                'description': '人才梯队,继任者计划,关键岗位储备',
                'keywords': ['继任', '梯队', '储备', '接班人', '关键岗位'],
                'examples': ['继任计划报告', '人才梯队建设'],
                'sort_order': 2
            },
            {
                'id': 'talent.assessment',
                'level': 2,
                'code': 'talent.assessment',
                'parent_code': 'talent',
                'name': '人才测评',
                'description': '能力评估,素质模型,人才盘点',
                'keywords': ['测评', '评估', '盘点', '素质', '能力模型'],
                'examples': ['人才盘点报告', '能力素质模型'],
                'sort_order': 3
            },
            {
                'id': 'talent.retention',
                'level': 2,
                'code': 'talent.retention',
                'parent_code': 'talent',
                'name': '人才保留',
                'description': '留才策略,员工敬业度,离职管理',
                'keywords': ['保留', '留才', '敬业度', '离职', '人才流失'],
                'examples': ['员工敬业度调查', '人才保留方案'],
                'sort_order': 4
            },
        # L3: 战略 - 使命愿景
            {
                'id': 'strategy.mission.vision_statement',
                'level': 3,
                'code': 'strategy.mission.vision_statement',
                'parent_code': 'strategy.mission',
                'name': '愿景陈述',
                'description': '企业愿景声明和未来展望',
                'keywords': ['愿景', '未来', '展望', '目标'],
                'examples': ['企业愿景陈述'],
                'sort_order': 1
            },
            {
                'id': 'strategy.mission.core_values',
                'level': 3,
                'code': 'strategy.mission.core_values',
                'parent_code': 'strategy.mission',
                'name': '核心价值观',
                'description': '企业核心价值观和行为准则',
                'keywords': ['价值观', '理念', '准则', '信念'],
                'examples': ['核心价值观手册'],
                'sort_order': 2
            },
            {
                'id': 'strategy.mission.cultural_alignment',
                'level': 3,
                'code': 'strategy.mission.cultural_alignment',
                'parent_code': 'strategy.mission',
                'name': '文化一致性',
                'description': '组织文化与战略目标的一致性',
                'keywords': ['文化', '一致性', '战略对齐'],
                'examples': ['文化审计报告'],
                'sort_order': 3
            },
        # L3: 战略 - 市场定位
            {
                'id': 'strategy.positioning.market_analysis',
                'level': 3,
                'code': 'strategy.positioning.market_analysis',
                'parent_code': 'strategy.positioning',
                'name': '市场分析',
                'description': '市场规模、增长趋势、竞争格局',
                'keywords': ['市场', '分析', '趋势', '规模'],
                'examples': ['市场研究报告'],
                'sort_order': 1
            },
            {
                'id': 'strategy.positioning.competitive_advantage',
                'level': 3,
                'code': 'strategy.positioning.competitive_advantage',
                'parent_code': 'strategy.positioning',
                'name': '竞争优势',
                'description': '差异化优势和核心竞争力',
                'keywords': ['优势', '差异化', '核心竞争力'],
                'examples': ['竞争分析报告'],
                'sort_order': 2
            },
            {
                'id': 'strategy.positioning.target_segment',
                'level': 3,
                'code': 'strategy.positioning.target_segment',
                'parent_code': 'strategy.positioning',
                'name': '目标细分',
                'description': '目标客户群体和市场细分',
                'keywords': ['细分', '目标客户', '定位'],
                'examples': ['客户细分报告'],
                'sort_order': 3
            },
        # L3: 战略 - 增长策略
            {
                'id': 'strategy.growth.organic',
                'level': 3,
                'code': 'strategy.growth.organic',
                'parent_code': 'strategy.growth',
                'name': '内生增长',
                'description': '通过内部能力提升实现增长',
                'keywords': ['内生', '能力提升', '内部增长'],
                'examples': ['内生增长计划'],
                'sort_order': 1
            },
            {
                'id': 'strategy.growth.manda',
                'level': 3,
                'code': 'strategy.growth.manda',
                'parent_code': 'strategy.growth',
                'name': '并购整合',
                'description': '通过并购实现业务扩张',
                'keywords': ['并购', '整合', '扩张'],
                'examples': ['并购战略报告'],
                'sort_order': 2
            },
            {
                'id': 'strategy.growth.diversification',
                'level': 3,
                'code': 'strategy.growth.diversification',
                'parent_code': 'strategy.growth',
                'name': '多元化发展',
                'description': '进入新业务领域和市场',
                'keywords': ['多元化', '新业务', '拓展'],
                'examples': ['多元化战略报告'],
                'sort_order': 3
            },
        # L3: 战略 - 创新战略
            {
                'id': 'strategy.innovation.rd_investment',
                'level': 3,
                'code': 'strategy.innovation.rd_investment',
                'parent_code': 'strategy.innovation',
                'name': '研发投入',
                'description': '研发资源配置和投入策略',
                'keywords': ['研发', '投入', 'R&D', '技术'],
                'examples': ['研发投入报告'],
                'sort_order': 1
            },
            {
                'id': 'strategy.innovation.product_innovation',
                'level': 3,
                'code': 'strategy.innovation.product_innovation',
                'parent_code': 'strategy.innovation',
                'name': '产品创新',
                'description': '新产品开发和创新管理',
                'keywords': ['产品', '创新', '新产品', '开发'],
                'examples': ['产品创新路线图'],
                'sort_order': 2
            },
            {
                'id': 'strategy.innovation.business_model',
                'level': 3,
                'code': 'strategy.innovation.business_model',
                'parent_code': 'strategy.innovation',
                'name': '商业模式创新',
                'description': '新商业模式探索和验证',
                'keywords': ['商业模式', '创新', '模式'],
                'examples': ['商业模式分析报告'],
                'sort_order': 3
            },
        # L3: 战略 - 风险管理
            {
                'id': 'strategy.risk.identification',
                'level': 3,
                'code': 'strategy.risk.identification',
                'parent_code': 'strategy.risk',
                'name': '风险识别',
                'description': '战略风险识别和分析',
                'keywords': ['风险', '识别', '分析'],
                'examples': ['风险识别报告'],
                'sort_order': 1
            },
            {
                'id': 'strategy.risk.assessment',
                'level': 3,
                'code': 'strategy.risk.assessment',
                'parent_code': 'strategy.risk',
                'name': '风险评估',
                'description': '风险影响和概率评估',
                'keywords': ['评估', '影响', '概率'],
                'examples': ['风险评估矩阵'],
                'sort_order': 2
            },
            {
                'id': 'strategy.risk.mitigation',
                'level': 3,
                'code': 'strategy.risk.mitigation',
                'parent_code': 'strategy.risk',
                'name': '风险应对',
                'description': '风险缓解和应对策略',
                'keywords': ['应对', '缓解', '策略'],
                'examples': ['风险应对方案'],
                'sort_order': 3
            },
        # L3: 组织 - 组织结构
            {
                'id': 'organization.structure.design',
                'level': 3,
                'code': 'organization.structure.design',
                'parent_code': 'organization.structure',
                'name': '组织设计',
                'description': '组织架构设计和优化',
                'keywords': ['设计', '架构', '优化'],
                'examples': ['组织设计报告'],
                'sort_order': 1
            },
            {
                'id': 'organization.structure.reporting',
                'level': 3,
                'code': 'organization.structure.reporting',
                'parent_code': 'organization.structure',
                'name': '汇报关系',
                'description': '汇报层级和管理幅度',
                'keywords': ['汇报', '层级', '管理幅度'],
                'examples': ['汇报关系图'],
                'sort_order': 2
            },
            {
                'id': 'organization.structure.departmentalization',
                'level': 3,
                'code': 'organization.structure.departmentalization',
                'parent_code': 'organization.structure',
                'name': '部门划分',
                'description': '部门设置和职能划分',
                'keywords': ['部门', '职能', '划分'],
                'examples': ['部门职能说明'],
                'sort_order': 3
            },
        # L3: 组织 - 流程管理
            {
                'id': 'organization.process.mapping',
                'level': 3,
                'code': 'organization.process.mapping',
                'parent_code': 'organization.process',
                'name': '流程梳理',
                'description': '业务流程梳理和文档化',
                'keywords': ['流程', '梳理', '文档'],
                'examples': ['流程图'],
                'sort_order': 1
            },
            {
                'id': 'organization.process.optimization',
                'level': 3,
                'code': 'organization.process.optimization',
                'parent_code': 'organization.process',
                'name': '流程优化',
                'description': '流程效率提升和改进',
                'keywords': ['优化', '效率', '改进'],
                'examples': ['流程优化报告'],
                'sort_order': 2
            },
            {
                'id': 'organization.process.standardization',
                'level': 3,
                'code': 'organization.process.standardization',
                'parent_code': 'organization.process',
                'name': '流程标准化',
                'description': 'SOP制定和标准化管理',
                'keywords': ['标准化', 'SOP', '规范'],
                'examples': ['SOP文档'],
                'sort_order': 3
            },
        # L3: 组织 - 组织文化
            {
                'id': 'organization.culture.values',
                'level': 3,
                'code': 'organization.culture.values',
                'parent_code': 'organization.culture',
                'name': '价值观传导',
                'description': '价值观落地和文化传导',
                'keywords': ['价值观', '传导', '落地'],
                'examples': ['价值观手册'],
                'sort_order': 1
            },
            {
                'id': 'organization.culture.engagement',
                'level': 3,
                'code': 'organization.culture.engagement',
                'parent_code': 'organization.culture',
                'name': '员工敬业度',
                'description': '员工参与度和满意度',
                'keywords': ['敬业度', '满意度', '参与'],
                'examples': ['敬业度调查报告'],
                'sort_order': 2
            },
            {
                'id': 'organization.culture.atmosphere',
                'level': 3,
                'code': 'organization.culture.atmosphere',
                'parent_code': 'organization.culture',
                'name': '团队氛围',
                'description': '工作氛围和团队协作',
                'keywords': ['氛围', '团队', '协作'],
                'examples': ['团队氛围报告'],
                'sort_order': 3
            },
        # L3: 组织 - 公司治理
            {
                'id': 'organization.governance.board',
                'level': 3,
                'code': 'organization.governance.board',
                'parent_code': 'organization.governance',
                'name': '董事会治理',
                'description': '董事会结构和运作',
                'keywords': ['董事会', '治理', '决策'],
                'examples': ['董事会报告'],
                'sort_order': 1
            },
            {
                'id': 'organization.governance.internal_control',
                'level': 3,
                'code': 'organization.governance.internal_control',
                'parent_code': 'organization.governance',
                'name': '内部控制',
                'description': '内控体系和合规管理',
                'keywords': ['内控', '合规', '风险'],
                'examples': ['内控评估报告'],
                'sort_order': 2
            },
            {
                'id': 'organization.governance.decision_making',
                'level': 3,
                'code': 'organization.governance.decision_making',
                'parent_code': 'organization.governance',
                'name': '决策机制',
                'description': '决策流程和授权体系',
                'keywords': ['决策', '授权', '流程'],
                'examples': ['授权手册'],
                'sort_order': 3
            },
        # L3: 绩效 - KPI体系
            {
                'id': 'performance.kpi.design',
                'level': 3,
                'code': 'performance.kpi.design',
                'parent_code': 'performance.kpi',
                'name': 'KPI设计',
                'description': '关键绩效指标设计和分解',
                'keywords': ['KPI', '设计', '分解'],
                'examples': ['KPI指标库'],
                'sort_order': 1
            },
            {
                'id': 'performance.kpi.cascade',
                'level': 3,
                'code': 'performance.kpi.cascade',
                'parent_code': 'performance.kpi',
                'name': '指标分解',
                'description': '战略目标到部门个人的分解',
                'keywords': ['分解', '目标', '对齐'],
                'examples': ['目标分解矩阵'],
                'sort_order': 2
            },
            {
                'id': 'performance.kpi.tracking',
                'level': 3,
                'code': 'performance.kpi.tracking',
                'parent_code': 'performance.kpi',
                'name': '指标跟踪',
                'description': 'KPI监控和跟踪管理',
                'keywords': ['跟踪', '监控', '仪表盘'],
                'examples': ['KPI仪表盘'],
                'sort_order': 3
            },
        # L3: 绩效 - 绩效评估
            {
                'id': 'performance.evaluation.method',
                'level': 3,
                'code': 'performance.evaluation.method',
                'parent_code': 'performance.evaluation',
                'name': '评估方法',
                'description': '绩效考核方法和工具',
                'keywords': ['方法', '工具', '360度', 'BSC'],
                'examples': ['考核方法指南'],
                'sort_order': 1
            },
            {
                'id': 'performance.evaluation.cycle',
                'level': 3,
                'code': 'performance.evaluation.cycle',
                'parent_code': 'performance.evaluation',
                'name': '评估周期',
                'description': '考核频率和周期管理',
                'keywords': ['周期', '频率', '季度', '年度'],
                'examples': ['考核日历'],
                'sort_order': 2
            },
            {
                'id': 'performance.evaluation.feedback',
                'level': 3,
                'code': 'performance.evaluation.feedback',
                'parent_code': 'performance.evaluation',
                'name': '绩效反馈',
                'description': '绩效面谈和反馈机制',
                'keywords': ['反馈', '面谈', '沟通'],
                'examples': ['绩效面谈指南'],
                'sort_order': 3
            },
        # L3: 绩效 - 绩效改进
            {
                'id': 'performance.improvement.plan',
                'level': 3,
                'code': 'performance.improvement.plan',
                'parent_code': 'performance.improvement',
                'name': '改进计划',
                'description': '绩效改进计划制定',
                'keywords': ['改进', '计划', 'PIP'],
                'examples': ['绩效改进计划'],
                'sort_order': 1
            },
            {
                'id': 'performance.improvement.coaching',
                'level': 3,
                'code': 'performance.improvement.coaching',
                'parent_code': 'performance.improvement',
                'name': '绩效辅导',
                'description': '管理者绩效辅导技能',
                'keywords': ['辅导', '教练', '支持'],
                'examples': ['辅导技能培训'],
                'sort_order': 2
            },
            {
                'id': 'performance.improvement.linkage',
                'level': 3,
                'code': 'performance.improvement.linkage',
                'parent_code': 'performance.improvement',
                'name': '绩效联动',
                'description': '绩效与薪酬晋升联动',
                'keywords': ['联动', '薪酬', '晋升'],
                'examples': ['绩效薪酬方案'],
                'sort_order': 3
            },
        # L3: 薪酬 - 薪酬结构
            {
                'id': 'compensation.structure.design',
                'level': 3,
                'code': 'compensation.structure.design',
                'parent_code': 'compensation.structure',
                'name': '薪酬设计',
                'description': '薪酬体系设计和优化',
                'keywords': ['设计', '体系', '宽带薪酬'],
                'examples': ['薪酬设计方案'],
                'sort_order': 1
            },
            {
                'id': 'compensation.structure.benchmarking',
                'level': 3,
                'code': 'compensation.structure.benchmarking',
                'parent_code': 'compensation.structure',
                'name': '薪酬对标',
                'description': '市场薪酬对标分析',
                'keywords': ['对标', '市场', '调研'],
                'examples': ['薪酬调研报告'],
                'sort_order': 2
            },
            {
                'id': 'compensation.structure.grade',
                'level': 3,
                'code': 'compensation.structure.grade',
                'parent_code': 'compensation.structure',
                'name': '职级薪酬',
                'description': '职级体系和薪酬宽带',
                'keywords': ['职级', '宽带', '等级'],
                'examples': ['职级薪酬表'],
                'sort_order': 3
            },
        # L3: 薪酬 - 激励机制
            {
                'id': 'compensation.incentive.bonus',
                'level': 3,
                'code': 'compensation.incentive.bonus',
                'parent_code': 'compensation.incentive',
                'name': '奖金方案',
                'description': '绩效奖金和激励方案',
                'keywords': ['奖金', '激励', '绩效'],
                'examples': ['奖金方案'],
                'sort_order': 1
            },
            {
                'id': 'compensation.incentive.equity',
                'level': 3,
                'code': 'compensation.incentive.equity',
                'parent_code': 'compensation.incentive',
                'name': '股权激励',
                'description': '股权期权激励计划',
                'keywords': ['股权', '期权', 'ESOP'],
                'examples': ['股权激励方案'],
                'sort_order': 2
            },
            {
                'id': 'compensation.incentive.long_term',
                'level': 3,
                'code': 'compensation.incentive.long_term',
                'parent_code': 'compensation.incentive',
                'name': '长期激励',
                'description': '长期激励和保留计划',
                'keywords': ['长期', '保留', '激励'],
                'examples': ['长期激励计划'],
                'sort_order': 3
            },
        # L3: 薪酬 - 福利体系
            {
                'id': 'compensation.benefits.design',
                'level': 3,
                'code': 'compensation.benefits.design',
                'parent_code': 'compensation.benefits',
                'name': '福利设计',
                'description': '员工福利方案设计',
                'keywords': ['福利', '设计', '方案'],
                'examples': ['福利方案'],
                'sort_order': 1
            },
            {
                'id': 'compensation.benefits.flexible',
                'level': 3,
                'code': 'compensation.benefits.flexible',
                'parent_code': 'compensation.benefits',
                'name': '弹性福利',
                'description': '弹性福利和自助选择',
                'keywords': ['弹性', '自助', '选择'],
                'examples': ['弹性福利计划'],
                'sort_order': 2
            },
            {
                'id': 'compensation.benefits.health',
                'level': 3,
                'code': 'compensation.benefits.health',
                'parent_code': 'compensation.benefits',
                'name': '健康福利',
                'description': '健康保险和员工关怀',
                'keywords': ['健康', '保险', '关怀'],
                'examples': ['健康福利方案'],
                'sort_order': 3
            },
        # L3: 人才 - 人才发展
            {
                'id': 'talent.development.training',
                'level': 3,
                'code': 'talent.development.training',
                'parent_code': 'talent.development',
                'name': '培训体系',
                'description': '培训体系和课程开发',
                'keywords': ['培训', '课程', '学习'],
                'examples': ['培训体系规划'],
                'sort_order': 1
            },
            {
                'id': 'talent.development.career',
                'level': 3,
                'code': 'talent.development.career',
                'parent_code': 'talent.development',
                'name': '职业发展',
                'description': '职业通道和发展规划',
                'keywords': ['职业', '通道', '发展'],
                'examples': ['职业发展通道'],
                'sort_order': 2
            },
            {
                'id': 'talent.development.leadership',
                'level': 3,
                'code': 'talent.development.leadership',
                'parent_code': 'talent.development',
                'name': '领导力发展',
                'description': '领导力培养和管理培训',
                'keywords': ['领导力', '管理', '培养'],
                'examples': ['领导力发展计划'],
                'sort_order': 3
            },
        # L3: 人才 - 继任计划
            {
                'id': 'talent.succession.planning',
                'level': 3,
                'code': 'talent.succession.planning',
                'parent_code': 'talent.succession',
                'name': '继任规划',
                'description': '关键岗位继任规划',
                'keywords': ['继任', '规划', '关键岗位'],
                'examples': ['继任计划报告'],
                'sort_order': 1
            },
            {
                'id': 'talent.succession.pipeline',
                'level': 3,
                'code': 'talent.succession.pipeline',
                'parent_code': 'talent.succession',
                'name': '人才梯队',
                'description': '人才梯队建设和培养',
                'keywords': ['梯队', '储备', '培养'],
                'examples': ['人才梯队报告'],
                'sort_order': 2
            },
            {
                'id': 'talent.succession.ready',
                'level': 3,
                'code': 'talent.succession.ready',
                'parent_code': 'talent.succession',
                'name': '继任者就绪',
                'description': '继任者准备度评估',
                'keywords': ['就绪', '准备度', '评估'],
                'examples': ['继任者就绪度报告'],
                'sort_order': 3
            },
        # L3: 人才 - 人才测评
            {
                'id': 'talent.assessment.model',
                'level': 3,
                'code': 'talent.assessment.model',
                'parent_code': 'talent.assessment',
                'name': '素质模型',
                'description': '能力素质模型构建',
                'keywords': ['素质', '模型', '能力'],
                'examples': ['能力素质模型'],
                'sort_order': 1
            },
            {
                'id': 'talent.assessment.review',
                'level': 3,
                'code': 'talent.assessment.review',
                'parent_code': 'talent.assessment',
                'name': '人才盘点',
                'description': '人才盘点和评估',
                'keywords': ['盘点', '评估', '九宫格'],
                'examples': ['人才盘点报告'],
                'sort_order': 2
            },
            {
                'id': 'talent.assessment.tool',
                'level': 3,
                'code': 'talent.assessment.tool',
                'parent_code': 'talent.assessment',
                'name': '测评工具',
                'description': '人才测评工具应用',
                'keywords': ['测评', '工具', '评估'],
                'examples': ['测评工具指南'],
                'sort_order': 3
            },
        # L3: 人才 - 人才保留
            {
                'id': 'talent.retention.strategy',
                'level': 3,
                'code': 'talent.retention.strategy',
                'parent_code': 'talent.retention',
                'name': '留才策略',
                'description': '人才保留策略和措施',
                'keywords': ['保留', '策略', '留才'],
                'examples': ['人才保留方案'],
                'sort_order': 1
            },
            {
                'id': 'talent.retention.turnover',
                'level': 3,
                'code': 'talent.retention.turnover',
                'parent_code': 'talent.retention',
                'name': '离职管理',
                'description': '离职分析和风险控制',
                'keywords': ['离职', '分析', '风险'],
                'examples': ['离职分析报告'],
                'sort_order': 2
            },
            {
                'id': 'talent.retention.engagement',
                'level': 3,
                'code': 'talent.retention.engagement',
                'parent_code': 'talent.retention',
                'name': '敬业度提升',
                'description': '员工敬业度提升措施',
                'keywords': ['敬业度', '提升', '参与'],
                'examples': ['敬业度提升方案'],
                'sort_order': 3
            }
]