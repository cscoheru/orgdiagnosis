# 知识库文件管理器设计文档

> Created: 2026-03-23
> Status: Approved

---

## 概述

为知识库增加文件管理器功能，支持：
- 完全自由的文件夹层级结构
- 与项目绑定，新建项目自动创建根文件夹
- 五维诊断、需求录入、大纲生成、PPTX导出自动保存到项目根目录
- 支持文件夹整体上传，保留完整目录结构

---

## 需求确认

| 需求项 | 用户选择 |
|--------|----------|
| 文件夹结构 | 完全自由 - 支持任意层级 |
| 自动保存路径 | 统一保存到项目根目录 |
| 文件夹上传 | 保留完整目录结构 |
| MinIO映射 | 独立文件夹表 + 文件表 |
| UI布局 | 左右分栏布局 |

---

## 数据模型

### folders 表

```sql
CREATE TABLE folders (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    path TEXT NOT NULL,              -- 完整路径，如: /诊断资料/原始数据
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_folders_project ON folders(project_id);
CREATE INDEX idx_folders_parent ON folders(parent_id);
```

### files 表 (扩展现有 documents)

```sql
-- 扩展 documents 表，添加 folder_id 字段
ALTER TABLE documents ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL;

-- 或创建新的 files 表
CREATE TABLE files (
    id TEXT PRIMARY KEY,
    folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT,
    minio_path TEXT NOT NULL,       -- MinIO 对象路径
    size INTEGER,
    metadata TEXT,                   -- JSON 元数据
    source_type TEXT,                -- upload/diagnosis/outline/pptx
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_files_folder ON files(folder_id);
```

### MinIO 存储路径规范

```
projects/{project_id}/                    -- 项目根目录
projects/{project_id}/诊断报告_20260323.pdf
projects/{project_id}/需求大纲_20260323.docx
projects/{project_id}/演示文稿_20260323.pptx
projects/{project_id}/上传文件/                   -- 用户上传的文件
projects/{project_id}/上传文件/子文件夹/xxx.pdf
```

---

## API 端点

### 文件夹操作

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/knowledge/folders` | 创建文件夹 |
| GET | `/knowledge/folders?project_id={id}` | 获取项目文件夹树 |
| PUT | `/knowledge/folders/{id}` | 重命名/移动文件夹 |
| DELETE | `/knowledge/folders/{id}` | 删除文件夹(含子内容) |

### 文件操作

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/knowledge/files/upload` | 上传文件(支持文件夹结构) |
| GET | `/knowledge/files?folder_id={id}` | 获取文件夹内文件 |
| DELETE | `/knowledge/files/{id}` | 删除文件 |
| GET | `/knowledge/files/{id}/download` | 下载文件 |

### 自动保存接口

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/knowledge/auto-save/diagnosis` | 保存诊断结果PDF |
| POST | `/knowledge/auto-save/outline` | 保存大纲DOCX |
| POST | `/knowledge/auto-save/pptx` | 保存导出的PPTX |

### 请求/响应示例

**创建文件夹:**
```json
POST /knowledge/folders
{
  "project_id": "proj_123",
  "parent_id": null,  // null = 根目录
  "name": "诊断资料"
}

Response:
{
  "id": "folder_456",
  "project_id": "proj_123",
  "parent_id": null,
  "name": "诊断资料",
  "path": "/诊断资料"
}
```

**上传文件(带文件夹结构):**
```json
POST /knowledge/files/upload
Content-Type: multipart/form-data

project_id: proj_123
folder_path: /上传文件/参考资料
files: [File1, File2, ...]

Response:
{
  "uploaded": 2,
  "files": [
    {"id": "file_1", "filename": "xxx.pdf", "folder_id": "folder_789"},
    {"id": "file_2", "filename": "yyy.docx", "folder_id": "folder_789"}
  ]
}
```

---

## 前端组件架构

### 新建组件

```
components/file-manager/
├── FolderTree.tsx           # 左侧文件夹树组件
├── FileList.tsx             # 右侧文件列表组件
├── FileUploadZone.tsx       # 拖拽上传区域
├── Breadcrumb.tsx           # 路径面包屑
├── CreateFolderModal.tsx    # 新建文件夹弹窗
└── index.ts                 # 导出
```

### 修改组件

- `app/(dashboard)/knowledge/upload/page.tsx` - 添加文件夹上传支持
- `app/(dashboard)/projects/page.tsx` - 新建项目时自动创建根文件夹

### 新建页面

- `app/(dashboard)/knowledge/files/page.tsx` - 文件管理器主页面

### 页面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  📁 文件管理器                                    [上传] [新建文件夹] │
├────────────────┬────────────────────────────────────────────────┤
│                │  📂 /项目A                                     │
│  📁 项目A       │  ─────────────────────────────────────────────│
│  ├─ 📁 诊断资料  │  │ 📄 诊断报告_0323.pdf    1.2MB  03-23     │
│  ├─ 📁 需求大纲  │  │ 📄 需求大纲_0323.docx   856KB  03-23     │
│  └─ 📁 导出文件  │  │ 📊 演示文稿_0323.pptx   3.5MB  03-23     │
│                │  │                                        │
│  📁 项目B       │  └────────────────────────────────────────────┘
│  └─ ...         │
└────────────────┴────────────────────────────────────────────────┘
```

---

## 自动保存流程

### 五维诊断完成

```
1. 用户完成五维诊断
2. 系统生成诊断报告PDF
3. 调用 POST /knowledge/auto-save/diagnosis
   {
     "project_id": "proj_123",
     "filename": "诊断报告_20260323.pdf",
     "content": "<base64 PDF data>"
   }
4. 后端:
   - 获取/创建项目根文件夹
   - 上传到 MinIO: projects/proj_123/诊断报告_20260323.pdf
   - 创建 file 记录
5. 返回: {"file_id": "xxx", "path": "/诊断报告_20260323.pdf"}
```

### 大纲生成完成

```
1. 用户完成大纲编辑
2. 系统导出DOCX
3. 调用 POST /knowledge/auto-save/outline
4. 保存到项目根目录
```

### PPTX导出完成

```
1. 用户导出PPTX
2. 调用 POST /knowledge/auto-save/pptx
3. 保存到项目根目录
```

---

## 文件夹上传实现

### 前端实现

```typescript
// 使用 webkitdirectory 属性支持文件夹选择
<input
  type="file"
  webkitdirectory=""
  directory=""
  multiple
  onChange={handleFolderUpload}
/>

// 处理文件夹上传
async function handleFolderUpload(e: ChangeEvent<HTMLInputElement>) {
  const files = Array.from(e.target.files);

  // 提取文件夹结构
  const structure = extractFolderStructure(files);

  // 发送到后端
  await fetch('/knowledge/files/upload', {
    method: 'POST',
    body: formData // 包含 project_id, folder_path, files
  });
}
```

### 后端实现

```python
@router.post("/files/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    project_id: str = Form(...),
    folder_path: str = Form(default="/")
):
    """
    支持文件夹上传
    1. 解析 folder_path 创建文件夹层级
    2. 上传文件到 MinIO
    3. 创建 file 记录
    """
    pass
```

---

## 实施步骤

### Phase 1: 数据层 (1-2天)
1. 创建 folders 表
2. 创建 files 表或扩展 documents 表
3. 实现文件夹 CRUD API
4. 实现文件 CRUD API

### Phase 2: 存储层 (1天)
1. 更新 MinIO 客户端支持项目路径
2. 实现文件夹上传逻辑
3. 实现自动保存逻辑

### Phase 3: 前端组件 (2-3天)
1. 创建 file-manager 组件
2. 实现文件夹树组件
3. 实现文件列表组件
4. 实现拖拽上传

### Phase 4: 集成 (1天)
1. 新建项目自动创建根文件夹
2. 五维诊断自动保存
3. 大纲生成自动保存
4. PPTX导出自动保存

---

## 验收标准

- [ ] 新建项目时自动创建根文件夹
- [ ] 文件夹树正确显示层级结构
- [ ] 支持创建/重命名/删除文件夹
- [ ] 支持文件上传(单个和批量)
- [ ] 支持文件夹整体上传，保留目录结构
- [ ] 五维诊断完成后自动保存PDF到项目根目录
- [ ] 大纲生成后自动保存DOCX到项目根目录
- [ ] PPTX导出后自动保存到项目根目录
- [ ] 文件预览功能正常工作
