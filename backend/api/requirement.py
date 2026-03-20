"""
Client Requirement API Endpoints

FastAPI endpoints for managing client requirements.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from loguru import logger

router = APIRouter(prefix="/requirement", tags=["requirement"])


class ValidateRequirementRequest(BaseModel):
    """验证需求请求"""
    requirement: Dict[str, Any]


class ValidateRequirementResponse(BaseModel):
    """验证需求响应"""
    valid: bool
    errors: list = []
    normalized_data: Optional[Dict[str, Any]] = None


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
