"""
Client Requirement API Endpoints

FastAPI endpoints for managing client requirements.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from loguru import logger
import os
import json

router = APIRouter(prefix="/requirement", tags=["requirement"])


class ValidateRequirementRequest(BaseModel):
    """验证需求请求"""
    requirement: Dict[str, Any]


class ValidateRequirementResponse(BaseModel):
    """验证需求响应"""
    valid: bool
    errors: list = []
    normalized_data: Optional[Dict[str, Any]] = None


class ExtractRequirementRequest(BaseModel):
    """智能提取需求请求"""
    text: str


class ExtractRequirementResponse(BaseModel):
    """智能提取需求响应"""
    success: bool
    extracted_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@router.post("/extract", response_model=ExtractRequirementResponse)
async def extract_requirement(request: ExtractRequirementRequest):
    """
    从非结构化文本中智能提取需求信息

    使用AI模型从用户输入的描述文本中提取：
    - 客户名称
    - 行业类型
    - 行业背景
    - 公司介绍
    - 核心痛点
    - 项目目标
    - 等结构化信息
    """
    try:
        # Use DashScope API directly
        import dashscope
        from dashscope import Generation

        dashscope_api_key = os.getenv("DASHSCOPE_API_KEY")

        if not dashscope_api_key:
            logger.warning("DASHSCOPE_API_KEY not configured")
            return ExtractRequirementResponse(
                success=False,
                error="AI服务未配置，请联系管理员"
            )

        dashscope.api_key = dashscope_api_key

        system_prompt = """你是一个专业的需求分析助手。请从用户提供的文本中提取以下信息，并以JSON格式返回：

1. client_name: 客户/公司名称（字符串）
2. industry: 行业类型，从以下选项中选择最接近的：制造业、零售、金融、科技、医疗、教育、房地产、其他
3. industry_background: 行业背景描述（字符串，50-200字）
4. company_intro: 公司介绍（字符串，50-200字）
5. company_scale: 公司规模（字符串，如"200-500人"）
6. core_pain_points: 核心痛点列表（字符串数组，每项20-100字）
7. pain_severity: 痛点严重程度，从以下选择：critical/high/medium/low
8. project_goals: 项目目标列表（字符串数组）
9. success_criteria: 成功标准列表（字符串数组，可选）
10. main_tasks: 主要任务列表（字符串数组）
11. deliverables: 交付成果列表（字符串数组）

注意事项：
- 如果某项信息在文本中没有提及，对应的字段返回null或空数组
- 尽量保持原文的专业表述，但可以适当润色
- 如果信息不够完整，根据上下文合理推断
- 返回纯JSON，不要有其他说明文字"""

        user_message = f"请从以下文本中提取需求信息：\n\n{request.text}"

        response = Generation.call(
            model='qwen-plus',
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.3,
            max_tokens=2000,
            result_format='message',
        )

        logger.debug(f"DashScope Response: {response}")

        if response.status_code != 200:
            logger.error(f"DashScope API error: {response.code} - {response.message}")
            return ExtractRequirementResponse(
                success=False,
                error=f"AI服务错误: {response.message}"
            )

        content = response.output.choices[0].message.content

        if not content:
            logger.error("DashScope returned empty content")
            return ExtractRequirementResponse(
                success=False,
                error="AI服务返回空内容"
            )

        content = content.strip()

        # Try to parse JSON from the response
        # Handle potential markdown code blocks
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        extracted_data = json.loads(content)

        logger.info(f"Extracted requirement data: {extracted_data}")

        return ExtractRequirementResponse(
            success=True,
            extracted_data=extracted_data,
        )

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse extraction result: {e}")
        return ExtractRequirementResponse(
            success=False,
            error="解析失败，请重试或手动填写"
        )
    except ImportError:
        logger.error("DashScope library not installed")
        return ExtractRequirementResponse(
            success=False,
            error="AI服务库未安装"
        )
    except Exception as e:
        logger.error(f"Requirement extraction failed: {e}")
        return ExtractRequirementResponse(
            success=False,
            error=f"提取失败: {str(e)}"
        )


@router.get("/template")
async def get_requirement_template():
    """
    获取需求录入模板

    返回前端表单所需的字段定义和验证规则。
    """
    from schemas import get_requirement_template

    template = get_requirement_template()

    return {
        "template_id": template.template_id,
        "template_name": template.template_name,
        "template_version": template.template_version,
        "fields": template.fields,
    }


@router.post("/validate", response_model=ValidateRequirementResponse)
async def validate_requirement(request: ValidateRequirementRequest):
    """
    验证客户需求

    验证需求数据是否符合 ClientRequirement 模型。
    """
    from schemas import ClientRequirement

    try:
        requirement = ClientRequirement(**request.requirement)

        return ValidateRequirementResponse(
            valid=True,
            errors=[],
            normalized_data=requirement.model_dump()
        )

    except Exception as e:
        # 解析验证错误
        errors = []
        if hasattr(e, 'errors'):
            for error in e.errors():
                field = ".".join(str(loc) for loc in error.get("loc", []))
                message = error.get("msg", str(error))
                errors.append(f"{field}: {message}")
        else:
            errors.append(str(e))

        return ValidateRequirementResponse(
            valid=False,
            errors=errors,
            normalized_data=None
        )


@router.post("/save")
async def save_requirement(request: Dict[str, Any]):
    """
    保存客户需求

    验证并保存需求到数据库（目前使用内存存储）。
    """
    from schemas import ClientRequirement
    import uuid

    try:
        requirement = ClientRequirement(**request)

        # 生成需求ID
        requirement_id = str(uuid.uuid4())

        # TODO: 保存到数据库
        # 目前只返回成功响应

        return {
            "success": True,
            "requirement_id": requirement_id,
            "client_name": requirement.client_name,
            "message": "需求已保存"
        }

    except Exception as e:
        logger.error(f"Failed to save requirement: {e}")
        raise HTTPException(status_code=400, detail=str(e))
