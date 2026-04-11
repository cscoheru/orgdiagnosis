"""
对象实例服务 — 对象 CRUD + 元模型校验

增强校验 (相比 fisheros 原版):
- ENUM: 校验值是否在 enum_options 列表中
- REFERENCE: 校验引用目标对象是否存在
- TEXT: 等同 STRING (语义别名，无额外校验)
- MONEY: 等同 FLOAT (语义别名，无额外校验)
"""
from fastapi import HTTPException, status
from typing import Any

from app.repositories.meta_repo import MetaModelRepository
from app.repositories.object_repo import ObjectRepository
from app.models.kernel.meta_model import ObjectCreate, ObjectUpdate, FieldTypeEnum


class ObjectService:
    """对象实例服务"""

    def __init__(self, db: Any):
        self._db = db
        self._meta_repo = MetaModelRepository(db)
        self._object_repo = ObjectRepository(db)

    def _validate_property_type(self, value: Any, field_type: FieldTypeEnum) -> bool:
        """验证属性值类型"""
        type_validators: dict[FieldTypeEnum, type | tuple[type, ...]] = {
            FieldTypeEnum.STRING: str,
            FieldTypeEnum.TEXT: str,       # 长文本，类型等同于 STRING
            FieldTypeEnum.INTEGER: int,
            FieldTypeEnum.FLOAT: (int, float),
            FieldTypeEnum.MONEY: (int, float),  # 金额，类型等同于 FLOAT
            FieldTypeEnum.BOOLEAN: bool,
            FieldTypeEnum.ARRAY: list,
            # OBJECT 接受 dict / list / str — meta-model 用 object 存储任意 JSON
            FieldTypeEnum.OBJECT: (dict, list, str),
            FieldTypeEnum.DATETIME: str,    # ISO 8601 字符串
            FieldTypeEnum.ENUM: str,        # 枚举值是字符串
            FieldTypeEnum.REFERENCE: str,   # 引用 _id 是字符串
        }

        expected_type = type_validators.get(field_type)
        if expected_type is None:
            return True

        return isinstance(value, expected_type)

    def _validate_properties_against_meta(
        self, model_key: str, properties: dict[str, Any]
    ) -> dict[str, Any]:
        """
        根据元模型校验属性

        刚性约束:
        1. 读取对应的 sys_meta_models
        2. 遍历 fields，校验 properties 类型
        3. 缺失 required 字段抛出 HTTP 400
        4. ENUM 字段校验值是否在 enum_options 中
        5. REFERENCE 字段校验目标对象是否存在
        """
        # 1. 读取元模型
        meta_model = self._meta_repo.get_by_model_key(model_key)
        if meta_model is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"元模型 '{model_key}' 不存在",
            )

        # 2. 构建字段定义映射
        field_definitions = {f["field_name"]: f for f in meta_model.get("fields", [])}

        # 3. 检查必填字段
        for field_name, field_def in field_definitions.items():
            if field_def.get("is_required", False):
                if field_name not in properties:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"必填字段 '{field_name}' 缺失",
                    )

        # 4. 验证字段类型
        for field_name, value in properties.items():
            if field_name in field_definitions:
                field_def = field_definitions[field_name]
                field_type = FieldTypeEnum(field_def["field_type"])

                # Skip validation for None values (optional fields)
                if value is None:
                    continue

                if not self._validate_property_type(value, field_type):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"字段 '{field_name}' 类型错误，期望 {field_type.value}",
                    )

                # ENUM 类型额外校验: 值必须在 enum_options 中
                if field_type == FieldTypeEnum.ENUM:
                    enum_options = field_def.get("enum_options", [])
                    if enum_options and value not in enum_options:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"字段 '{field_name}' 值 '{value}' 不在允许列表中: {enum_options}",
                        )

                # REFERENCE 类型额外校验: 目标对象必须存在
                if field_type == FieldTypeEnum.REFERENCE:
                    target_id = value
                    if not target_id.startswith("sys_objects/"):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"字段 '{field_name}' 的引用值必须以 'sys_objects/' 开头",
                        )
                    target_key = target_id.split("/")[1]
                    target_obj = self._object_repo.get_by_key(target_key)
                    if target_obj is None:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"字段 '{field_name}' 引用的对象 '{target_id}' 不存在",
                        )

        # 5. 白名单过滤 + 填充默认值
        validated_properties = {}
        for field_name, field_def in field_definitions.items():
            if field_name in properties:
                validated_properties[field_name] = properties[field_name]
            elif field_def.get("default_value") is not None:
                validated_properties[field_name] = field_def["default_value"]

        return validated_properties

    def create_object(self, data: ObjectCreate) -> dict[str, Any]:
        """创建对象实例"""
        validated_properties = self._validate_properties_against_meta(
            data.model_key, data.properties
        )

        doc = {
            "model_key": data.model_key,
            "properties": validated_properties,
        }

        return self._object_repo.create(doc)

    def update_object(self, key: str, data: ObjectUpdate) -> dict[str, Any]:
        """更新对象实例"""
        existing = self._object_repo.get_by_key(key)
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"对象 '{key}' 不存在",
            )

        validated_properties = self._validate_properties_against_meta(
            existing["model_key"], data.properties
        )

        return self._object_repo.update(key, {"properties": validated_properties})

    def get_object(self, key: str) -> dict[str, Any] | None:
        """获取对象"""
        return self._object_repo.get_by_key(key)

    def list_objects(
        self, model_key: str | None = None, limit: int = 100, offset: int = 0
    ) -> list[dict[str, Any]]:
        """获取对象列表"""
        if model_key:
            return self._object_repo.list_by_model_key(model_key, limit, offset)
        return self._object_repo.list_all(limit, offset)

    def delete_object(self, key: str) -> bool:
        """删除对象"""
        existing = self._object_repo.get_by_key(key)
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"对象 '{key}' 不存在",
            )
        return self._object_repo.delete(key)
