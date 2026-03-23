"""
Project Storage - SQLite-based storage for projects

Uses the same database as the knowledge base for consistency.
"""

import sqlite3
import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

# Use the same database path as knowledge base
DB_PATH = "data/org_diagnosis.db"


@contextmanager
def get_db():
    """Get database connection with context manager."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Initialize project tables."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Projects table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                client_name TEXT,
                client_industry TEXT,
                client_id TEXT,
                status TEXT DEFAULT 'draft',
                current_step TEXT DEFAULT 'requirement',
                langgraph_thread_id TEXT,
                langgraph_checkpoint TEXT,
                created_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Project requirements table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_requirements (
                id TEXT PRIMARY KEY,
                project_id TEXT UNIQUE NOT NULL,
                form_step INTEGER DEFAULT 1,
                form_completed BOOLEAN DEFAULT FALSE,
                client_name TEXT,
                industry TEXT,
                company_stage TEXT,
                employee_count INTEGER,
                diagnosis_session_id TEXT,
                pain_points TEXT,
                goals TEXT,
                timeline TEXT,
                report_type TEXT,
                slide_count INTEGER,
                focus_areas TEXT,
                reference_materials TEXT,
                tone TEXT,
                language TEXT,
                template_style TEXT,
                special_requirements TEXT,
                last_saved_at TIMESTAMP,
                last_saved_field TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """)

        # Project outlines table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_outlines (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                sections TEXT NOT NULL,
                version INTEGER DEFAULT 1,
                is_confirmed BOOLEAN DEFAULT FALSE,
                confirmed_at TIMESTAMP,
                confirmed_by TEXT,
                generation_model TEXT,
                generation_tokens INTEGER,
                rag_sources TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """)

        # Project slides table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_slides (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                slide_index INTEGER NOT NULL,
                section_id TEXT,
                title TEXT NOT NULL,
                subtitle TEXT,
                key_message TEXT,
                content TEXT,
                layout_type TEXT,
                model_id TEXT,
                model_params TEXT,
                status TEXT DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                UNIQUE(project_id, slide_index)
            )
        """)

        # Project exports table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_exports (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                format TEXT DEFAULT 'pptx',
                file_path TEXT,
                file_size_kb INTEGER,
                download_url TEXT,
                slide_count INTEGER,
                generation_time_ms INTEGER,
                status TEXT DEFAULT 'pending',
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                created_by TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """)

        conn.commit()
        print("✅ Project tables initialized")


class ProjectStore:
    """Project storage operations."""

    def __init__(self):
        init_db()

    def create_project(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new project."""
        project_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO projects (id, name, description, client_name, client_industry,
                                      client_id, status, current_step, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                project_id, data.get('name'), data.get('description'),
                data.get('client_name'), data.get('client_industry'),
                data.get('client_id'), 'draft', 'requirement',
                data.get('created_by', 'anonymous'), now, now
            ))

            # Create initial requirement record
            req_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO project_requirements (id, project_id, form_step, form_completed, created_at, updated_at)
                VALUES (?, ?, 1, FALSE, ?, ?)
            """, (req_id, project_id, now, now))

            conn.commit()

        return self.get_project(project_id)

    def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get a project by ID."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
            row = cursor.fetchone()

            if not row:
                return None

            project = dict(row)
            project['id'] = str(project['id'])

            # Get requirement
            cursor.execute("SELECT * FROM project_requirements WHERE project_id = ?", (project_id,))
            req_row = cursor.fetchone()
            if req_row:
                project['requirement'] = dict(req_row)

            # Get latest outline
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

            # Get slides
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

            # Get exports
            cursor.execute("""
                SELECT * FROM project_exports
                WHERE project_id = ?
                ORDER BY created_at DESC
            """, (project_id,))
            project['exports'] = [dict(row) for row in cursor.fetchall()]

            return project

    def list_projects(self, user_id: str = None, status: str = None,
                      limit: int = 20, offset: int = 0) -> tuple[List[Dict], int]:
        """List projects with optional filters."""
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

            # Get total count
            count_query = query.replace("SELECT *", "SELECT COUNT(*)")
            cursor.execute(count_query, params)
            total = cursor.fetchone()[0]

            # Get paginated results
            query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            cursor.execute(query, params)
            projects = [dict(row) for row in cursor.fetchall()]

            return projects, total

    def update_project(self, project_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a project."""
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
        """Delete a project."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            conn.commit()
            return cursor.rowcount > 0

    def get_stats(self, user_id: str = None) -> Dict[str, Any]:
        """Get project statistics."""
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

            # Get total
            total_query = "SELECT COUNT(*) FROM projects"
            if user_id:
                total_query += " WHERE created_by = ?"
            cursor.execute(total_query, params)
            total = cursor.fetchone()[0]

            # Get recent projects
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
        """Check for draft projects."""
        with get_db() as conn:
            cursor = conn.cursor()

            query = """
                SELECT * FROM projects
                WHERE status IN ('draft', 'requirement', 'outline', 'slides')
            """
            params = []

            if user_id:
                query += " AND created_by = ?"
                params.append(user_id)

            query += " ORDER BY updated_at DESC LIMIT 1"

            cursor.execute(query, params)
            row = cursor.fetchone()

            return dict(row) if row else None

    # Requirement operations
    def save_requirement(self, project_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Save requirement form data."""
        now = datetime.utcnow().isoformat()
        data['updated_at'] = now

        with get_db() as conn:
            cursor = conn.cursor()

            # Check if requirement exists
            cursor.execute("SELECT id FROM project_requirements WHERE project_id = ?", (project_id,))
            existing = cursor.fetchone()

            if existing:
                # Update existing
                set_clause = ", ".join([f"{k} = ?" for k in data.keys()])
                values = list(data.values()) + [project_id]
                cursor.execute(f"UPDATE project_requirements SET {set_clause} WHERE project_id = ?", values)
            else:
                # Insert new
                data['id'] = str(uuid.uuid4())
                data['project_id'] = project_id
                data['created_at'] = now

                columns = ", ".join(data.keys())
                placeholders = ", ".join(["?" for _ in data])
                cursor.execute(f"INSERT INTO project_requirements ({columns}) VALUES ({placeholders})", list(data.values()))

            conn.commit()

        # Return updated requirement
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM project_requirements WHERE project_id = ?", (project_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_requirement(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get requirement for a project."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM project_requirements WHERE project_id = ?", (project_id,))
            row = cursor.fetchone()
            return dict(row) if row else None


# Global instance
project_store = ProjectStore()
