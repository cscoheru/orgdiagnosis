"""
五维诊断 API - 主入口
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
import os
import time

from app.config import settings
from app.api.router import api_router
from app.models.schemas import HealthResponse
from app.middleware.auth import AuthMiddleware

# Rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

rate_limit_enabled = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
limiter = Limiter(key_func=get_remote_address, enabled=rate_limit_enabled)

# 配置日志
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info(f"{settings.APP_NAME} v{settings.APP_VERSION} starting...")
    logger.info(f"Supabase: {'configured' if settings.SUPABASE_URL else 'not configured'}")
    logger.info(f"Auth: {'ENABLED' if os.getenv('AUTH_ENABLED', 'false').lower() == 'true' else 'DISABLED (set AUTH_ENABLED=true to enable)'}")

    # 初始化内核数据库
    from app.kernel.database import init_kernel_db, close_kernel_db
    from app.kernel.config import kernel_settings
    logger.info(f"Kernel: mode={kernel_settings.KERNEL_MODE}, database={kernel_settings.ARANGO_DATABASE}")
    init_kernel_db()

    yield

    close_kernel_db()
    logger.info("👋 应用关闭")


# 创建应用
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="企业组织诊断系统后端 API",
    lifespan=lifespan,
    state={"limiter": limiter}
)

# Rate limit exceeded handler
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 认证中间件 (通过 AUTH_ENABLED=true 启用)
app.add_middleware(AuthMiddleware)


# 请求日志中间件
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000

    logger.info(
        f"{request.method} {request.url.path} - "
        f"{response.status_code} - {process_time:.2f}ms"
    )
    return response


# 异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"全局异常: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "服务器内部错误",
        }
    )


# 注册路由
app.include_router(api_router, prefix="/api")


# 健康检查
@app.get("/api/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION
    }


@app.get("/health")
async def health_check_simple():
    """简单健康检查（Render 兼容）"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
