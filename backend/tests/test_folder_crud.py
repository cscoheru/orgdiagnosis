"""
Test folder CRUD operations
"""
import pytest
import sqlite3
from pathlib import Path

# Add parent directory to path for imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.projects.unified_store import UnifiedProjectStore, get_db


DB_PATH = Path(__file__).parent.parent / "data" / "org_diagnosis.db"


@pytest.fixture
def store():
    """Create a fresh store instance for each test"""
    return UnifiedProjectStore()


class TestFolderCRUD:
    """Test folder CRUD operations"""

    def test_create_root_folder(self, store):
        """Test creating a root folder"""
        # First create a project
        project = store.create_project({
            "name": "Test Project for Folders",
            "client_name": "Test Client"
        })

        # Create root folder
        folder = store.create_folder(project["id"], "Documents")

        assert folder is not None
        assert folder["name"] == "Documents"
        assert folder["path"] == "/Documents"
        assert folder["parent_id"] is None
        assert folder["project_id"] == project["id"]

    def test_create_nested_folder(self, store):
        """Test creating nested folders"""
        project = store.create_project({"name": "Nested Test"})

        # Create parent folder
        parent = store.create_folder(project["id"], "Parent")
        assert parent["path"] == "/Parent"

        # Create child folder
        child = store.create_folder(project["id"], "Child", parent["id"])
        assert child["name"] == "Child"
        assert child["path"] == "/Parent/Child"
        assert child["parent_id"] == parent["id"]

        # Create grandchild folder
        grandchild = store.create_folder(project["id"], "Grandchild", child["id"])
        assert grandchild["path"] == "/Parent/Child/Grandchild"

    def test_get_folder(self, store):
        """Test getting a folder by ID"""
        project = store.create_project({"name": "Get Test"})
        folder = store.create_folder(project["id"], "TestFolder")

        # Get the folder
        retrieved = store.get_folder(folder["id"])
        assert retrieved is not None
        assert retrieved["name"] == "TestFolder"
        assert retrieved["id"] == folder["id"]

        # Test non-existent folder
        assert store.get_folder("non_existent_id") is None

    def test_get_folders_by_project(self, store):
        """Test getting all folders for a project"""
        project = store.create_project({"name": "List Test"})

        # Create multiple folders
        f1 = store.create_folder(project["id"], "Folder1")
        f2 = store.create_folder(project["id"], "Folder2")
        f3 = store.create_folder(project["id"], "SubFolder", f1["id"])

        folders = store.get_folders_by_project(project["id"])
        assert len(folders) == 3

        # Check ordering by path
        paths = [f["path"] for f in folders]
        assert "/Folder1" in paths
        assert "/Folder2" in paths
        assert "/Folder1/SubFolder" in paths

    def test_get_folders_by_parent(self, store):
        """Test getting direct children of a folder"""
        project = store.create_project({"name": "Children Test"})

        parent = store.create_folder(project["id"], "Parent")

        # Create children
        child1 = store.create_folder(project["id"], "Child1", parent["id"])
        child2 = store.create_folder(project["id"], "Child2", parent["id"])

        # Create nested child (not direct child)
        grandchild = store.create_folder(project["id"], "Grandchild", child1["id"])

        # Get direct children
        children = store.get_folders_by_parent(project["id"], parent["id"])
        assert len(children) == 2

        child_names = [c["name"] for c in children]
        assert "Child1" in child_names
        assert "Child2" in child_names
        assert "Grandchild" not in child_names  # Not a direct child

    def test_update_folder_rename(self, store):
        """Test renaming a folder"""
        project = store.create_project({"name": "Rename Test"})
        folder = store.create_folder(project["id"], "OriginalName")

        # Rename
        updated = store.update_folder(folder["id"], name="NewName")
        assert updated["name"] == "NewName"
        assert updated["path"] == "/NewName"

        # Verify in database
        retrieved = store.get_folder(folder["id"])
        assert retrieved["name"] == "NewName"

    def test_update_folder_rename_nested(self, store):
        """Test renaming a nested folder updates paths correctly"""
        project = store.create_project({"name": "Nested Rename Test"})

        parent = store.create_folder(project["id"], "Parent")
        child = store.create_folder(project["id"], "Child", parent["id"])
        grandchild = store.create_folder(project["id"], "Grandchild", child["id"])

        # Rename parent - should update child paths too
        updated = store.update_folder(parent["id"], name="NewParent")
        assert updated["path"] == "/NewParent"

        # Verify child paths were updated
        updated_child = store.get_folder(child["id"])
        assert updated_child["path"] == "/NewParent/Child"

        updated_grandchild = store.get_folder(grandchild["id"])
        assert updated_grandchild["path"] == "/NewParent/Child/Grandchild"

    def test_update_folder_move(self, store):
        """Test moving a folder to a new parent"""
        project = store.create_project({"name": "Move Test"})

        parent1 = store.create_folder(project["id"], "Parent1")
        parent2 = store.create_folder(project["id"], "Parent2")
        child = store.create_folder(project["id"], "Child", parent1["id"])

        # Move child to parent2
        updated = store.update_folder(child["id"], parent_id=parent2["id"])
        assert updated["parent_id"] == parent2["id"]
        assert updated["path"] == "/Parent2/Child"

    def test_delete_folder(self, store):
        """Test deleting a folder"""
        project = store.create_project({"name": "Delete Test"})
        folder = store.create_folder(project["id"], "ToDelete")

        # Delete
        result = store.delete_folder(folder["id"])
        assert result is True

        # Verify deleted
        assert store.get_folder(folder["id"]) is None

    def test_delete_folder_cascade(self, store):
        """Test that deleting a folder cascades to children"""
        project = store.create_project({"name": "Cascade Delete Test"})

        parent = store.create_folder(project["id"], "Parent")
        child = store.create_folder(project["id"], "Child", parent["id"])
        grandchild = store.create_folder(project["id"], "Grandchild", child["id"])

        # Delete parent
        store.delete_folder(parent["id"])

        # All should be deleted due to CASCADE
        assert store.get_folder(parent["id"]) is None
        assert store.get_folder(child["id"]) is None
        assert store.get_folder(grandchild["id"]) is None

    def test_get_or_create_root_folder(self, store):
        """Test get_or_create_root_folder"""
        project = store.create_project({"name": "Root Folder Test"})

        # First call should create
        root = store.get_or_create_root_folder(project["id"])
        assert root is not None
        assert root["name"] == "root"
        assert root["parent_id"] is None

        # Second call should return existing
        root2 = store.get_or_create_root_folder(project["id"])
        assert root2["id"] == root["id"]

    def test_create_folder_invalid_project(self, store):
        """Test that creating folder with invalid project raises error"""
        with pytest.raises(ValueError, match="Project .* not found"):
            store.create_folder("non_existent_project", "Test")

    def test_create_folder_invalid_parent(self, store):
        """Test that creating folder with invalid parent raises error"""
        project = store.create_project({"name": "Invalid Parent Test"})

        with pytest.raises(ValueError, match="Parent folder .* not found"):
            store.create_folder(project["id"], "Test", "non_existent_folder")

    def test_update_folder_invalid_folder(self, store):
        """Test that updating non-existent folder raises error"""
        with pytest.raises(ValueError, match="Folder .* not found"):
            store.update_folder("non_existent_folder", name="NewName")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
