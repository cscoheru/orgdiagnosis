"""
Test folders table schema and functionality
"""
import pytest
import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).parent.parent / "data" / "org_diagnosis.db"


def test_folders_table_exists():
    """Test that folders table exists in database"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='folders'")
    result = cursor.fetchone()

    conn.close()

    assert result is not None, "folders table should exist"
    assert result[0] == "folders"


def test_folders_table_schema():
    """Test that folders table has correct columns"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(folders)")
    columns_info = cursor.fetchall()
    conn.close()

    # Extract column names and types
    columns = {col[1]: col[2] for col in columns_info}

    # Verify all required columns exist
    assert "id" in columns, "id column should exist"
    assert "project_id" in columns, "project_id column should exist"
    assert "parent_id" in columns, "parent_id column should exist"
    assert "name" in columns, "name column should exist"
    assert "path" in columns, "path column should exist"
    assert "created_at" in columns, "created_at column should exist"
    assert "updated_at" in columns, "updated_at column should exist"

    # Verify column types
    assert columns["id"] == "TEXT", "id should be TEXT"
    assert columns["project_id"] == "TEXT", "project_id should be TEXT"
    assert columns["parent_id"] == "TEXT", "parent_id should be TEXT"
    assert columns["name"] == "TEXT", "name should be TEXT"
    assert columns["path"] == "TEXT", "path should be TEXT"


def test_folders_table_indexes():
    """Test that folders table has correct indexes"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    cursor.execute("PRAGMA index_list(folders)")
    indexes = cursor.fetchall()
    conn.close()

    index_names = [idx[1] for idx in indexes]

    assert "idx_folders_project" in index_names, "idx_folders_project index should exist"
    assert "idx_folders_parent" in index_names, "idx_folders_parent index should exist"


def test_folders_foreign_keys():
    """Test that folders table has correct foreign key constraints"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    cursor.execute("PRAGMA foreign_key_list(folders)")
    fks = cursor.fetchall()

    conn.close()

    # Should have 2 foreign keys: project_id -> projects, parent_id -> folders
    assert len(fks) == 2, "folders should have 2 foreign key constraints"

    fk_refs = [(fk[2], fk[3]) for fk in fks]  # (table, from)
    assert ("projects", "project_id") in fk_refs, "project_id should reference projects"
    assert ("folders", "parent_id") in fk_refs, "parent_id should reference folders"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
