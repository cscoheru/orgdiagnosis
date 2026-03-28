"""
内核异常处理

AppException: 应用级异常基类
handle_arango_error: 将 ArangoDB 异常映射为 HTTP 异常

注意: ArangoDB 异常仅在 KERNEL_MODE=production 时可用，
     demo 模式下 handle_arango_error 只处理通用错误。
"""
from fastapi import HTTPException, status
from typing import Any


class AppException(Exception):
    """应用异常基类"""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: dict[str, Any] | None = None,
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


def handle_arango_error(error: Exception) -> HTTPException:
    """统一处理 ArangoDB 异常"""

    # 仅在 production 模式下导入 ArangoDB 异常类型
    try:
        from arango.exceptions import (
            ArangoError,
            DocumentGetError,
            DocumentUpdateError,
            DocumentDeleteError,
            DocumentInsertError,
        )
        HAS_ARANGO = True
    except ImportError:
        HAS_ARANGO = False
        ArangoError = Exception  # type: ignore

    if HAS_ARANGO:
        error_map = {
            DocumentGetError: (status.HTTP_404_NOT_FOUND, "文档不存在"),
            DocumentUpdateError: (status.HTTP_400_BAD_REQUEST, "文档更新失败"),
            DocumentDeleteError: (status.HTTP_400_BAD_REQUEST, "文档删除失败"),
            DocumentInsertError: (status.HTTP_400_BAD_REQUEST, "文档创建失败"),
        }

        for error_type, (code, message) in error_map.items():
            if isinstance(error, error_type):
                return HTTPException(status_code=code, detail=message)

    # 默认错误
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"数据库错误: {str(error)}",
    )
