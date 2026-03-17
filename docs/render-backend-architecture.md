# 五维诊断系统 - Render 后端架构设计

> 日期: 2026-03-17
> 状态: 设计完成，待实施

## 1. 架构概览

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        用户浏览器                                    │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
          ┌───────────────────────┴───────────────────────┐
          ▼                                               ▼
┌─────────────────────────┐                 ┌─────────────────────────┐
│   Vercel (前端托管)      │                 │   Render (后端服务)      │
│   https://xxx.vercel.app│                 │   https://xxx.onrender.com
│                         │                 │                         │
│   ┌─────────────────┐   │    API 请求    │   ┌─────────────────┐   │
│   │  Next.js 静态页  │◄──┼───────────────┼──►│  FastAPI 后端    │   │
│   │  - /input       │   │                │   │  - /api/upload  │   │
│   │  - /result/[id] │   │                │   │  - /api/analyze │   │
│   │  - /history     │   │                │   │  - /api/export  │   │
│   └─────────────────┘   │                │   └────────┬────────┘   │
│                         │                │            │            │
│   ┌─────────────────┐   │                │   ┌────────▼────────┐   │
│   │  Tremor 图表组件 │   │                │   │  文件处理器      │   │
│   │  - 雷达图        │   │                │   │  - pdf-parse    │   │
│   │  - 柱状图        │   │                │   │  - mammoth      │   │
│   │  - 仪表盘        │   │                │   │  - xlsx         │   │
│   └─────────────────┘   │                │   │  - tesseract    │   │
│                         │                │   └────────┬────────┘   │
└─────────────────────────┘                │            │            │
                                           │   ┌────────▼────────┐   │
                                           │   │  PDF 生成器      │   │
                                           │   │  - Puppeteer    │   │
                                           │   │  - 高质量输出    │   │
                                           │   └────────┬────────┘   │
                                           └────────────┼────────────┘
                                                        │
                                  ┌─────────────────────┴─────────────────────┐
                                  ▼                                           ▼
                        ┌─────────────────────┐                   ┌─────────────────────┐
                        │    Supabase         │                   │    DeepSeek API     │
                        │    (PostgreSQL)     │                   │    (AI 分析)        │
                        │    - diagnosis      │                   │                     │
                        │    - sessions       │                   │                     │
                        └─────────────────────┘                   └─────────────────────┘
```

### 1.2 技术栈选型

| 组件 | 技术 | 理由 |
|------|------|------|
| **后端框架** | FastAPI (Python) | 异步支持、自动文档、类型安全 |
| **文件处理** | pdf-parse, mammoth, xlsx, pytesseract | 成熟稳定，无兼容问题 |
| **PDF 生成** | Puppeteer (Playwright) | 高质量、支持复杂图表、中文 |
| **AI 分析** | DeepSeek API | 国内首选，成本低 |
| **数据库** | Supabase (PostgreSQL) | 免费层够用，成熟稳定 |
| **部署平台** | Render | 支持 Docker，免费层 750h/月 |

---

## 2. API 设计

### 2.1 API 端点列表

| 端点 | 方法 | 功能 | 超时 |
|------|------|------|------|
| `/api/health` | GET | 健康检查 | 5s |
| `/api/upload` | POST | 文件上传与解析 | 60s |
| `/api/analyze` | POST | AI 文本分析 | 120s |
| `/api/diagnosis` | POST | 创建诊断记录 | 10s |
| `/api/diagnosis/{id}` | GET | 获取诊断结果 | 10s |
| `/api/diagnosis` | GET | 获取历史列表 | 10s |
| `/api/export/{id}` | GET | 导出 PDF 报告 | 60s |

### 2.2 API 详细设计

#### 2.2.1 文件上传 `/api/upload`

```python
# 请求
POST /api/upload
Content-Type: multipart/form-data

file: <binary>
type: txt|pdf|docx|xlsx|xls|png|jpg|jpeg

# 响应
{
  "success": true,
  "text": "提取的文本内容...",
  "metadata": {
    "fileName": "report.pdf",
    "fileSize": 1024000,
    "fileType": "pdf",
    "pageCount": 5,
    "isOCR": false
  }
}
```

#### 2.2.2 AI 分析 `/api/analyze`

```python
# 请求
POST /api/analyze
Content-Type: application/json

{
  "text": "原始文本内容..."
}

# 响应
{
  "success": true,
  "data": {
    "strategy": { "score": 72, "label": "战略", ... },
    "structure": { "score": 58, "label": "组织", ... },
    "performance": { "score": 52, "label": "绩效", ... },
    "compensation": { "score": 55, "label": "薪酬", ... },
    "talent": { "score": 50, "label": "人才", ... },
    "overall_score": 57,
    "summary": "整体诊断摘要..."
  },
  "processing_time": 5234
}
```

#### 2.2.3 PDF 导出 `/api/export/{id}`

```python
# 请求
GET /api/export/{session_id}?format=pdf

# 响应
Content-Type: application/pdf
Content-Disposition: attachment; filename="diagnosis-report-{id}.pdf"

<binary PDF data>
```

---

## 3. 后端项目结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 入口
│   ├── config.py               # 配置管理
│   ├── dependencies.py         # 依赖注入
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── router.py           # 路由汇总
│   │   ├── upload.py           # 文件上传
│   │   ├── analyze.py          # AI 分析
│   │   ├── diagnosis.py        # 诊断 CRUD
│   │   └── export.py           # PDF 导出
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── file_parser.py      # 文件解析 (PDF/DOCX/XLSX/OCR)
│   │   ├── ai_extractor.py     # AI 信息抽取
│   │   ├── pdf_generator.py    # PDF 生成 (Puppeteer)
│   │   └── storage.py          # Supabase 存储
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── diagnosis.py        # 数据模型
│   │   └── schemas.py          # Pydantic 模型
│   │
│   └── utils/
│       ├── __init__.py
│       ├── logger.py           # 日志
│       └── helpers.py          # 工具函数
│
├── templates/
│   └── report.html             # PDF 报告模板
│
├── tests/
│   ├── test_upload.py
│   ├── test_analyze.py
│   └── test_export.py
│
├── Dockerfile
├── requirements.txt
├── render.yaml
└── .env.example
```

---

## 4. 核心服务实现

### 4.1 文件解析服务 `services/file_parser.py`

```python
from typing import Optional, Tuple
import pdf_parse
import mammoth
import openpyxl
import pytesseract
from PIL import Image
import io

class FileParser:
    """统一文件解析服务"""

    SUPPORTED_TYPES = {
        'text': ['txt', 'md', 'csv', 'json'],
        'document': ['pdf', 'docx'],
        'spreadsheet': ['xlsx', 'xls'],
        'image': ['png', 'jpg', 'jpeg']
    }

    async def parse(self, file_content: bytes, file_type: str) -> Tuple[str, dict]:
        """解析文件，返回 (文本, 元数据)"""

        if file_type in self.SUPPORTED_TYPES['text']:
            return await self._parse_text(file_content, file_type)

        elif file_type == 'pdf':
            return await self._parse_pdf(file_content)

        elif file_type == 'docx':
            return await self._parse_docx(file_content)

        elif file_type in ['xlsx', 'xls']:
            return await self._parse_excel(file_content, file_type)

        elif file_type in self.SUPPORTED_TYPES['image']:
            return await self._parse_image(file_content, file_type)

        raise ValueError(f"不支持的文件类型: {file_type}")

    async def _parse_pdf(self, content: bytes) -> Tuple[str, dict]:
        """解析 PDF"""
        try:
            data = pdf_parse(content)
            text = data['text'].strip()
            metadata = {
                'pageCount': data.get('numpages', 0),
                'isOCR': False
            }

            if len(text) < 50:
                raise ValueError("PDF 文字内容过少，可能是扫描版")

            return text, metadata
        except Exception as e:
            raise ValueError(f"PDF 解析失败: {str(e)}")

    async def _parse_docx(self, content: bytes) -> Tuple[str, dict]:
        """解析 DOCX"""
        try:
            result = mammoth.extract_raw_text(io.BytesIO(content))
            text = result.value.strip()
            metadata = {'isOCR': False}
            return text, metadata
        except Exception as e:
            raise ValueError(f"DOCX 解析失败: {str(e)}")

    async def _parse_excel(self, content: bytes, file_type: str) -> Tuple[str, dict]:
        """解析 Excel"""
        try:
            wb = openpyxl.load_workbook(io.BytesIO(content))
            texts = []

            for sheet_name in wb.sheetnames:
                sheet = wb[sheet_name]
                texts.append(f"\n【工作表: {sheet_name}】\n")
                for row in sheet.iter_rows(values_only=True):
                    row_text = ' | '.join(str(cell or '') for cell in row)
                    if row_text.strip():
                        texts.append(row_text)

            return '\n'.join(texts), {'sheetCount': len(wb.sheetnames), 'isOCR': False}
        except Exception as e:
            raise ValueError(f"Excel 解析失败: {str(e)}")

    async def _parse_image(self, content: bytes, file_type: str) -> Tuple[str, dict]:
        """OCR 图片识别"""
        try:
            image = Image.open(io.BytesIO(content))
            text = pytesseract.image_to_string(image, lang='chi_sim+eng')
            return text.strip(), {'isOCR': True}
        except Exception as e:
            raise ValueError(f"图片识别失败: {str(e)}")
```

### 4.2 PDF 生成服务 `services/pdf_generator.py`

```python
from playwright.async_api import async_playwright
import os
from jinja2 import Environment, FileSystemLoader

class PDFGenerator:
    """使用 Playwright 生成高质量 PDF"""

    def __init__(self):
        self.template_dir = os.path.join(os.path.dirname(__file__), '../templates')
        self.env = Environment(loader=FileSystemLoader(self.template_dir))

    async def generate_report(self, diagnosis_data: dict, session_id: str) -> bytes:
        """生成诊断报告 PDF"""

        # 1. 渲染 HTML 模板
        template = self.env.get_template('report.html')
        html_content = template.render(
            data=diagnosis_data,
            session_id=session_id,
            generated_at=datetime.now().strftime('%Y-%m-%d %H:%M')
        )

        # 2. 使用 Playwright 生成 PDF
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()

            # 设置内容
            await page.set_content(html_content, wait_until='networkidle')

            # 生成 PDF
            pdf_bytes = await page.pdf(
                format='A4',
                print_background=True,
                margin={
                    'top': '20mm',
                    'right': '15mm',
                    'bottom': '20mm',
                    'left': '15mm'
                }
            )

            await browser.close()

        return pdf_bytes
```

### 4.3 FastAPI 主入口 `app/main.py`

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

from .services.file_parser import FileParser
from .services.ai_extractor import AIExtractor
from .services.pdf_generator import PDFGenerator
from .services.storage import SupabaseStorage

app = FastAPI(
    title="五维诊断 API",
    description="企业组织诊断系统后端",
    version="2.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 服务实例
file_parser = FileParser()
ai_extractor = AIExtractor()
pdf_generator = PDFGenerator()
storage = SupabaseStorage()

@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "service": "org-diagnosis-backend"}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """文件上传与解析"""
    # 检查文件类型
    ext = file.filename.split('.')[-1].lower()
    if ext not in file_parser.get_supported_types():
        raise HTTPException(400, f"不支持的文件格式: .{ext}")

    # 检查文件大小 (20MB)
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(400, "文件大小超过 20MB 限制")

    # 解析文件
    try:
        text, metadata = await file_parser.parse(content, ext)
        return {
            "success": True,
            "text": text,
            "metadata": {
                "fileName": file.filename,
                "fileSize": len(content),
                "fileType": ext,
                **metadata
            }
        }
    except ValueError as e:
        return {"success": False, "error": str(e)}

class AnalyzeRequest(BaseModel):
    text: str

@app.post("/api/analyze")
async def analyze_text(request: AnalyzeRequest):
    """AI 文本分析"""
    if len(request.text) < 50:
        raise HTTPException(400, "文本长度不足 50 字符")

    try:
        result = await ai_extractor.extract(request.text)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/export/{session_id}")
async def export_pdf(session_id: str):
    """导出 PDF 报告"""
    # 获取诊断数据
    diagnosis = await storage.get_diagnosis(session_id)
    if not diagnosis:
        raise HTTPException(404, "诊断记录不存在")

    # 生成 PDF
    pdf_bytes = await pdf_generator.generate_report(diagnosis, session_id)

    # 返回 PDF
    from fastapi.responses import Response
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=diagnosis-{session_id[:8]}.pdf"
        }
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 5. 部署配置

### 5.1 Dockerfile

```dockerfile
FROM python:3.11-slim

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# 安装 Playwright 依赖
RUN playwright install-deps chromium

WORKDIR /app

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 安装 Playwright 浏览器
RUN playwright install chromium

# 复制代码
COPY . .

# 启动
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 5.2 requirements.txt

```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6
pydantic==2.5.3

# 文件处理
pdf-parse==1.0.0
mammoth==1.6.0
openpyxl==3.1.2
pytesseract==0.3.10
Pillow==10.2.0

# PDF 生成
playwright==1.41.0
jinja2==3.1.3

# 数据库
supabase==2.3.0

# AI
httpx==0.26.0

# 工具
python-dotenv==1.0.0
```

### 5.3 render.yaml

```yaml
services:
  - type: web
    name: org-diagnosis-backend
    env: docker
    region: singapore
    plan: free
    dockerfilePath: ./Dockerfile
    envVars:
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
      - key: DEEPSEEK_API_KEY
        sync: false
      - key: PYTHON_VERSION
        value: 3.11.0
    healthCheckPath: /api/health
```

---

## 6. 前端适配

### 6.1 修改 API 地址

```typescript
// lib/api-config.ts
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://org-diagnosis-backend.onrender.com'
  : 'http://localhost:8000';

export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  return response.json();
}

export async function analyzeText(text: string) {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  return response.json();
}

export async function exportPDF(sessionId: string) {
  window.open(`${API_BASE_URL}/api/export/${sessionId}`, '_blank');
}
```

### 6.2 移除客户端文件处理

```typescript
// lib/reliable-upload.ts - 简化版
export async function reliableFileUpload(file: File): Promise<UploadResult> {
  // 直接调用后端 API，不再客户端处理
  return uploadFile(file);
}
```

---

## 7. 实施计划

### Phase 1: 后端搭建 (1-2天)

- [ ] 创建 FastAPI 项目结构
- [ ] 实现文件解析服务
- [ ] 实现 AI 分析服务
- [ ] 配置 Supabase 连接

### Phase 2: PDF 导出 (1天)

- [ ] 安装配置 Playwright
- [ ] 创建 PDF 报告模板
- [ ] 实现 PDF 生成服务

### Phase 3: 部署 (0.5天)

- [ ] 创建 Dockerfile
- [ ] 部署到 Render
- [ ] 配置环境变量
- [ ] 测试 API 连通性

### Phase 4: 前端适配 (0.5天)

- [ ] 修改 API 调用地址
- [ ] 移除客户端文件处理代码
- [ ] 测试完整流程

### Phase 5: 验收测试 (0.5天)

- [ ] 文件上传测试 (PDF/DOCX/XLSX/图片)
- [ ] AI 分析测试
- [ ] PDF 导出测试
- [ ] 性能测试

---

## 8. 预期收益

| 指标 | Vercel (现状) | Render (目标) |
|------|--------------|---------------|
| 文件上传成功率 | ~30% | **99%+** |
| PDF 导出成功率 | 0% | **99%+** |
| 处理速度 | 慢 (有超时风险) | **快 (无限制)** |
| 支持文件大小 | 4-10MB | **20MB+** |
| PDF 质量 | 低 (html2canvas) | **高 (Puppeteer)** |

---

## 9. 风险与对策

| 风险 | 对策 |
|------|------|
| Render 冷启动 | 使用健康检查保活，或升级付费计划 |
| Playwright 内存占用 | 限制并发 PDF 生成数量 |
| 跨域问题 | 正确配置 CORS |

---

## 附录：PDF 报告模板

```html
<!-- templates/report.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>五维诊断报告</title>
    <style>
        body { font-family: 'SimSun', serif; padding: 20mm; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .score-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 20px 0; }
        .score-card { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .score-value { font-size: 36px; font-weight: bold; }
        .score-low { color: #ef4444; }
        .score-medium { color: #f59e0b; }
        .score-high { color: #10b981; }
        .section { margin: 30px 0; }
        .section-title { font-size: 18px; font-weight: bold; border-left: 4px solid #3b82f6; padding-left: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>五维组织诊断报告</h1>
        <p>生成时间: {{ generated_at }}</p>
        <p>报告编号: {{ session_id }}</p>
    </div>

    <div class="score-grid">
        {% for dim in ['strategy', 'structure', 'performance', 'compensation', 'talent'] %}
        <div class="score-card">
            <div class="score-value score-{% if data[dim].score < 60 %}low{% elif data[dim].score < 80 %}medium{% else %}high{% endif %}">
                {{ data[dim].score }}
            </div>
            <div>{{ data[dim].label }}</div>
        </div>
        {% endfor %}
    </div>

    <div class="section">
        <div class="section-title">整体评估</div>
        <p>{{ data.summary }}</p>
    </div>

    {% for dim in ['strategy', 'structure', 'performance', 'compensation', 'talent'] %}
    <div class="section">
        <div class="section-title">{{ data[dim].label }} ({{ data[dim].score }}分)</div>
        <p>{{ data[dim].description }}</p>
    </div>
    {% endfor %}
</body>
</html>
```
