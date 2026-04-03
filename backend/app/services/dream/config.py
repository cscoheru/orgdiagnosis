"""
AutoDream 配置 — 门控参数
"""
from dataclasses import dataclass


@dataclass
class DreamConfig:
    min_hours: float = 24.0         # 两次巩固的最小间隔（小时）
    min_sessions: int = 3           # 触发巩固的最低会话数
    lock_timeout_hours: float = 1.0 # 锁超时（小时）
    scan_interval_ms: int = 600000  # 扫描节流（10分钟）
