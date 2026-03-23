"""
Test file CRUD operations for UnifiedProjectStore
"""
import pytest
import tempfile
from pathlib import Path

# Add parent directory to path for imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import lib.projects.unified_store as store_module
from lib.projects.unified_store import UnifiedProjectStore, DB_PATH as ORIGINAL_DB_PATH, get_db


@pytest.fixture
def store():
    """Create a test store with a temporary database"""
    db_file = tempfile.NamedTemporaryFile(mode='w', suffix='.db', delete=False)
    db_path = Path(db_file.name)

    # Monkey-patch the DB_PATH for test store
    store_module.DB_PATH = db_path

    yield UnifiedProjectStore()

    # Cleanup
    db_file.close()
    store_module.DB_PATH = ORIGINAL_DB_PATH


class TestFileCRUD:
    """Test file CRUD operations"""

    def test_create_file(self, store):
        """Test creating a file"""
        # Create project and folder
        project = store.create_project({
            'name': 'Test Project',
            'client_name': 'Test Client'
        })
        folder = store.create_folder(project['id'], 'Documents')

        # Create file
        file_data = {
            'folder_id': folder['id'],
            'filename': 'test_document.pdf',
            'minio_path': 'projects/test/test_document.pdf',
            'file_type': 'pdf',
            'size': 1024,
            'metadata': {'author': 'Test Author', 'pages': 10}
        }

        file = store.create_file(**file_data)

        assert file is not None
        assert file['filename'] == 'test_document.pdf'
        assert file['file_type'] == 'pdf'
        assert file['size'] == 1024
        assert file['metadata']['author'] == 'Test Author'
        assert file['metadata']['pages'] == 10

    def test_get_file(self, store):
        """Test getting a file"""
        # Setup
        project = store.create_project({'name': 'Test Project'})
        folder = store.create_folder(project['id'], 'Documents')
        file = store.create_file(
            folder_id=folder['id'],
            filename='report.docx',
            minio_path='projects/test/report.docx',
            file_type='docx'
        )

        # Get file
        retrieved = store.get_file(file['id'])
        assert retrieved is not None
        assert retrieved['filename'] == 'report.docx'
        assert retrieved['file_type'] == 'docx'

        assert retrieved['minio_path'] == 'projects/test/report.docx'

    def test_get_files_by_folder(self, store):
        """Test getting all files in a folder"""
        # Setup
        project = store.create_project({'name': 'Test Project'})
        folder = store.create_folder(project['id'], 'Documents')

        # Create multiple files
        file1 = store.create_file(
            folder_id=folder['id'],
            filename='file1.pdf',
            minio_path='projects/test/file1.pdf'
        )
        file2 = store.create_file(
            folder_id=folder['id'],
            filename='file2.docx',
            minio_path='projects/test/file2.docx'
        )
        file3 = store.create_file(
            folder_id=folder['id'],
            filename='file3.xlsx',
            minio_path='projects/test/file3.xlsx'
        )

        # Get files
        files = store.get_files_by_folder(folder['id'])
        assert len(files) == 3
        filenames = [f['filename'] for f in files]
        assert 'file1.pdf' in filenames
        assert 'file2.docx' in filenames
        assert 'file3.xlsx' in filenames

    def test_update_file(self, store):
        """Test updating file metadata"""
        # Setup
        project = store.create_project({'name': 'Test Project'})
        folder = store.create_folder(project['id'], 'Documents')
        file = store.create_file(
            folder_id=folder['id'],
            filename='original.pdf',
            minio_path='projects/test/original.pdf',
            metadata={'version': '1.0', 'status': 'draft'}
        )

        # Update filename
        updated = store.update_file(
            file_id=file['id'],
            filename='updated.pdf'
        )
        assert updated is not None
        assert updated['filename'] == 'updated.pdf'

        # Update metadata
        updated = store.update_file(
            file_id=file['id'],
            metadata={'version': '2.0', 'status': 'final', 'reviewed_by': 'John'}
        )
        assert updated is not None
        assert updated['metadata']['version'] == '2.0'
        assert updated['metadata']['status'] == 'final'
        assert updated['metadata']['reviewed_by'] == 'John'

        # Verify original field not overwritten
        assert updated['minio_path'] == 'projects/test/original.pdf'

    def test_delete_file(self, store):
        """Test deleting a file"""
        # Setup
        project = store.create_project({'name': 'Test Project'})
        folder = store.create_folder(project['id'], 'Documents')
        file = store.create_file(
            folder_id=folder['id'],
            filename='to_delete.pdf',
            minio_path='projects/test/to_delete.pdf'
        )

        file_id = file['id']

        # Delete file
        result = store.delete_file(file_id)
        assert result is True

        # Verify file is deleted
        deleted = store.get_file(file_id)
        assert deleted is None

        # Verify FTS index entry is also deleted
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM files_search WHERE file_id = ?",
                (file_id,)
            )
            assert cursor.fetchone() is None

    def test_search_files(self, store):
        """Test FTS5 search functionality"""
        # Setup
        project = store.create_project({'name': 'Test Project'})
        folder = store.create_folder(project['id'], 'Documents')

        # Create files with different names
        files = [
            ('年度报告.pdf', 'projects/test/annual_report.pdf'),
            ('季度总结.docx', 'projects/test/quarterly_summary.docx'),
            ('财务报表.xlsx', 'projects/test/financial_statement.xlsx'),
        ]

        file_ids = []
        for filename, minio_path in files:
            file = store.create_file(
                folder_id=folder['id'],
                filename=filename,
                minio_path=minio_path
            )
            file_ids.append(file['id'])

        # Search for "报告" with project filter to ensure isolation
        results = store.search_files('报告', project_id=project['id'])
        assert len(results) == 1
        assert results[0]['filename'] == '年度报告.pdf'

        # Search for "财务" with project filter
        results = store.search_files('财务', project_id=project['id'])
        assert len(results) == 1
        assert results[0]['filename'] == '财务报表.xlsx'

        # Search without project filter (should also work but may return more results)
        results = store.search_files('报告')
        assert len(results) >= 1  # At least one result

        # Search for non-existent term
        results = store.search_files('不存在的内容')
        assert len(results) == 0

        # Test Chinese search
        file = store.create_file(
            folder_id=folder['id'],
            filename='组织架构分析.pdf',
            minio_path='projects/test/org_analysis.pdf'
        )

        results = store.search_files('组织架构')
        assert len(results) >= 1
        assert '组织架构分析.pdf' in [r['filename'] for r in results]

    def test_folder_cascade_delete(self, store):
        """Test that deleting a folder cascades to files"""
        # Setup
        project = store.create_project({'name': 'Test Project'})
        parent_folder = store.create_folder(project['id'], 'Parent')
        child_folder = store.create_folder(project['id'], 'Child', parent_id=parent_folder['id'])

        # Create files in both folders
        file1 = store.create_file(
            folder_id=parent_folder['id'],
            filename='parent_file.pdf',
            minio_path='projects/test/parent_file.pdf'
        )
        file2 = store.create_file(
            folder_id=child_folder['id'],
            filename='child_file.pdf',
            minio_path='projects/test/child_file.pdf'
        )

        # Delete parent folder
        result = store.delete_folder(parent_folder['id'])
        assert result is True

        # Verify both files are deleted
        assert store.get_file(file1['id']) is None
        assert store.get_file(file2['id']) is None
