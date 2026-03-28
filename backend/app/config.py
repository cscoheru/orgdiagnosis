"""
配置管理
"""
import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env with override=True to ensure .env file values take precedence
# over system environment variables (important for API URLs)
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

class Settings:
    # 应用配置
    APP_NAME: str = "五维诊断 API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    API_PREFIX: str = ""  # 路由前缀在 main.py 中设置

    # CORS - 限制为前端域名
    _cors_raw = os.getenv("CORS_ORIGINS", "")
    if _cors_raw:
        CORS_ORIGINS: list = [o.strip() for o in _cors_raw.split(",") if o.strip()]
    else:
        CORS_ORIGINS: list = [
            "http://localhost:3000",
            "http://localhost:3001",
            os.getenv("FRONTEND_URL", ""),
        ]
    CORS_ORIGINS: list = [o for o in CORS_ORIGINS if o]

    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")

    # DeepSeek API (legacy, 保留向后兼容)
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_API_URL: str = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")

    # AI 提供商配置 (新统一配置)
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "")  # dashscope | deepseek (空=自动检测)
    AI_MODEL: str = os.getenv("AI_MODEL", "")
    AI_API_URL: str = os.getenv("AI_API_URL", "")

    # 文件上传限制
    MAX_FILE_SIZE: int = 20 * 1024 * 1024  # 20MB
    ALLOWED_EXTENSIONS: set = {
        'txt', 'md', 'csv', 'json',
        'pdf', 'docx', 'xlsx', 'xls',
        'png', 'jpg', 'jpeg'
    }

    # AI 配置
    AI_TIMEOUT: int = 120  # 秒
    AI_MAX_TOKENS: int = 4096

    # 内核配置 (ConsultingOS)
    KERNEL_MODE: str = os.getenv("KERNEL_MODE", "demo")  # demo | production
    ARANGO_HOST: str = os.getenv("ARANGO_HOST", "localhost")
    ARANGO_PORT: int = int(os.getenv("ARANGO_PORT", "8529"))
    ARANGO_USER: str = os.getenv("ARANGO_USER", "root")
    ARANGO_PASSWORD: str = os.getenv("ARANGO_PASSWORD", "")
    ARANGO_DATABASE: str = os.getenv("ARANGO_DATABASE", "org_diagnosis")

settings = Settings()
