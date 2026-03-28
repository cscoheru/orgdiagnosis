"""
内核配置 — ArangoDB 连接 + 运行模式

KERNEL_MODE=demo      → 使用内存数据库 (开发环境，无需安装 ArangoDB)
KERNEL_MODE=production → 连接真实 ArangoDB (生产环境)
"""
import os

from pydantic_settings import BaseSettings


class KernelSettings(BaseSettings):
    """内核配置 (从环境变量读取)"""

    # 运行模式
    KERNEL_MODE: str = os.getenv("KERNEL_MODE", "demo")  # demo | production

    # ArangoDB 连接 (仅 production 模式使用)
    ARANGO_HOST: str = os.getenv("ARANGO_HOST", "localhost")
    ARANGO_PORT: int = int(os.getenv("ARANGO_PORT", "8529"))
    ARANGO_USER: str = os.getenv("ARANGO_USER", "root")
    ARANGO_PASSWORD: str = os.getenv("ARANGO_PASSWORD", "")
    ARANGO_DATABASE: str = os.getenv("ARANGO_DATABASE", "org_diagnosis")

    @property
    def is_demo_mode(self) -> bool:
        return self.KERNEL_MODE == "demo"

    @property
    def arango_url(self) -> str:
        return f"http://{self.ARANGO_HOST}:{self.ARANGO_PORT}"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",  # 忽略 .env 中其他项目的变量
    }


kernel_settings = KernelSettings()
