"""
统一 AI 客户端

支持多个 OpenAI 兼容 API 提供商 (DashScope/通义千问, DeepSeek, 等)。
通过 AI_PROVIDER 环境变量切换提供商。

内部使用 langchain_openai.ChatOpenAI，确保所有 LLM 调用
可被 LangSmith 自动追踪 (LANGCHAIN_TRACING_V2=true)。
"""
import os
import json
import re
import logging
from typing import Dict, Any, Optional, List

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_core.callbacks import Callbacks

# 确保 dotenv 已加载（config.py 负责加载，import 触发）
import app.config  # noqa: F401

logger = logging.getLogger(__name__)

# 提供商配置
PROVIDERS = {
    "dashscope": {
        "api_key_env": "DASHSCOPE_API_KEY",
        "api_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-plus",
    },
    "deepseek": {
        "api_key_env": "DEEPSEEK_API_KEY",
        "api_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
    },
}


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
    """统一 AI 客户端

    内部使用 ChatOpenAI 实例，所有调用自动被 LangSmith 追踪。
    公开 API 保持不变: chat(), chat_json(), is_configured()。
    """

    def __init__(self, provider: Optional[str] = None):
        self.provider = provider or _detect_provider()
        config = PROVIDERS[self.provider]

        # API Key: 优先从提供商对应 env 读取
        self.api_key = (
            os.getenv(config["api_key_env"], "")
            or os.getenv("ANTHROPIC_API_KEY", "")
        )
        # API URL (base_url): 优先提供商配置，fallback 到自定义 URL
        base_url = os.getenv("AI_API_URL", "") or config["api_url"]
        # Model: 优先 env 配置，fallback 到提供商默认
        self.default_model = os.getenv("AI_MODEL", "") or config["model"]

        self.timeout = int(os.getenv("AI_TIMEOUT", "90"))

        # 构建 ChatOpenAI 实例
        self._llm: Optional[ChatOpenAI] = None
        self._base_url = base_url

        logger.info(
            f"AIClient initialized: provider={self.provider}, "
            f"model={self.default_model}, base_url={base_url}"
        )

    @property
    def llm(self) -> ChatOpenAI:
        """懒加载 ChatOpenAI 实例 (首次调用时创建)"""
        if self._llm is None:
            self._llm = ChatOpenAI(
                model=self.default_model,
                api_key=self.api_key,
                base_url=self._base_url,
                timeout=self.timeout,
                max_tokens=4096,
                temperature=0.3,
            )
        return self._llm

    def is_configured(self) -> bool:
        return bool(self.api_key) and self.api_key != "your-api-key"

    async def chat(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        messages: Optional[List[Dict[str, str]]] = None,
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        timeout: Optional[int] = None,
        callbacks: Optional[Callbacks] = None,
    ) -> str:
        """
        发送聊天请求，返回 AI 文本响应。

        Args:
            system_prompt: 系统提示词
            user_prompt: 用户消息
            messages: 完整消息列表（含 system），如提供则覆盖 system_prompt + user_prompt
            model: 覆盖默认模型
            temperature: 生成温度
            max_tokens: 最大 token 数
            timeout: 请求超时秒数
            callbacks: LangChain callbacks (LangSmith 自动注入)

        Returns:
            AI 响应文本

        Raises:
            ValueError: API 未配置或返回空内容
        """
        if not self.is_configured():
            raise ValueError(f"AI API 未配置 (provider={self.provider})")

        # 构建消息列表
        if messages:
            lc_messages = []
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "system":
                    lc_messages.append(SystemMessage(content=content))
                elif role == "assistant":
                    lc_messages.append(AIMessage(content=content))
                else:
                    lc_messages.append(HumanMessage(content=content))
        else:
            lc_messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]

        # 按需覆盖参数
        use_model = model or self.default_model
        llm = self.llm
        if model and model != self.default_model:
            llm = ChatOpenAI(
                model=use_model,
                api_key=self.api_key,
                base_url=self._base_url,
                timeout=timeout or self.timeout,
                max_tokens=max_tokens,
                temperature=temperature,
            )

        config = {}
        if callbacks:
            config["callbacks"] = callbacks
        response = await llm.ainvoke(lc_messages, config=config if config else None)
        content = response.content if hasattr(response, "content") else str(response)

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
