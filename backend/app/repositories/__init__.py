"""
内核 Repository 层 — 数据库操作

支持双模式: ArangoDB (production) / InMemoryDatabase (demo)
"""
from app.repositories.meta_repo import MetaModelRepository
from app.repositories.object_repo import ObjectRepository
from app.repositories.relation_repo import RelationRepository

__all__ = ["MetaModelRepository", "ObjectRepository", "RelationRepository"]
