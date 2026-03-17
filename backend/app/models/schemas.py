"""
Pydantic 数据模型
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class ConfidenceLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# ==================== L3 项 ====================
class L3Item(BaseModel):
    score: int = Field(..., ge=0, le=100)
    evidence: str = ""
    confidence: ConfidenceLevel = ConfidenceLevel.MEDIUM


# ==================== L2 分类 ====================
class L2Category(BaseModel):
    score: int = Field(default=0, ge=0, le=100)
    label: str = ""
    L3_items: Dict[str, L3Item] = Field(default_factory=dict)


# ==================== L1 维度 ====================
class L1Dimension(BaseModel):
    score: int = Field(default=0, ge=0, le=100)
    label: str = ""
    description: str = ""
    L2_categories: Dict[str, L2Category] = Field(default_factory=dict)


# ==================== 五维数据 ====================
class FiveDimensionsData(BaseModel):
    strategy: L1Dimension = Field(default_factory=L1Dimension)
    structure: L1Dimension = Field(default_factory=L1Dimension)
    performance: L1Dimension = Field(default_factory=L1Dimension)
    compensation: L1Dimension = Field(default_factory=L1Dimension)
    talent: L1Dimension = Field(default_factory=L1Dimension)
    overall_score: int = Field(default=0, ge=0, le=100)
    summary: str = ""


# ==================== 请求模型 ====================
class UploadResponse(BaseModel):
    success: bool
    text: str = ""
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=50, description="待分析文本")


class AnalyzeResponse(BaseModel):
    success: bool
    data: Optional[FiveDimensionsData] = None
    error: Optional[str] = None
    processing_time: Optional[int] = None


class DiagnosisCreate(BaseModel):
    raw_input: str
    data: FiveDimensionsData


class DiagnosisResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: datetime = Field(default_factory=datetime.now)


# ==================== 历史记录 ====================
class UploadResponse(BaseModel):
    """文件上传响应"""
    success: bool
    text: str = ""
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class DiagnosisListItem(BaseModel):
    id: str
    created_at: datetime
    overall_score: int
    preview: str  # 前100字符

    class Config:
        from_attributes = True
