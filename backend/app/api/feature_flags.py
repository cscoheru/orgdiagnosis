"""
功能开关管理 API
"""
from fastapi import APIRouter, Query

from app.services.feature_flags import feature_flags

router = APIRouter(prefix="/feature-flags", tags=["功能开关"])


@router.get("/list", summary="列出所有功能开关及其状态")
def list_feature_flags(
    project_id: str | None = Query(default=None),
):
    """获取所有 flag 的当前有效值"""
    return {
        "flags": feature_flags.get_all_flags(project_id),
        "defaults": feature_flags.list_defaults(),
    }


@router.get("/check/{flag_name}", summary="检查单个功能开关")
def check_feature_flag(
    flag_name: str,
    project_id: str | None = Query(default=None),
):
    """检查指定 flag 是否启用"""
    return {
        "flag": flag_name,
        "enabled": feature_flags.is_enabled(flag_name, project_id),
    }


@router.post("/override", summary="设置项目级功能覆盖")
def set_project_override(
    project_id: str,
    flag: str,
    enabled: bool = True,
):
    """运行时设置项目级 flag 覆盖（不持久化到数据库）"""
    feature_flags.set_project_override(project_id, flag, enabled)
    return {
        "project_id": project_id,
        "flag": flag,
        "enabled": enabled,
        "effective": feature_flags.is_enabled(flag, project_id),
    }
