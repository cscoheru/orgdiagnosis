"""
统一 AI 客户端

支持多个 OpenAI 兼容 API 提供商 (DashScope/通义千问, DeepSeek, 等)。
通过 AI_PROVIDER 环境变量切换提供商。
"""
import os
import json
import re
import logging
from typing import Dict, Any, Optional, List
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

# 确保 dotenv 已加载（config.py 负责加载，import 触发）
import app.config  # noqa: F401

logger = logging.getLogger(__name__)

# 提供商配置
PROVIDERS = {
    "dashscope": {
        "api_key_env": "DASHSCOPE_API_KEY",
        "api_url": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        "model": "qwen-plus",
    },
    "deepseek": {
        "api_key_env": "DEEPSEEK_API_KEY",
        "api_url": "https://api.deepseek.com/v1/chat/completions",
        "model": "deepseek-chat",
    },
}

# 兼容旧配置：优先使用新配置，fallback 到旧配置
def _detect_provider() -> str:
    """自动检测可用的 AI 提供商"""
    env_provider = os.getenv("AI_PROVIDER", "").lower()
    if env_provider in PROVIDERS:
        return env_provider

    # 自动检测：哪个 Key 可用就用哪个
    for name, config in PROVIDERS.items():
        key = os.getenv(config["api_key_env"], "")
        if key and key != "your-api-key":
            return name

    return "dashscope"  # 默认


class AIClient:
    """统一 AI 客户端"""

    def __init__(self, provider: Optional[str] = None):
        self.provider = provider or _detect_provider()
        config = PROVIDERS[self.provider]

        # API Key: 优先从提供商对应 env 读取，fallback 到旧配置
        self.api_key = (
            os.getenv(config["api_key_env"], "")
            or os.getenv("ANTHROPIC_API_KEY", "")
        )
        # API URL: 优先提供商配置，fallback 到自定义 URL
        self.api_url = os.getenv("AI_API_URL", "") or config["api_url"]
        # Model: 优先 env 配置，fallback 到提供商默认
        self.default_model = os.getenv("AI_MODEL", "") or config["model"]

        self.timeout = int(os.getenv("AI_TIMEOUT", "90"))

        logger.info(f"AIClient initialized: provider={self.provider}, model={self.default_model}")

    def is_configured(self) -> bool:
        return bool(self.api_key) and self.api_key != "your-api-key"

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True
    )
    async def chat(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        timeout: Optional[int] = None,
    ) -> str:
        """
        发送聊天请求，返回 AI 文本响应。

        Args:
            system_prompt: 系统提示词
            user_prompt: 用户消息
            model: 覆盖默认模型
            temperature: 生成温度
            max_tokens: 最大 token 数
            timeout: 请求超时秒数

        Returns:
            AI 响应文本

        Raises:
            ValueError: API 未配置或返回空内容
            httpx.HTTPStatusError: API 返回非成功状态码
        """
        if not self.is_configured():
            raise ValueError(f"AI API 未配置 (provider={self.provider})")

        use_model = model or self.default_model
        use_timeout = timeout or self.timeout

        async with httpx.AsyncClient(timeout=use_timeout, trust_env=False) as client:
            response = await client.post(
                self.api_url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}",
                },
                json={
                    "model": use_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )

            if response.status_code == 429:
                raise Exception("API 限流 (429)")
            if response.status_code == 402:
                raise Exception("API 余额不足 (402)")

            response.raise_for_status()

            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

            if not content:
                raise ValueError("API 返回内容为空")

            return content

    async def chat_json(
        self,
        system_prompt: str,
        user_prompt: str,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        发送聊天请求并解析 JSON 响应。

        自动从 AI 响应中提取 JSON（支持 ```json 代码块）。
        """
        content = await self.chat(system_prompt, user_prompt, **kwargs)
        return self.extract_json(content)

    @staticmethod
    def extract_json(content: str) -> Dict[str, Any]:
        """
        从 AI 响应中提取 JSON。

        支持:
        - ```json ... ``` 代码块
        - ``` ... ``` 代码块
        - 裸 JSON 对象/数组
        """
        # 尝试提取 ```json ... ``` 块
        if "```json" in content:
            match = re.search(r'```json\s*([\s\S]*?)\s*```', content)
            if match:
                try:
                    return json.loads(match.group(1))
                except json.JSONDecodeError:
                    pass

        # 尝试提取 ``` ... ``` 块
        if "```" in content:
            match = re.search(r'```\s*([\s\S]*?)\s*```', content)
            if match:
                try:
                    return json.loads(match.group(1))
                except json.JSONDecodeError:
                    pass

        # 尝试找到 JSON 对象
        match = re.search(r'(\{[\s\S]*\})', content)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # 尝试找到 JSON 数组
        match = re.search(r'(\[[\s\S]*\])', content)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        raise ValueError(f"无法从响应中提取 JSON: {content[:200]}...")


# 全局单例
ai_client = AIClient()
