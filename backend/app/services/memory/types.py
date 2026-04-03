"""
记忆类型定义 — 借鉴 Claude Code src/memdir/memoryTypes.ts

四类记忆:
  CLIENT       — 客户画像、行业、偏好
  METHODOLOGY  — 方法论反馈（有效/无效的做法）
  PROJECT      — 项目进度、决策、约束
  REFERENCE    — 外部资源指针
"""
from enum import Enum


class MemoryType(str, Enum):
    CLIENT = "client"
    METHODOLOGY = "methodology"
    PROJECT = "project"
    REFERENCE = "reference"


# 每种类型的保存规则
MEMORY_RULES = {
    MemoryType.CLIENT: {
        "when_to_save": "了解客户行业、规模、组织架构、历史合作情况时",
        "how_to_use": "定制引导话术和分析深度",
        "body_structure": "客户属性 + 行业特征 + 偏好",
    },
    MemoryType.METHODOLOGY: {
        "when_to_save": "分析方法被验证有效或无效时",
        "how_to_use": "选择分析方法和工具时的参考",
        "body_structure": "方法描述 + **Why:** 有效/无效的原因 + **How to apply:** 适用场景",
    },
    MemoryType.PROJECT: {
        "when_to_save": "项目中的关键决策、约束、截止日期",
        "how_to_use": "理解项目上下文，协调多项目",
        "body_structure": "事实 + **Why:** 动机 + **How to apply:** 影响范围",
    },
    MemoryType.REFERENCE: {
        "when_to_save": "发现有用的外部资源（报告、政策、数据源）",
        "how_to_use": "需要查找外部信息时",
        "body_structure": "资源名称 + 位置 + 用途",
    },
}

# 不保存的内容（借鉴 Claude Code 的排除规则）
MEMORY_EXCLUSIONS = [
    "可从代码或数据库推导的信息",
    "临时性数据（当前会话的上下文）",
    "已有文档明确记录的内容",
]
