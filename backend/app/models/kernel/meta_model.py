"""
元模型与对象实例的 Pydantic 模型

字段类型增强 (相比 fisheros 原版):
- ENUM: 枚举类型，限定可选值
- REFERENCE: 引用类型，关联其他元模型的对象
- TEXT: 长文本 (语义别名，本质是 string)
- MONEY: 金额 (语义别名，本质是 float)
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Any
from enum import Enum


class FieldTypeEnum(str, Enum):
    """字段类型枚举"""

    STRING = "string"         # 短文本
    TEXT = "text"             # 长文本 (分析结论、建议)
    INTEGER = "integer"
    FLOAT = "float"
    MONEY = "money"           # 金额 (薪酬、预算)
    BOOLEAN = "boolean"
    DATETIME = "datetime"
    ARRAY = "array"
    OBJECT = "object"
    ENUM = "enum"             # 枚举 — 限定可选值
    REFERENCE = "reference"   # 引用 — 关联其他元模型的对象 _id


class FieldDefinition(BaseModel):
    """字段定义"""

    field_name: str = Field(..., min_length=1, max_length=64, description="字段名称")
    field_type: FieldTypeEnum = Field(..., description="字段类型")
    is_required: bool = Field(default=False, description="是否必填")
    default_value: Any | None = Field(default=None, description="默认值")
    description: str | None = Field(default=None, max_length=256, description="字段描述")

    # ENUM 类型专用
    enum_options: list[str] | None = Field(
        default=None, description="枚举可选值 (仅 ENUM 类型)"
    )

    # REFERENCE 类型专用
    reference_model: str | None = Field(
        default=None, description="引用目标元模型 (仅 REFERENCE 类型)"
    )


class MetaModelCreate(BaseModel):
    """创建元模型"""

    model_key: str = Field(
        ..., min_length=1, max_length=64, pattern=r"^[a-zA-Z_][a-zA-Z0-9_]*$"
    )
    name: str = Field(..., min_length=1, max_length=128)
    fields: list[FieldDefinition] = Field(..., min_length=1)
    description: str | None = Field(default=None, max_length=512)


class MetaModelUpdate(BaseModel):
    """更新元模型"""

    name: str | None = Field(default=None, min_length=1, max_length=128)
    fields: list[FieldDefinition] | None = Field(default=None, min_length=1)
    description: str | None = Field(default=None, max_length=512)


class MetaModelResponse(BaseModel):
    """元模型响应"""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    key: str = Field(alias="_key")
    id: str = Field(alias="_id")
    rev: str = Field(alias="_rev")
    model_key: str
    name: str
    fields: list[dict[str, Any]]
    description: str | None = None


class ObjectCreate(BaseModel):
    """创建对象实例"""

    model_key: str = Field(
        ..., min_length=1, max_length=64, description="关联的元模型标识"
    )
    properties: dict[str, Any] = Field(..., description="对象属性")


class ObjectUpdate(BaseModel):
    """更新对象实例"""

    properties: dict[str, Any] = Field(..., description="更新后的对象属性")


class ObjectResponse(BaseModel):
    """对象响应"""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    key: str = Field(alias="_key")
    id: str = Field(alias="_id")
    rev: str = Field(alias="_rev")
    model_key: str
    properties: dict[str, Any]
