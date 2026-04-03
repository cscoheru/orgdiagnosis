"""
功能开关管理 — 借鉴 Claude Code 的三层优先级

优先级（高→低）：
  1. 项目级覆盖 (ArangoDB Project_Settings 对象)
  2. 环境变量 (FEATURE_<FLAG>=true/false)
  3. 硬编码默认值

用法:
  from app.services.feature_flags import feature_flags

  if feature_flags.is_enabled("tool_registry"):
      ...
"""
import os
from typing import Any


class FeatureFlags:
    """功能开关管理"""

    # 硬编码默认值 — 所有 flag 的 source of truth
    _defaults: dict[str, bool] = {
        # 已实现的功能
        "agent_session": True,
        "blueprint_management": True,
        "pptx_generation": True,
        "five_dimensions": True,
        "workshop_tools": True,
        "knowledge_base": True,

        # P0 新功能
        "tool_registry": False,
        "hook_system": False,

        # P1 新功能
        "memory_system": False,
        "dream_consolidation": False,

        # P2 新功能
        "background_tasks": False,
    }

    def __init__(self):
        self._project_overrides: dict[str, dict[str, bool]] = {}

    def is_enabled(self, flag: str, project_id: str | None = None) -> bool:
        """
        检查功能是否启用。

        优先级: 项目级(ArangoDB) > 环境变量 > 默认值
        """
        # 1. 项目级覆盖
        if project_id and project_id in self._project_overrides:
            project_flags = self._project_overrides[project_id]
            if flag in project_flags:
                return project_flags[flag]

        # 2. 环境变量 FEATURE_<FLAG_NAME>=true/false
        env_key = f"FEATURE_{flag.upper()}"
        env_val = os.getenv(env_key, "").strip().lower()
        if env_val in ("true", "1", "yes"):
            return True
        if env_val in ("false", "0", "no"):
            return False

        # 3. 硬编码默认值
        return self._defaults.get(flag, False)

    def set_project_override(self, project_id: str, flag: str, enabled: bool) -> None:
        """设置项目级功能覆盖（运行时，不持久化）"""
        if project_id not in self._project_overrides:
            self._project_overrides[project_id] = {}
        self._project_overrides[project_id][flag] = enabled

    def load_project_overrides(self, project_id: str, flags: dict[str, bool]) -> None:
        """批量加载项目级覆盖（从 ArangoDB Project_Settings 加载时调用）"""
        self._project_overrides[project_id] = dict(flags)

    def clear_project_overrides(self, project_id: str) -> None:
        """清除项目级覆盖"""
        self._project_overrides.pop(project_id, None)

    def get_all_flags(self, project_id: str | None = None) -> dict[str, bool]:
        """获取所有 flag 的当前有效值"""
        return {flag: self.is_enabled(flag, project_id) for flag in self._defaults}

    def list_defaults(self) -> dict[str, bool]:
        """获取默认值（用于管理 API 展示）"""
        return dict(self._defaults)


# 全局单例
feature_flags = FeatureFlags()
