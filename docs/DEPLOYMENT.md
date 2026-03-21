# DeepConsult Copilot - 部署指南

> 更新日期: 2026-03-21

---

## 架构概览

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Vercel       │     │    Render       │     │    Supabase     │
│   (前端托管)     │────▶│   (后端 API)    │────▶│   (数据库)       │
│  org-diagnosis  │     │ org-diagnosis   │     │   supabase.co   │
│   .vercel.app   │     │  -api.onrender  │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 1. 后端部署 (Render)

### 1.1 前置条件

- GitHub 账号
- Render 账号 (https://dashboard.render.com)
- Supabase 项目已创建

### 1.2 部署步骤

1. **推送代码到 GitHub**

```bash
cd /Users/kjonekong/Documents/org-diagnosis
git add .
git commit -m "feat: prepare for production deployment"
git push origin frontend
```

2. **在 Render 创建服务**

   - 访问 https://dashboard.render.com
   - 点击 "New +" → "Web Service"
   - 连接 GitHub 仓库
   - 选择 `org-diagnosis` 仓库
   - 设置:
     - **Name**: `org-diagnosis-api`
     - **Region**: Singapore
     - **Branch**: `frontend`
     - **Root Directory**: `backend`
     - **Runtime**: Docker
     - **Dockerfile Path**: `./Dockerfile`

3. **配置环境变量**

   在 Render Dashboard → Environment 中添加:

   | 变量名 | 值 |
   |--------|-----|
   | `SUPABASE_URL` | `https://yyyjnrgntymobpbgfswe.supabase.co` |
   | `SUPABASE_ANON_KEY` | (从 Supabase 获取) |
   | `DEEPSEEK_API_KEY` | `sk-847f678c6aeb4aa6a3dd7058f3fd3796` |
   | `CORS_ORIGINS` | `*` |

4. **部署**

   - 点击 "Create Web Service"
   - 等待构建完成 (约 5-10 分钟)

5. **验证**

```bash
curl https://org-diagnosis-api.onrender.com/health
# 期望: {"status": "ok"}
```

---

## 2. 前端部署 (Vercel)

### 2.1 前置条件

- Vercel 账号 (https://vercel.com)
- GitHub 仓库已连接

### 2.2 部署步骤

1. **在 Vercel 导入项目**

   - 访问 https://vercel.com/new
   - 选择 `org-diagnosis` 仓库
   - 设置:
     - **Framework Preset**: Next.js
     - **Root Directory**: `./` (默认)
     - **Build Command**: `npm run build`
     - **Output Directory**: `.next` (默认)

2. **配置环境变量**

   在 Vercel Dashboard → Settings → Environment Variables:

   | 变量名 | 值 |
   |--------|-----|
   | `NEXT_PUBLIC_API_URL` | `https://org-diagnosis-api.onrender.com` |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://yyyjnrgntymobpbgfswe.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (从 Supabase 获取) |

3. **部署**

   - 点击 "Deploy"
   - 等待构建完成 (约 2-3 分钟)

4. **获取域名**

   Vercel 会自动分配域名，如:
   - `https://org-diagnosis.vercel.app`
   - 或自定义域名

---

## 3. 阿里云部署 (可选)

### 3.1 服务器准备

```bash
# SSH 登录
ssh hk-jump

# 创建项目目录
mkdir -p /opt/org-diagnosis
cd /opt/org-diagnosis
```

### 3.2 Docker Compose 部署

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - SUPABASE_URL=https://yyyjnrgntymobpbgfswe.supabase.co
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
      - CORS_ORIGINS=*
    restart: unless-stopped
```

启动服务:

```bash
docker-compose up -d --build
```

### 3.3 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name api.org-diagnosis.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 4. 验证清单

### 4.1 后端健康检查

```bash
# 健康检查
curl https://org-diagnosis-api.onrender.com/health

# API 文档
open https://org-diagnosis-api.onrender.com/docs

# 测试报告生成
curl -X POST https://org-diagnosis-api.onrender.com/api/report/start \
  -H "Content-Type: application/json" \
  -d '{
    "requirement": {
      "client_name": "测试公司",
      "industry": "制造业",
      "industry_background": "测试背景",
      "company_intro": "测试介绍",
      "core_pain_points": ["痛点1"],
      "project_goals": ["目标1"],
      "phase_planning": [],
      "main_tasks": [],
      "deliverables": []
    }
  }'
```

### 4.2 前端功能测试

1. 访问前端 URL
2. 测试需求录入表单
3. 测试报告生成流程
4. 测试 Layout 编辑器
5. 测试 PPTX 导出

---

## 5. 常见问题

### 5.1 Render 冷启动

Render 免费层在 15 分钟无请求后会休眠，首次请求可能需要 30-60 秒。

**解决方案**: 使用定时 ping 服务或升级到付费计划。

### 5.2 CORS 错误

确认后端 `CORS_ORIGINS` 包含前端域名:

```python
CORS_ORIGINS: list = ["*"]  # 允许所有来源
```

### 5.3 环境变量未生效

在 Vercel/Render 修改环境变量后，需要重新部署才能生效。

---

## 6. 回滚

### Vercel 回滚

```bash
vercel rollback
```

### Render 回滚

在 Render Dashboard → Manual Deploy → 选择之前的 commit

---

## 7. 监控

### 日志查看

```bash
# Render 日志
# Dashboard → Logs

# Vercel 日志
# Dashboard → Deployments → 选择部署 → Logs
```

### 性能监控

- Vercel Analytics (内置)
- Render Metrics (Dashboard)

---

*部署指南由 Claude Code 生成*
