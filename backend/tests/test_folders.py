"""
import sqlite3
import sys
from pathlib import Path

# Add the projects directory to Python path
sys.path.insert(0, str(path(__file__).parent.parent))

# Import the database module
from lib.projects.unified_store import UnifiedProjectStore

# Test database initialization
init_unified_db()

# Connect to database
db_path = Path(__file__).parent / 'data' / 'test_folders_table.db'
conn = sqlite3.connect(str(db_path))
conn.row_factory = sqlite3.Row

# Check if folders table exists
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='folders'")
result = cursor.fetchone()

if result:
    print("✅ Folders table exists!")

    # Check schema
    cursor.execute("PRAGMA table_info(folders)")
    print("Table columns:")
    for row in cursor.fetchall():
        print(f"  {row['name']}: {row['type']}")

    # Check indexes
    cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='folders'")
    indexes = cursor.fetchall()
    print("\nIndexes on folders table:")
    for idx in indexes:
        print(f"  {idx['name']}: {idx['sql']}")
else:
    print("❌ Folders table not found")

if __name__ == "__main__":
    sys.exit(1)
