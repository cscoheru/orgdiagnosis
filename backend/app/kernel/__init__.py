"""
ConsultingOS 内核模块

提供元数据驱动的数据管理能力：
- 元模型 (MetaModel): 定义数据结构
- 对象 (Object): 业务数据实例
- 关系 (Relation): 对象间连接，构成图谱
"""

from app.kernel.config import kernel_settings
from app.kernel.database import get_db, init_kernel_db
from app.kernel.exceptions import AppException, handle_arango_error

__all__ = [
    "kernel_settings",
    "get_db",
    "init_kernel_db",
    "AppException",
    "handle_arango_error",
]
