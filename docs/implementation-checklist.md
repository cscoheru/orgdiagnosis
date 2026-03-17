# 后端迁移实施清单

> 创建时间: 2026-03-17
> 预计工期: 3-4 天

## Phase 1: 后端项目初始化

- [ ] 创建 `backend/` 目录
- [ ] 初始化 Python 虚拟环境
- [ ] 创建 `requirements.txt`
- [ ] 创建 FastAPI 项目结构
- [ ] 配置环境变量 `.env`

## Phase 2: 核心服务开发

### 文件解析服务
- [ ] 实现 PDF 解析 (`pdf-parse`)
- [ ] 实现 DOCX 解析 (`mammoth`)
- [ ] 实现 Excel 解析 (`openpyxl`)
- [ ] 实现图片 OCR (`pytesseract`)
- [ ] 统一错误处理

### AI 分析服务
- [ ] 集成 DeepSeek API
- [ ] 实现 Prompt 工程
- [ ] 实现 JSON 解析与验证
- [ ] 添加超时控制

### 存储服务
- [ ] 配置 Supabase 连接
- [ ] 实现诊断记录 CRUD
- [ ] 实现历史记录查询

### PDF 生成服务
- [ ] 安装 Playwright
- [ ] 创建 HTML 报告模板
- [ ] 实现 PDF 生成
- [ ] 测试中文支持

## Phase 3: API 端点开发

- [ ] `GET /api/health` - 健康检查
- [ ] `POST /api/upload` - 文件上传
- [ ] `POST /api/analyze` - AI 分析
- [ ] `POST /api/diagnosis` - 创建记录
- [ ] `GET /api/diagnosis/{id}` - 获取结果
- [ ] `GET /api/diagnosis` - 历史列表
- [ ] `GET /api/export/{id}` - PDF 导出

## Phase 4: 部署配置

- [ ] 创建 `Dockerfile`
- [ ] 创建 `render.yaml`
- [ ] 配置 Render 环境变量
- [ ] 部署到 Render
- [ ] 验证 API 健康检查

## Phase 5: 前端适配

- [ ] 创建 `lib/api-config.ts`
- [ ] 修改文件上传调用后端 API
- [ ] 修改 AI 分析调用后端 API
- [ ] 修改 PDF 导出调用后端 API
- [ ] 移除客户端文件处理代码

## Phase 6: 测试验证

### 文件上传测试
- [ ] PDF 文件上传
- [ ] DOCX 文件上传
- [ ] XLSX 文件上传
- [ ] 图片 OCR 上传
- [ ] 大文件测试 (10MB+)
- [ ] 错误格式测试

### AI 分析测试
- [ ] 短文本分析
- [ ] 长文本分析 (10000+ 字)
- [ ] 特殊字符处理
- [ ] 超时处理

### PDF 导出测试
- [ ] 下载功能
- [ ] 中文显示
- [ ] 图表渲染
- [ ] 文件大小

### 端到端测试
- [ ] 完整诊断流程
- [ ] 历史记录查看
- [ ] PDF 报告导出

## 环境变量清单

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx

# DeepSeek
DEEPSEEK_API_KEY=xxx
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions

# 应用配置
APP_ENV=production
CORS_ORIGINS=https://xxx.vercel.app
```

## 关键文件清单

```
backend/
├── app/
│   ├── main.py              # 入口
│   ├── config.py            # 配置
│   ├── api/
│   │   ├── router.py
│   │   ├── upload.py
│   │   ├── analyze.py
│   │   ├── diagnosis.py
│   │   └── export.py
│   ├── services/
│   │   ├── file_parser.py
│   │   ├── ai_extractor.py
│   │   ├── pdf_generator.py
│   │   └── storage.py
│   └── models/
│       └── schemas.py
├── templates/
│   └── report.html
├── Dockerfile
├── requirements.txt
├── render.yaml
└── .env.example
```

## 验收标准

| 功能 | 标准 |
|------|------|
| 文件上传 | PDF/DOCX/XLSX/图片 均成功解析 |
| AI 分析 | 60秒内返回结果 |
| PDF 导出 | 生成完整报告，中文正常 |
| 响应时间 | API < 5s，分析 < 60s |
| 可用性 | 99%+ |
