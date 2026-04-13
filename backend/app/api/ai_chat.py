"""
AI Chat 代理 API

前端战略解码组件调用此端点，代理到后端 AIClient (DashScope/DeepSeek)。
接收 { messages }，返回 { content }。
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict

from app.services.ai_client import AIClient

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


class ChatResponse(BaseModel):
    content: str


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(request: ChatRequest):
    """代理 AI 聊天请求到后端 AIClient"""
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages array required")

    client = AIClient()

    if not client.is_configured():
        raise HTTPException(
            status_code=503,
            detail="AI API 未配置，请检查后端环境变量 (DASHSCOPE_API_KEY / DEEPSEEK_API_KEY)"
        )

    try:
        messages = [msg.model_dump() for msg in request.messages]
        content = await client.chat(
            system_prompt="",
            user_prompt="",
            messages=messages,
            temperature=0.7,
            max_tokens=2000,
        )
        return ChatResponse(content=content)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 调用失败: {str(e)}")
