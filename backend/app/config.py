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

    # CORS - 允许所有来源（开发/生产环境）
    CORS_ORIGINS: list = ["*"]

    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")

    # DeepSeek API
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_API_URL: str = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")

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

settings = Settings()
