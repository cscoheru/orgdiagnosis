# File Manager System - Development Summary

> Created: 2026-03-23
> Status: Phase 3 Complete, Phase 4 (Auto-save) In Progress

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                           │
├─────────────────────────────────────────────────────────────────────┤
│  app/(dashboard)/knowledge/files/page.tsx                           │
│  ├── components/file-manager/FolderTree.tsx    (Left sidebar)       │
│  ├── components/file-manager/FileList.tsx      (Right content)      │
│  ├── components/file-manager/FileUploadZone.tsx (Drag & drop)       │
│  └── components/project/ProjectSelector.tsx    (Project binding)    │
├─────────────────────────────────────────────────────────────────────┤
│                         Backend (FastAPI)                           │
├─────────────────────────────────────────────────────────────────────┤
│  api/folders.py                 api/files.py                        │
│  ├── POST /folders              ├── POST /files/upload              │
│  ├── GET  /folders              ├── GET  /files                     │
│  ├── PUT  /folders/{id}         ├── GET  /files/{id}/download       │
│  └── DELETE /folders/{id}       ├── DELETE /files/{id}              │
│                                 └── GET  /files/search              │
├─────────────────────────────────────────────────────────────────────┤
│                      Data Layer (SQLite + MinIO)                    │
├─────────────────────────────────────────────────────────────────────┤
│  lib/projects/unified_store.py                                      │
│  ├── folders table (hierarchical)                                   │
│  ├── files table (metadata)                                         │
│  └── files_search FTS5 (full-text search)                           │
│                                                                     │
│  MinIO Object Storage                                               │
│  └── projects/{project_id}/{filename}                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Folders Table
```sql
CREATE TABLE folders (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    parent_id TEXT,  -- NULL for root folder
    name TEXT NOT NULL,
    path TEXT NOT NULL,  -- e.g., "/Documents/Reports"
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (parent_id) REFERENCES folders(id)
);
```

### Files Table
```sql
CREATE TABLE files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    folder_id TEXT,
    filename TEXT NOT NULL,
    file_type TEXT,  -- 'pdf', 'docx', 'pptx', 'txt', etc.
    file_size INTEGER,
    storage_path TEXT NOT NULL,  -- MinIO path
    metadata TEXT,  -- JSON string
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (folder_id) REFERENCES folders(id)
);

-- FTS5 for full-text search
CREATE VIRTUAL TABLE files_search USING fts5(
    filename,
    content='files',
    tokenize='unicode61'
);
```

---

## API Endpoints

### Folder Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/knowledge/folders` | Create folder (auto-create parent folders) |
| GET | `/knowledge/folders?project_id={id}` | Get folder tree for project |
| PUT | `/knowledge/folders/{id}` | Rename folder |
| DELETE | `/knowledge/folders/{id}` | Delete folder (cascade files) |

### File Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/knowledge/files/upload` | Upload file(s) to folder |
| GET | `/knowledge/files?folder_id={id}` | List files in folder |
| GET | `/knowledge/files/{id}/download` | Get presigned download URL |
| DELETE | `/knowledge/files/{id}` | Delete file |
| GET | `/knowledge/files/search?q={query}` | Search files (FTS5 + LIKE fallback) |

---

## Key Features Implemented

### Phase 1: Backend Core (Complete)
- [x] `folders` table with hierarchical structure
- [x] `files` table with MinIO integration
- [x] FTS5 full-text search with Chinese support (LIKE fallback)
- [x] Folder CRUD operations
- [x] File CRUD operations with presigned URLs

### Phase 2: Project Binding (Complete)
- [x] Auto-create root folder when creating project
- [x] ProjectSelector component
- [x] Project context in file operations

### Phase 3: Frontend Components (Complete)
- [x] FolderTree component (expand/collapse, context menu)
- [x] FileList component (type icons, actions)
- [x] FileUploadZone component (drag-drop, folder upload via webkitdirectory)
- [x] Left-right split layout page

### Phase 4: Auto-save Integration (In Progress)
- [x] Diagnosis PDF auto-save to project root
- [ ] Outline DOCX auto-save
- [ ] PPTX export auto-save

---

## Chinese Search Support

FTS5 with `unicode61` tokenizer doesn't properly segment Chinese characters. Solution:

```python
# lib/projects/unified_store.py
async def search_files(self, query: str, project_id: str, limit: int = 50):
    # Try FTS5 first
    cursor.execute("""
        SELECT f.* FROM files f
        JOIN files_search fs ON f.id = fs.rowid
        WHERE files_search MATCH ?
        ORDER BY f.created_at DESC
        LIMIT ?
    """, (query, limit))

    files = cursor.fetchall()

    # Fallback to LIKE for Chinese characters
    if not files:
        like_query = f"%{query}%"
        cursor.execute("""
            SELECT * FROM files
            WHERE project_id = ? AND filename LIKE ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (project_id, like_query, limit))
        files = cursor.fetchall()

    return files
```

---

## Project Integration Flow

```
1. User creates project → Root folder auto-created
2. User starts diagnosis:
   - Select project in Input page
   - Submit analysis with project_id
   - Redirected to result page with ?project_id=xxx

3. User views result:
   - "Save to Project" button appears when project_id present
   - Button fetches PDF blob → uploads to project root

4. User manages files:
   - Navigate to /knowledge/files
   - Select project → see folder tree
   - Upload/create folders/download files
```

---

## Files Changed

| File | Changes |
|------|---------|
| `backend/lib/projects/unified_store.py` | Added folders/files tables and CRUD methods |
| `backend/api/folders.py` | New - Folder API endpoints |
| `backend/lib/api/files.py` | New - File API endpoints |
| `backend/app/api/router.py` | Registered new routes |
| `components/file-manager/FolderTree.tsx` | New - Folder tree component |
| `components/file-manager/FileList.tsx` | New - File list component |
| `components/file-manager/FileUploadZone.tsx` | New - Upload component |
| `components/project/ProjectSelector.tsx` | New - Project selection dropdown |
| `app/(dashboard)/knowledge/files/page.tsx` | New - File manager page |
| `app/(dashboard)/input/page.tsx` | Added ProjectSelector |
| `app/(dashboard)/result/[id]/page.tsx` | Added save-to-project functionality |
| `backend/app/api/langgraph_diagnosis.py` | Added project_id parameter |

---

## Testing Notes

```bash
# Test folder creation
curl -X POST http://localhost:8000/api/knowledge/folders \
  -H "Content-Type: application/json" \
  -d '{"project_id": "xxx", "name": "Documents"}'

# Test file upload
curl -X POST http://localhost:8000/api/knowledge/files/upload \
  -F "file=@report.pdf" \
  -F "project_id=xxx"

# Test search (Chinese support)
curl "http://localhost:8000/api/knowledge/files/search?q=诊断&project_id=xxx"
```

---

## Next Steps

1. **Outline Auto-save**: Add save-to-project for outline DOCX exports
2. **PPTX Auto-save**: Add save-to-project for presentation exports
3. **File Preview**: Add inline preview for PDFs and images
4. **Batch Operations**: Multi-select for delete/move operations
