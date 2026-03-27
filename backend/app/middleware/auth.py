"""
认证中间件

验证 Supabase JWT token，保护 API 端点。

使用方式:
    AUTH_ENABLED=true 时启用认证（默认关闭，向后兼容）
"""
import os
import logging
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# 不需要认证的路径
PUBLIC_PATHS = {
    "/health",
    "/api/health",
    "/docs",
    "/openapi.json",
    "/redoc",
}


def get_current_user_id(request: Request) -> str | None:
    """
    从请求中提取用户 ID。

    优先从 Authorization header 中解析 Supabase JWT，
    如果没有 token 则返回 None（匿名用户）。
    """
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]
    if not token:
        return None

    try:
        import jwt
    except ImportError:
        logger.warning("PyJWT not installed, skipping JWT verification")
        return None

    try:
        payload = jwt.decode(
            token,
            os.getenv("SUPABASE_ANON_KEY", ""),
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 已过期，请重新登录",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证 token",
        )
    except Exception as e:
        logger.error(f"JWT verification error: {e}")
        return None


class AuthMiddleware(BaseHTTPMiddleware):
    """
    认证中间件

    - 公开端点（health, docs）直接放行
    - OPTIONS 预检请求直接放行（CORS 需要）
    - AUTH_ENABLED=true 时验证 Authorization header
    - AUTH_ENABLED=false 时允许匿名访问（向后兼容）
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # 公开端点放行
        if path in PUBLIC_PATHS:
            return await call_next(request)

        # CORS 预检放行
        if request.method == "OPTIONS":
            return await call_next(request)

        # 检查是否启用认证
        auth_enabled = os.getenv("AUTH_ENABLED", "false").lower() == "true"
        if not auth_enabled:
            return await call_next(request)

        # 验证 token
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"success": False, "error": "缺少认证 token"},
            )

        user_id = get_current_user_id(request)
        if user_id is None:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"success": False, "error": "认证失败，token 无效或已过期"},
            )

        # 将 user_id 存入 request.state
        request.state.user_id = user_id
        response = await call_next(request)
        return response
