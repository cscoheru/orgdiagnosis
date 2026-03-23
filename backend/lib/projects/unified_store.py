"""
Unified Project Store - 全局统一项目管理

所有模块（诊断、知识库、报告）共享同一个项目管理系统

Project → Diagnosis → Knowledge → Report
"""

import sqlite3
import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import contextmanager
from pathlib import Path
from loguru import logger

# 统一的数据库路径
DB_PATH = Path(__file__).parent.parent.parent / "data" / "org_diagnosis.db"


@contextmanager
def get_db():
    """获取数据库连接"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


def init_unified_db():
    """初始化统一数据库"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    with get_db() as conn:
        cursor = conn.cursor()

        # ============================================================
        # 核心项目表 - 统一的项目管理
        # ============================================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                code TEXT,                          -- 项目代码
                description TEXT,

                -- 客户信息
                client_name TEXT,
                client_industry TEXT,
                client_id TEXT,

                -- 项目状态
                status TEXT DEFAULT 'draft',         -- draft/active/completed/archived
                current_step TEXT DEFAULT 'diagnosis', -- diagnosis/knowledge/outline/slides/export

                -- 诊断相关
                diagnosis_session_id TEXT,           -- 关联的诊断会话
                diagnosis_completed_at TEXT,

                -- 知识库相关
                knowledge_project_id TEXT,           -- 关联的知识库项目

                -- 报告相关
                report_type TEXT,
                slide_count INTEGER,
                template_style TEXT,

                -- 项目时间线
                start_date TEXT,
                end_date TEXT,

                -- 元数据
                tags TEXT,                            -- JSON array
                metadata TEXT,                         -- JSON object
                created_by TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ============================================================
        # 文件夹表 - 支持任意层级
        # ============================================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_folders_project ON folders(project_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id)")

        # ============================================================
        # 文件表 - 存储文件元数据
        # ============================================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
                filename TEXT NOT NULL,
                file_type TEXT,
                minio_path TEXT NOT NULL,
                size INTEGER,
                metadata TEXT,
                source_type TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id)")

        # FTS5 全文搜索
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS files_search USING fts5(
                file_id,
                filename,
                content,
                tokenize='unicode61'
            )
        """)

        # ============================================================
        # 诊断会话表 - 链接到项目
        # ============================================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS diagnosis_sessions (
                id TEXT PRIMARY KEY,
                project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,

                -- 诊断结果
                strategy_score REAL,
                organization_score REAL,
                performance_score REAL,
                compensation_score REAL,
                talent_score REAL,

                -- 诊断详情
                pain_points TEXT,                     -- JSON array
                recommendations TEXT,                -- JSON array
                raw_response TEXT,

                -- 元数据
                diagnosis_type TEXT,
                status TEXT DEFAULT 'completed',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ============================================================
        # 知识库 - 文档表
        # ============================================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_documents (
                id TEXT PRIMARY KEY,
                project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,

                filename TEXT NOT NULL,
                file_type TEXT,
                file_path TEXT,
                file_size INTEGER,
                title TEXT,
                author TEXT,
                page_count INTEGER,

                -- 分类信息
                dimension_l1 TEXT,                    -- 五维分类 L1
                dimension_l2 TEXT,                    -- 五维分类 L2
                dimension_l3 TEXT,                    -- 五维分类 L3
                classification_confidence REAL,

                -- 元数据
                tags TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ============================================================
        # 知识库 - 文档页面表 (全文搜索)
        # ============================================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_document_pages (
                id TEXT PRIMARY KEY,
                document_id TEXT REFERENCES knowledge_documents(id) ON DELETE CASCADE,
                project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,

                page_number INTEGER NOT NULL,
                content TEXT NOT NULL,

                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 创建全文搜索索引
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_pages_fts
            USING fts5(content, project_id, document_id)
        """)

        # ============================================================
        # 项目需求表 - 需求录入步骤
        # ============================================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_requirements (
                id TEXT PRIMARY KEY,
                project_id TEXT UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

                form_step INTEGER DEFAULT 1,
                form_completed BOOLEAN DEFAULT FALSE,

                -- Step 1: 基本信息
                client_name TEXT,
                industry TEXT,
                company_stage TEXT,
                employee_count INTEGER,

                -- Step 2: 诊断背景
                diagnosis_session_id TEXT,
                pain_points TEXT,                 -- JSON array
                goals TEXT,                       -- JSON array
                timeline TEXT,

                -- Step 3: 交付物
                report_type TEXT,
                slide_count INTEGER,
                focus_areas TEXT,                 -- JSON array
                reference_materials TEXT,         -- JSON array

                -- Step 4: 风格偏好
                tone TEXT,
                language TEXT,
                template_style TEXT,
                special_requirements TEXT,

                last_saved_at TEXT,
                last_saved_field TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ============================================================
        # 项目大纲表
        # ============================================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_outlines (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

                sections TEXT NOT NULL,            -- JSON array of sections
                version INTEGER DEFAULT 1,

                is_confirmed BOOLEAN DEFAULT FALSE,
                confirmed_at TEXT,
                confirmed_by TEXT,

                generation_model TEXT,
                generation_tokens INTEGER,
                rag_sources TEXT,                 -- JSON array

                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ============================================================
        # 项目幻灯片表
        # ============================================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_slides (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

                slide_index INTEGER NOT NULL,
                section_id TEXT,

                title TEXT NOT NULL,
                subtitle TEXT,
                key_message TEXT,
                content TEXT,                     -- JSON object
                layout_type TEXT,
                model_id TEXT,
                model_params TEXT,               -- JSON object

                status TEXT DEFAULT 'draft',     -- draft/generated/edited/approved

                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

                UNIQUE(project_id, slide_index)
            )
        """)

        # ============================================================
        # 项目导出表
        # ============================================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_exports (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

                format TEXT DEFAULT 'pptx',
                file_path TEXT,
                file_size_kb INTEGER,
                download_url TEXT,
                slide_count INTEGER,
                generation_time_ms INTEGER,

                status TEXT DEFAULT 'pending',    -- pending/processing/completed/failed
                error_message TEXT,

                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                completed_at TEXT,
                created_by TEXT
            )
        """)

        # ============================================================
        # 五维分类定义表
        # ============================================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS taxonomy_dimensions (
                id TEXT PRIMARY KEY,
                level INTEGER NOT NULL,           -- 1, 2, or 3
                code TEXT NOT NULL,               -- e.g., "strategy", "strategy.mission"
                parent_code TEXT,
                name TEXT NOT NULL,
                description TEXT,
                keywords TEXT,                    -- JSON array
                examples TEXT,                    -- JSON array
                sort_order INTEGER DEFAULT 0
            )
        """)

        conn.commit()
        logger.info("✅ 统一数据库初始化完成")


class UnifiedProjectStore:
    """
    统一项目管理存储

    职责:
    1. 项目 CRUD
    2. 诊断关联
    3. 知识库关联
    4. 报告生成关联
    """

    def __init__(self):
        init_unified_db()
        self._init_taxonomy()

    def _init_taxonomy(self):
        """初始化五维分类数据"""
        from .taxonomy_data import TAXONOMY_DATA

        with get_db() as conn:
            cursor = conn.cursor()

            # 检查是否已有数据
            cursor.execute("SELECT COUNT(*) FROM taxonomy_dimensions")
            if cursor.fetchone()[0] > 0:
                return

            # 插入五维分类数据
            for dim in TAXONOMY_DATA:
                cursor.execute("""
                    INSERT INTO taxonomy_dimensions
                    (id, level, code, parent_code, name, description, keywords, examples, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    dim['id'],
                    dim['level'],
                    dim['code'],
                    dim.get('parent_code'),
                    dim['name'],
                    dim.get('description'),
                    json.dumps(dim.get('keywords', [])),
                    json.dumps(dim.get('examples', [])),
                    dim.get('sort_order', 0)
                ))

            conn.commit()
            logger.info(f"✅ 已加载 {len(TAXONOMY_DATA)} 条五维分类数据")

    # ============================================================
    # 项目 CRUD
    # ============================================================

    def create_project(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """创建新项目"""
        project_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO projects (
                    id, name, code, description, client_name, client_industry,
                    client_id, status, current_step, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                project_id,
                data.get('name'),
                data.get('code'),
                data.get('description'),
                data.get('client_name'),
                data.get('client_industry'),
                data.get('client_id'),
                data.get('status', 'draft'),
                data.get('current_step', 'diagnosis'),
                data.get('created_by', 'anonymous'),
                now, now
            ))

            # 创建初始需求记录
            req_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO project_requirements (id, project_id, created_at, updated_at)
                VALUES (?, ?, ?, ?)
            """, (req_id, project_id, now, now))

            conn.commit()

        return self.get_project(project_id)

    def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """获取项目详情（包含所有关联数据）"""
        with get_db() as conn:
            cursor = conn.cursor()

            # 获取项目
            cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
            row = cursor.fetchone()

            if not row:
                return None

            project = dict(row)

            # 获取诊断结果
            cursor.execute("""
                SELECT * FROM diagnosis_sessions
                WHERE project_id = ?
                ORDER BY created_at DESC LIMIT 1
            """, (project_id,))
            diagnosis_row = cursor.fetchone()
            if diagnosis_row:
                diagnosis = dict(diagnosis_row)
                for field in ['pain_points', 'recommendations']:
                    if diagnosis.get(field):
                        diagnosis[field] = json.loads(diagnosis[field])
                project['diagnosis'] = diagnosis

            # 获取知识库文档统计
            cursor.execute("""
                SELECT COUNT(*) as doc_count, COALESCE(SUM(file_size), 0) as total_size
                FROM knowledge_documents WHERE project_id = ?
            """, (project_id,))
            doc_stats = cursor.fetchone()
            project['knowledge_stats'] = dict(doc_stats)

            # 获取需求
            cursor.execute("SELECT * FROM project_requirements WHERE project_id = ?", (project_id,))
            req_row = cursor.fetchone()
            if req_row:
                project['requirement'] = dict(req_row)

            # 获取大纲
            cursor.execute("""
                SELECT * FROM project_outlines
                WHERE project_id = ?
                ORDER BY version DESC LIMIT 1
            """, (project_id,))
            outline_row = cursor.fetchone()
            if outline_row:
                outline = dict(outline_row)
                if outline.get('sections'):
                    outline['sections'] = json.loads(outline['sections'])
                if outline.get('rag_sources'):
                    outline['rag_sources'] = json.loads(outline['rag_sources'])
                project['outline'] = outline

            # 获取幻灯片
            cursor.execute("""
                SELECT * FROM project_slides
                WHERE project_id = ?
                ORDER BY slide_index
            """, (project_id,))
            slides = []
            for slide_row in cursor.fetchall():
                slide = dict(slide_row)
                if slide.get('content'):
                    slide['content'] = json.loads(slide['content'])
                if slide.get('model_params'):
                    slide['model_params'] = json.loads(slide['model_params'])
                slides.append(slide)
            project['slides'] = slides

            return project

    def list_projects(self, user_id: str = None, status: str = None,
                      limit: int = 20, offset: int = 0) -> tuple[List[Dict], int]:
        """列出项目"""
        with get_db() as conn:
            cursor = conn.cursor()

            query = "SELECT * FROM projects WHERE 1=1"
            params = []

            if user_id:
                query += " AND created_by = ?"
                params.append(user_id)

            if status:
                query += " AND status = ?"
                params.append(status)

            # 计数
            count_query = query.replace("SELECT *", "SELECT COUNT(*)")
            cursor.execute(count_query, params)
            total = cursor.fetchone()[0]

            # 分页
            query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            cursor.execute(query, params)
            projects = [dict(row) for row in cursor.fetchall()]

            return projects, total

    def update_project(self, project_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """更新项目"""
        now = datetime.utcnow().isoformat()
        updates['updated_at'] = now

        with get_db() as conn:
            cursor = conn.cursor()

            set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
            values = list(updates.values()) + [project_id]

            cursor.execute(f"UPDATE projects SET {set_clause} WHERE id = ?", values)
            conn.commit()

        return self.get_project(project_id)

    def delete_project(self, project_id: str) -> bool:
        """删除项目（级联删除所有关联数据）"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            conn.commit()
            return cursor.rowcount > 0

    def get_stats(self, user_id: str = None) -> Dict[str, Any]:
        """获取项目统计"""
        with get_db() as conn:
            cursor = conn.cursor()

            query = "SELECT status, COUNT(*) as count FROM projects"
            params = []

            if user_id:
                query += " WHERE created_by = ?"
                params.append(user_id)

            query += " GROUP BY status"

            cursor.execute(query, params)
            by_status = {row['status']: row['count'] for row in cursor.fetchall()}

            # 总数
            total_query = "SELECT COUNT(*) FROM projects"
            if user_id:
                total_query += " WHERE created_by = ?"
            cursor.execute(total_query, params)
            total = cursor.fetchone()[0]

            # 最近项目
            recent_query = "SELECT * FROM projects ORDER BY updated_at DESC LIMIT 5"
            if user_id:
                recent_query = "SELECT * FROM projects WHERE created_by = ? ORDER BY updated_at DESC LIMIT 5"
                cursor.execute(recent_query, [user_id])
            else:
                cursor.execute(recent_query)
            recent = [dict(row) for row in cursor.fetchall()]

            return {
                'total': total,
                'by_status': by_status,
                'recent': recent
            }

    def check_draft(self, user_id: str = None) -> Optional[Dict[str, Any]]:
        """检查是否有草稿项目"""
        with get_db() as conn:
            cursor = conn.cursor()

            query = """
                SELECT * FROM projects
                WHERE status IN ('draft', 'active')
            """
            params = []

            if user_id:
                query += " AND created_by = ?"
                params.append(user_id)

            query += " ORDER BY updated_at DESC LIMIT 1"

            cursor.execute(query, params)
            row = cursor.fetchone()

            return dict(row) if row else None

    # ============================================================
    # 需求管理
    # ============================================================

    def save_requirement(self, project_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """保存需求表单数据"""
        now = datetime.utcnow().isoformat()
        data['updated_at'] = now

        with get_db() as conn:
            cursor = conn.cursor()

            # 检查是否存在
            cursor.execute("SELECT id FROM project_requirements WHERE project_id = ?", (project_id,))
            existing = cursor.fetchone()

            if existing:
                # 更新
                set_clause = ", ".join([f"{k} = ?" for k in data.keys()])
                values = list(data.values()) + [project_id]
                cursor.execute(f"UPDATE project_requirements SET {set_clause} WHERE project_id = ?", values)
            else:
                # 插入
                data['id'] = str(uuid.uuid4())
                data['project_id'] = project_id
                data['created_at'] = now

                columns = ", ".join(data.keys())
                placeholders = ", ".join(["?" for _ in data])
                cursor.execute(f"INSERT INTO project_requirements ({columns}) VALUES ({placeholders})", list(data.values()))

            # 如果表单完成，更新项目状态
            if data.get('form_completed'):
                cursor.execute("""
                    UPDATE projects SET status = 'active', current_step = 'knowledge', updated_at = ?
                    WHERE id = ?
                """, (now, project_id))

            conn.commit()

        return self.get_requirement(project_id)

    def get_requirement(self, project_id: str) -> Optional[Dict[str, Any]]:
        """获取需求表单"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM project_requirements WHERE project_id = ?", (project_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    # ============================================================
    # 诊断关联
    # ============================================================

    def link_diagnosis(self, project_id: str, diagnosis_session_id: str, diagnosis_data: Dict[str, Any]) -> bool:
        """将诊断结果关联到项目"""
        now = datetime.utcnow().isoformat()

        with get_db() as conn:
            cursor = conn.cursor()

            # 创建诊断记录
            diag_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO diagnosis_sessions
                (id, project_id, strategy_score, organization_score, performance_score,
                 compensation_score, talent_score, pain_points, recommendations, raw_response,
                 diagnosis_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                diag_id, project_id,
                diagnosis_data.get('strategy_score'),
                diagnosis_data.get('organization_score'),
                diagnosis_data.get('performance_score'),
                diagnosis_data.get('compensation_score'),
                diagnosis_data.get('talent_score'),
                json.dumps(diagnosis_data.get('pain_points', [])),
                json.dumps(diagnosis_data.get('recommendations', [])),
                diagnosis_data.get('raw_response'),
                diagnosis_data.get('diagnosis_type', 'comprehensive'),
                now
            ))

            # 更新项目
            cursor.execute("""
                UPDATE projects
                SET diagnosis_session_id = ?, diagnosis_completed_at = ?, updated_at = ?
                WHERE id = ?
            """, (diag_id, now, now, project_id))

            conn.commit()
            return True

    # ============================================================
    # 知识库关联
    # ============================================================

    def add_knowledge_document(self, project_id: str, doc_data: Dict[str, Any]) -> Dict[str, Any]:
        """添加知识库文档到项目"""
        doc_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        doc_data.update({
            'id': doc_id,
            'project_id': project_id,
            'created_at': now,
            'updated_at': now
        })

        with get_db() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO knowledge_documents
                (id, project_id, filename, file_type, file_path, file_size, title, author,
                 page_count, dimension_l1, dimension_l2, dimension_l3, classification_confidence, tags)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                doc_id, project_id,
                doc_data.get('filename'),
                doc_data.get('file_type'),
                doc_data.get('file_path'),
                doc_data.get('file_size'),
                doc_data.get('title'),
                doc_data.get('author'),
                doc_data.get('page_count'),
                doc_data.get('dimension_l1'),
                doc_data.get('dimension_l2'),
                doc_data.get('dimension_l3'),
                doc_data.get('classification_confidence'),
                json.dumps(doc_data.get('tags', []))
            ))

            conn.commit()

        return doc_data


    def get_knowledge_documents(self, project_id: str) -> List[Dict[str, Any]]:
        """获取项目的所有知识库文档"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM knowledge_documents
                WHERE project_id = ?
                ORDER BY created_at DESC
            """, (project_id,))
            return [dict(row) for row in cursor.fetchall()]

    # ============================================================
    # 文件夹操作
    # ============================================================

    def create_folder(
        self, project_id: str, name: str, parent_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """创建文件夹"""
        with get_db() as conn:
            cursor = conn.cursor()

            # 验证项目存在
            cursor.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
            if not cursor.fetchone():
                raise ValueError(f"Project {project_id} not found")

            # 构建路径
            if parent_id:
                parent = self.get_folder(parent_id)
                if not parent:
                    raise ValueError(f"Parent folder {parent_id} not found")
                path = f"{parent['path']}/{name}"
            else:
                path = f"/{name}"

            folder_id = f"folder_{uuid.uuid4().hex[:8]}"
            now = datetime.utcnow().isoformat()

            cursor.execute("""
                INSERT INTO folders (id, project_id, parent_id, name, path, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (folder_id, project_id, parent_id, name, path, now, now))

            conn.commit()

        return self.get_folder(folder_id)

    def get_folder(self, folder_id: str) -> Optional[Dict[str, Any]]:
        """获取文件夹"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM folders WHERE id = ?", (folder_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_folders_by_project(self, project_id: str) -> List[Dict[str, Any]]:
        """获取项目的所有文件夹"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM folders WHERE project_id = ? ORDER BY path",
                (project_id,)
            )
            return [dict(row) for row in cursor.fetchall()]

    def get_folders_by_parent(self, project_id: str, parent_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取指定父文件夹下的直接子文件夹"""
        with get_db() as conn:
            cursor = conn.cursor()
            if parent_id is None:
                cursor.execute(
                    "SELECT * FROM folders WHERE project_id = ? AND parent_id IS NULL ORDER BY name",
                    (project_id,)
                )
            else:
                cursor.execute(
                    "SELECT * FROM folders WHERE project_id = ? AND parent_id = ? ORDER BY name",
                    (project_id, parent_id)
                )
            return [dict(row) for row in cursor.fetchall()]

    def update_folder(
        self, folder_id: str, name: Optional[str] = None, parent_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """更新文件夹（重命名或移动）"""
        folder = self.get_folder(folder_id)
        if not folder:
            raise ValueError(f"Folder {folder_id} not found")

        now = datetime.utcnow().isoformat()

        with get_db() as conn:
            cursor = conn.cursor()

            if name:
                # 重命名 - 更新路径及所有子文件夹路径
                old_path = folder['path']
                new_path = old_path.rsplit('/', 1)[0] + '/' + name

                # 更新当前文件夹
                cursor.execute("""
                    UPDATE folders SET name = ?, path = ?, updated_at = ?
                    WHERE id = ?
                """, (name, new_path, now, folder_id))

                # 更新所有子文件夹的路径
                cursor.execute("""
                    SELECT id, path FROM folders WHERE path LIKE ?
                """, (old_path + '/%',))
                children = cursor.fetchall()

                for child in children:
                    child_new_path = child['path'].replace(old_path, new_path, 1)
                    cursor.execute("""
                        UPDATE folders SET path = ?, updated_at = ?
                        WHERE id = ?
                    """, (child_new_path, now, child['id']))

            if parent_id is not None:
                # 移动文件夹
                if parent_id == folder_id:
                    raise ValueError("Cannot move folder to itself")

                # 验证新父文件夹存在且不是子文件夹
                if parent_id:
                    new_parent = self.get_folder(parent_id)
                    if not new_parent:
                        raise ValueError(f"Parent folder {parent_id} not found")
                    if new_parent['path'].startswith(folder['path'] + '/'):
                        raise ValueError("Cannot move folder to its own descendant")

                # 计算新路径
                old_path = folder['path']
                if parent_id:
                    new_parent = self.get_folder(parent_id)
                    new_path = f"{new_parent['path']}/{folder['name']}"
                else:
                    new_path = f"/{folder['name']}"

                # 更新当前文件夹
                cursor.execute("""
                    UPDATE folders SET parent_id = ?, path = ?, updated_at = ?
                    WHERE id = ?
                """, (parent_id, new_path, now, folder_id))

                # 更新所有子文件夹的路径
                cursor.execute("""
                    SELECT id, path FROM folders WHERE path LIKE ?
                """, (old_path + '/%',))
                children = cursor.fetchall()

                for child in children:
                    child_new_path = child['path'].replace(old_path, new_path, 1)
                    cursor.execute("""
                        UPDATE folders SET path = ?, updated_at = ?
                        WHERE id = ?
                    """, (child_new_path, now, child['id']))

            conn.commit()

        return self.get_folder(folder_id)

    def delete_folder(self, folder_id: str) -> bool:
        """删除文件夹（级联删除子内容）"""
        with get_db() as conn:
            cursor = conn.cursor()
            # 由于外键设置了 ON DELETE CASCADE，删除文件夹会自动删除子文件夹和文件
            cursor.execute("DELETE FROM folders WHERE id = ?", (folder_id,))
            conn.commit()
            return cursor.rowcount > 0

    def get_or_create_root_folder(self, project_id: str) -> Dict[str, Any]:
        """获取或创建项目根文件夹"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM folders WHERE project_id = ? AND parent_id IS NULL",
                (project_id,)
            )
            row = cursor.fetchone()
            if row:
                return dict(row)

        # 创建根文件夹
        return self.create_folder(project_id, "root", parent_id=None)


# 全局实例
unified_store = UnifiedProjectStore()
