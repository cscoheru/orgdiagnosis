"""
内核数据库管理

demo 模式: 使用 InMemoryDatabase，无需安装 ArangoDB
production 模式: 连接真实 ArangoDB
"""
from typing import Union

from app.kernel.config import kernel_settings

if kernel_settings.is_demo_mode:
    from arango.database import StandardDatabase as _StdDB
    from app.kernel.mock_database import InMemoryDatabase, get_mock_db

    def get_db() -> InMemoryDatabase:
        """获取数据库实例 (demo 模式)"""
        db = get_mock_db()
        # 确保集合存在
        for coll in ["sys_meta_models", "sys_objects", "sys_templates"]:
            db.create_collection(coll)
        db.create_collection("sys_relations", edge=True)
        return db

    def init_kernel_db() -> None:
        """初始化数据库 (demo 模式无需操作)"""
        get_db()  # 触发集合创建

    def close_kernel_db() -> None:
        """关闭连接 (demo 模式无需操作)"""
        pass
else:
    from arango import ArangoClient
    from arango.database import StandardDatabase as _StdDB
    from arango.exceptions import DatabaseCreateError, CollectionCreateError

    class ArangoDBManager:
        """ArangoDB 连接管理器"""

        _client: ArangoClient | None = None
        _db: _StdDB | None = None

        DOCUMENT_COLLECTIONS = ["sys_meta_models", "sys_objects", "sys_templates"]
        EDGE_COLLECTIONS = ["sys_relations"]

        @classmethod
        def get_client(cls) -> ArangoClient:
            if cls._client is None:
                cls._client = ArangoClient(hosts=kernel_settings.arango_url)
            return cls._client

        @classmethod
        def get_database(cls) -> _StdDB:
            if cls._db is None:
                client = cls.get_client()
                cls._db = client.db(
                    name=kernel_settings.ARANGO_DATABASE,
                    username=kernel_settings.ARANGO_USER,
                    password=kernel_settings.ARANGO_PASSWORD,
                )
            return cls._db

        @classmethod
        def init_database(cls) -> None:
            client = cls.get_client()
            sys_db = client.db(
                name="_system",
                username=kernel_settings.ARANGO_USER,
                password=kernel_settings.ARANGO_PASSWORD,
            )
            try:
                sys_db.create_database(kernel_settings.ARANGO_DATABASE)
            except DatabaseCreateError:
                pass

            db = cls.get_database()
            for coll in cls.DOCUMENT_COLLECTIONS:
                try:
                    db.create_collection(coll)
                except CollectionCreateError:
                    pass
            for coll in cls.EDGE_COLLECTIONS:
                try:
                    db.create_collection(coll, edge=True)
                except CollectionCreateError:
                    pass

        @classmethod
        def close(cls) -> None:
            if cls._client is not None:
                cls._client.close()
                cls._client = None
                cls._db = None

    def get_db() -> _StdDB:
        """获取数据库实例 (production 模式)"""
        return ArangoDBManager.get_database()

    def init_kernel_db() -> None:
        """初始化数据库 (production 模式)"""
        ArangoDBManager.init_database()

    def close_kernel_db() -> None:
        """关闭连接 (production 模式)"""
        ArangoDBManager.close()
