"""
Test files table schema
"""
import pytest
import sqlite3
from pathlib import Path
import sys
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.projects.unified_store import init_unified_db, get_db
from contextlib import contextmanager


def test_files_table_exists():
    """Test that files table is created with correct schema"""
    # Initialize database
    init_unified_db()

    with get_db() as conn:
        cursor = conn.cursor()

        # Check files table exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='files'
        """)
        result = cursor.fetchone()
        assert result is not None, "files table should exist"
        assert result[0] == 'files'

        # Check table schema
        cursor.execute("PRAGMA table_info(files)")
        columns = {row[1]: row[2] for row in cursor.fetchall()}

        # Verify all required columns
        required_columns = {
            'id': 'TEXT',
            'folder_id': 'TEXT',
            'filename': 'TEXT',
            'file_type': 'TEXT',
            'minio_path': 'TEXT',
            'size': 'INTEGER',
            'metadata': 'TEXT',
            'source_type': 'TEXT',
            'created_at': 'TEXT'
        }

        for col_name, col_type in required_columns.items():
            assert col_name in columns, f"Column {col_name} should exist"
            assert columns[col_name] == col_type, f"Column {col_name} should be {col_type}, got {columns[col_name]}"


def test_files_search_virtual_table():
    """Test that FTS5 virtual table for files search is created"""
    with get_db() as conn:
        cursor = conn.cursor()

        # Check files_search virtual table exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='files_search'
        """)
        result = cursor.fetchone()
        assert result is not None, "files_search virtual table should exist"

        # Verify it's a virtual table
        cursor.execute("SELECT sql FROM sqlite_master WHERE name='files_search'")
        sql = cursor.fetchone()[0]
        assert 'USING fts5' in sql, "files_search should be an FTS5 virtual table"
        assert 'file_id' in sql, "files_search should have file_id column"
        assert 'filename' in sql, "files_search should have filename column"
        assert 'content' in sql, "files_search should have content column"
        assert "tokenize='unicode61'" in sql, "files_search should use unicode61 tokenizer"


def test_files_folder_index():
    """Test that index on folder_id is created"""
    with get_db() as conn:
        cursor = conn.cursor()

        # Check index exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='index' AND name='idx_files_folder'
        """)
        result = cursor.fetchone()
        assert result is not None, "idx_files_folder index should exist"


def test_files_folder_foreign_key():
    """Test that folder_id references folders table"""
    with get_db() as conn:
        cursor = conn.cursor()

        # Create a test project and folder
        cursor.execute("""
            INSERT INTO projects (id, name, created_at, updated_at)
            VALUES ('test-project-1', 'Test Project', datetime(), datetime())
        """)
        cursor.execute("""
            INSERT INTO folders (id, project_id, name, path, created_at, updated_at)
            VALUES ('test-folder-1', 'test-project-1', 'Test Folder', '/test', datetime(), datetime())
        """)

        # Insert file with valid folder_id
        cursor.execute("""
            INSERT INTO files (id, folder_id, filename, minio_path, created_at)
            VALUES ('test-file-1', 'test-folder-1', 'test.pdf', 'projects/test/test/test.pdf', datetime())
        """)

        # Verify file was inserted
        cursor.execute("SELECT * FROM files WHERE id = 'test-file-1'")
        result = cursor.fetchone()
        assert result is not None, "File should be inserted"

        # Test CASCADE DELETE - delete folder should delete files
        cursor.execute("DELETE FROM folders WHERE id = 'test-folder-1'")
        cursor.execute("SELECT * FROM files WHERE id = 'test-file-1'")
        result = cursor.fetchone()
        assert result is None, "File should be deleted when folder is deleted (CASCADE)"

        # Cleanup
        cursor.execute("DELETE FROM projects WHERE id = 'test-project-1'")
        conn.commit()


def test_files_table_insert_and_query():
    """Test basic CRUD operations on files table"""
    with get_db() as conn:
        cursor = conn.cursor()

        # Create test project and folder
        cursor.execute("""
            INSERT INTO projects (id, name, created_at, updated_at)
            VALUES ('test-project-2', 'Test Project 2', datetime(), datetime())
        """)
        cursor.execute("""
            INSERT INTO folders (id, project_id, name, path, created_at, updated_at)
            VALUES ('test-folder-2', 'test-project-2', 'Test Folder', '/test', datetime(), datetime())
        """)

        # Insert file with all fields (created_at uses DEFAULT)
        cursor.execute("""
            INSERT INTO files (id, folder_id, filename, file_type, minio_path, size, metadata, source_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            'test-file-2',
            'test-folder-2',
            'document.pdf',
            'pdf',
            'projects/test/documents/document.pdf',
            1024,
            '{"author": "Test Author", "pages": 10}',
            'upload'
        ))

        # Query file
        cursor.execute("SELECT * FROM files WHERE id = 'test-file-2'")
        result = cursor.fetchone()
        assert result is not None
        assert result['filename'] == 'document.pdf'
        assert result['file_type'] == 'pdf'
        assert result['size'] == 1024
        assert result['source_type'] == 'upload'

        # Cleanup
        cursor.execute("DELETE FROM projects WHERE id = 'test-project-2'")
        conn.commit()
