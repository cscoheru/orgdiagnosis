"""
Knowledge Base Store

SQLite-based storage for documents, pages, projects, and classifications.
No vectors needed - uses full-text search via PostgreSQL-style FTS.
"""

import sqlite3
import json
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime
from loguru import logger


class KnowledgeBaseStore:
    """
    SQLite 存储管理器

    表结构:
    - projects: 项目/客户信息
    - documents: 文档元数据
    - document_pages: 页面内容 (全文索引)
    - document_classifications: 五维分类结果
    - taxonomy_dimensions: 五维分类定义
    """

    def __init__(self, db_path: str = "./data/knowledge.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        """获取数据库连接"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        # 启用外键约束
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self):
        """初始化数据库表"""
        conn = self._get_conn()

        # Note: projects 表现在由 unified_store.py 管理
        # 这里不再创建独立的 projects 表

        # 文档表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                file_type TEXT,
                file_path TEXT,
                file_size INTEGER,
                project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
                title TEXT,
                author TEXT,
                document_date TEXT,
                page_count INTEGER,
                source_folder TEXT,
                relative_path TEXT,
                tags TEXT,
                metadata TEXT,
                uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 页面表 (含全文索引虚拟表)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS document_pages (
                id TEXT PRIMARY KEY,
                document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
                page_number INTEGER NOT NULL,
                content TEXT NOT NULL,
                sections TEXT,
                thumbnail_path TEXT,
                UNIQUE(document_id, page_number)
            )
        """)

        # 全文索引虚拟表
        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS document_pages_fts USING fts5(
                content,
                content='document_pages',
                content_rowid='rowid',
                tokenize='unicode61'
            )
        """)

        # 五维分类表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS document_classifications (
                id TEXT PRIMARY KEY,
                document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
                dimension_l1 TEXT,
                dimension_l2 TEXT,
                dimension_l3 TEXT,
                confidence REAL,
                classification_method TEXT,
                evidence TEXT,
                classified_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(document_id)
            )
        """)

        # 五维分类定义表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS taxonomy_dimensions (
                id TEXT PRIMARY KEY,
                level INTEGER NOT NULL,
                parent_id TEXT REFERENCES taxonomy_dimensions(id),
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                keywords TEXT,
                sort_order INTEGER
            )
        """)

        # 创建索引
        conn.execute("CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_pages_document ON document_pages(document_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_doc_class_l1 ON document_classifications(dimension_l1)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_doc_class_l2 ON document_classifications(dimension_l2)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_doc_class_l3 ON document_classifications(dimension_l3)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_taxonomy_parent ON taxonomy_dimensions(parent_id)")

        conn.commit()
        conn.close()

        logger.info(f"Knowledge base store initialized: {self.db_path}")

    # ==================== 项目管理 ====================

    def create_project(self, project: Dict[str, Any]) -> str:
        """创建项目"""
        import uuid
        project_id = project.get("id") or str(uuid.uuid4())

        conn = self._get_conn()
        conn.execute("""
            INSERT INTO projects (id, name, code, description, client_name, client_industry,
                                  project_type, status, start_date, end_date, tags, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            project_id,
            project.get("name"),
            project.get("code"),
            project.get("description"),
            project.get("client_name"),
            project.get("client_industry"),
            project.get("project_type", "consulting"),
            project.get("status", "active"),
            project.get("start_date"),
            project.get("end_date"),
            json.dumps(project.get("tags", [])) if project.get("tags") else None,
            json.dumps(project.get("metadata", {})) if project.get("metadata") else None,
        ))
        conn.commit()
        conn.close()

        return project_id

    def get_project(self, project_id: str) -> Optional[Dict]:
        """获取项目"""
        conn = self._get_conn()
        cursor = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        row = cursor.fetchone()
        conn.close()

        if row:
            return self._row_to_dict(row)
        return None

    def list_projects(self, status: str = None, limit: int = 100) -> List[Dict]:
        """列出项目"""
        conn = self._get_conn()

        if status:
            cursor = conn.execute(
                "SELECT * FROM projects WHERE status = ? ORDER BY updated_at DESC LIMIT ?",
                (status, limit)
            )
        else:
            cursor = conn.execute(
                "SELECT * FROM projects ORDER BY updated_at DESC LIMIT ?",
                (limit,)
            )

        projects = [self._row_to_dict(row) for row in cursor.fetchall()]

        # 获取每个项目的文档数量
        for project in projects:
            cursor = conn.execute(
                "SELECT COUNT(*) FROM documents WHERE project_id = ?",
                (project["id"],)
            )
            project["document_count"] = cursor.fetchone()[0]

        conn.close()
        return projects

    def update_project(self, project_id: str, updates: Dict[str, Any]) -> bool:
        """更新项目"""
        if not updates:
            return True

        set_clauses = []
        values = []

        for key, value in updates.items():
            if key in ("id", "created_at"):
                continue
            if key in ("tags", "metadata"):
                value = json.dumps(value) if value else None
            set_clauses.append(f"{key} = ?")
            values.append(value)

        set_clauses.append("updated_at = CURRENT_TIMESTAMP")
        values.append(project_id)

        conn = self._get_conn()
        conn.execute(
            f"UPDATE projects SET {', '.join(set_clauses)} WHERE id = ?",
            values
        )
        conn.commit()
        conn.close()

        return True

    # ==================== 文档管理 ====================

    def create_document(self, document: Dict[str, Any]) -> str:
        """创建文档"""
        import uuid
        doc_id = document.get("id") or str(uuid.uuid4())

        conn = self._get_conn()
        conn.execute("""
            INSERT INTO documents (id, filename, file_type, file_path, file_size, project_id,
                                   title, author, document_date, page_count, source_folder,
                                   relative_path, tags, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            doc_id,
            document.get("filename"),
            document.get("file_type"),
            document.get("file_path"),
            document.get("file_size"),
            document.get("project_id"),
            document.get("title"),
            document.get("author"),
            document.get("document_date"),
            document.get("page_count"),
            document.get("source_folder"),
            document.get("relative_path"),
            json.dumps(document.get("tags", [])) if document.get("tags") else None,
            json.dumps(document.get("metadata", {})) if document.get("metadata") else None,
        ))
        conn.commit()
        conn.close()

        return doc_id

    def get_document(self, doc_id: str) -> Optional[Dict]:
        """获取文档"""
        conn = self._get_conn()
        cursor = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
        row = cursor.fetchone()
        conn.close()

        if row:
            return self._row_to_dict(row)
        return None

    def list_documents(
        self,
        project_id: str = None,
        dimension_l1: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict]:
        """列出文档 (支持项目和维度筛选)"""
        conn = self._get_conn()

        query = """
            SELECT d.*, dc.dimension_l1, dc.dimension_l2, dc.dimension_l3, dc.confidence
            FROM documents d
            LEFT JOIN document_classifications dc ON d.id = dc.document_id
            WHERE 1=1
        """
        params = []

        if project_id:
            query += " AND d.project_id = ?"
            params.append(project_id)

        if dimension_l1:
            query += " AND dc.dimension_l1 = ?"
            params.append(dimension_l1)

        query += " ORDER BY d.uploaded_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor = conn.execute(query, params)
        documents = [self._row_to_dict(row) for row in cursor.fetchall()]
        conn.close()

        return documents

    def delete_document(self, doc_id: str) -> bool:
        """删除文档 (级联删除页面和分类)"""
        conn = self._get_conn()
        conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.commit()
        conn.close()
        return True

    # ==================== 页面管理 ====================

    def create_page(self, page: Dict[str, Any]) -> str:
        """创建页面"""
        import uuid
        page_id = page.get("id") or str(uuid.uuid4())

        conn = self._get_conn()
        conn.execute("""
            INSERT INTO document_pages (id, document_id, page_number, content, sections, thumbnail_path)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            page_id,
            page.get("document_id"),
            page.get("page_number"),
            page.get("content"),
            json.dumps(page.get("sections", [])) if page.get("sections") else None,
            page.get("thumbnail_path"),
        ))

        # 更新全文索引
        conn.execute("""
            INSERT INTO document_pages_fts (rowid, content)
            SELECT rowid, content FROM document_pages WHERE id = ?
        """, (page_id,))

        conn.commit()
        conn.close()

        return page_id

    def get_pages(self, document_id: str) -> List[Dict]:
        """获取文档的所有页面"""
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT * FROM document_pages WHERE document_id = ? ORDER BY page_number",
            (document_id,)
        )
        pages = [self._row_to_dict(row) for row in cursor.fetchall()]
        conn.close()
        return pages

    def get_page(self, document_id: str, page_number: int) -> Optional[Dict]:
        """获取单个页面"""
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT * FROM document_pages WHERE document_id = ? AND page_number = ?",
            (document_id, page_number)
        )
        row = cursor.fetchone()
        conn.close()

        if row:
            return self._row_to_dict(row)
        return None

    # ==================== 搜索 ====================

    def search(
        self,
        query: str,
        project_id: str = None,
        dimension_l1: str = None,
        dimension_l2: str = None,
        dimension_l3: str = None,
        limit: int = 20
    ) -> List[Dict]:
        """
        全文搜索

        返回匹配的页面，包含文档和分类信息
        """
        conn = self._get_conn()

        # 构建基础查询 - 使用 FTS5 的 highlight 函数高亮匹配文本
        sql = """
            SELECT
                dp.id as page_id,
                dp.document_id,
                dp.page_number,
                dp.content,
                highlight(document_pages_fts, 0, '【', '】') as highlighted_content,
                d.filename,
                d.title as document_title,
                d.project_id,
                p.name as project_name,
                dc.dimension_l1,
                dc.dimension_l2,
                dc.dimension_l3,
                dc.confidence,
                document_pages_fts.rank
            FROM document_pages_fts
            JOIN document_pages dp ON document_pages_fts.rowid = dp.rowid
            JOIN documents d ON dp.document_id = d.id
            LEFT JOIN projects p ON d.project_id = p.id
            LEFT JOIN document_classifications dc ON d.id = dc.document_id
            WHERE document_pages_fts MATCH ?
        """

        params = [query]

        if project_id:
            sql += " AND d.project_id = ?"
            params.append(project_id)

        if dimension_l1:
            sql += " AND dc.dimension_l1 = ?"
            params.append(dimension_l1)

        if dimension_l2:
            sql += " AND dc.dimension_l2 = ?"
            params.append(dimension_l2)

        if dimension_l3:
            sql += " AND dc.dimension_l3 = ?"
            params.append(dimension_l3)

        sql += " ORDER BY rank LIMIT ?"
        params.append(limit)

        cursor = conn.execute(sql, params)
        results = [self._row_to_dict(row) for row in cursor.fetchall()]
        conn.close()

        return results

    def search_by_dimension(
        self,
        dimension_l1: str = None,
        dimension_l2: str = None,
        dimension_l3: str = None,
        limit: int = 50
    ) -> List[Dict]:
        """按维度筛选文档"""
        conn = self._get_conn()

        sql = """
            SELECT
                d.*,
                dc.dimension_l1,
                dc.dimension_l2,
                dc.dimension_l3,
                dc.confidence,
                dc.evidence
            FROM documents d
            JOIN document_classifications dc ON d.id = dc.document_id
            WHERE 1=1
        """
        params = []

        if dimension_l1:
            sql += " AND dc.dimension_l1 = ?"
            params.append(dimension_l1)

        if dimension_l2:
            sql += " AND dc.dimension_l2 = ?"
            params.append(dimension_l2)

        if dimension_l3:
            sql += " AND dc.dimension_l3 = ?"
            params.append(dimension_l3)

        sql += " ORDER BY dc.confidence DESC LIMIT ?"
        params.append(limit)

        cursor = conn.execute(sql, params)
        results = [self._row_to_dict(row) for row in cursor.fetchall()]
        conn.close()

        return results

    # ==================== 分类管理 ====================

    def save_classification(self, classification: Dict[str, Any]) -> str:
        """保存文档分类"""
        import uuid
        class_id = classification.get("id") or str(uuid.uuid4())

        conn = self._get_conn()
        conn.execute("""
            INSERT OR REPLACE INTO document_classifications
            (id, document_id, dimension_l1, dimension_l2, dimension_l3,
             confidence, classification_method, evidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            class_id,
            classification.get("document_id"),
            classification.get("dimension_l1"),
            classification.get("dimension_l2"),
            classification.get("dimension_l3"),
            classification.get("confidence"),
            classification.get("classification_method"),
            classification.get("evidence"),
        ))
        conn.commit()
        conn.close()

        return class_id

    def get_classification(self, document_id: str) -> Optional[Dict]:
        """获取文档分类"""
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT * FROM document_classifications WHERE document_id = ?",
            (document_id,)
        )
        row = cursor.fetchone()
        conn.close()

        if row:
            return self._row_to_dict(row)
        return None

    # ==================== 统计 ====================

    def get_stats(self) -> Dict[str, Any]:
        """获取知识库统计"""
        conn = self._get_conn()

        stats = {}

        # 项目数
        cursor = conn.execute("SELECT COUNT(*) FROM projects")
        stats["total_projects"] = cursor.fetchone()[0]

        # 文档数
        cursor = conn.execute("SELECT COUNT(*) FROM documents")
        stats["total_documents"] = cursor.fetchone()[0]

        # 页面数
        cursor = conn.execute("SELECT COUNT(*) FROM document_pages")
        stats["total_pages"] = cursor.fetchone()[0]

        # 按维度分布
        cursor = conn.execute("""
            SELECT dimension_l1, COUNT(*) as count
            FROM document_classifications
            GROUP BY dimension_l1
        """)
        stats["by_dimension"] = {row["dimension_l1"]: row["count"] for row in cursor.fetchall()}

        conn.close()
        return stats

    # ==================== 辅助方法 ====================

    def _row_to_dict(self, row: sqlite3.Row) -> Dict:
        """将行转换为字典"""
        result = dict(row)

        # 解析 JSON 字段
        for key in ("tags", "metadata", "sections"):
            if key in result and result[key]:
                try:
                    result[key] = json.loads(result[key])
                except:
                    pass

        return result


# 全局实例
_store: Optional[KnowledgeBaseStore] = None

def get_knowledge_store() -> KnowledgeBaseStore:
    """获取知识库存储实例"""
    global _store
    if _store is None:
        _store = KnowledgeBaseStore()
    return _store
