# Org-Diagnosis 部署方案 v2.0

> 更新日期: 2026-03-28
> 架构: Vercel (前端) + HK Docker (后端) + Supabase (用户) + ArangoDB/MinIO (复用)

---

## 1. 架构总览

```
                    ┌─────────────┐
                    │   Vercel    │  Next.js 前端
                    │  (hkg1)     │  自动部署
                    └──────┬──────┘
                           │ HTTPS
                    ┌──────▼──────┐
                    │  Nginx      │  反向代理 + SSL
                    │  :443/:80   │  HK 103.59.103.85
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌──▼────┐ ┌─────▼──────┐
       │  API 容器    │ │ArangoDB│ │   MinIO    │
       │  :8000      │ │ :8529  │ │  :9000     │
       │  FastAPI    │ │ 知识图谱│ │  文件存储   │
       └──────┬──────┘ └────────┘ └────────────┘
              │
       ┌──────▼──────┐
       │  Supabase   │  用户认证 + 项目管理
       │  (云端托管)  │  无需本地部署
       └─────────────┘
```

### 与 v1 方案的变化

| 组件 | v1 (旧方案) | v2 (新方案) | 原因 |
|------|------------|------------|------|
| 前端 | Vercel | Vercel (不变) | CDN + 自动部署，无需改动 |
| 后端 API | Render (新加坡) | **HK Docker** | 与 ArangoDB/MinIO 同网络，延迟从 ~80ms 降到 <1ms |
| ArangoDB | 未启用 (demo 模式) | **HK 复用现有实例** | ConsultingOS Kernel 生产模式 |
| MinIO | 未启用 | **HK 复用现有实例** | 文件存储持久化 |
| Supabase | Vercel 直连 | HK 后端直连 | 不变，后端需要项目数据 |
| Redis | 无 | 复用现有 (可选) | 缓存 AI 响应、会话 |

---

## 2. 网络拓扑

### 2.1 HK 节点容器网络

当前 HK 节点上 ArangoDB 和 MinIO 使用不同的 Docker 网络：

| 容器 | 网络 | IP | 端口 |
|------|------|-----|------|
| arangodb | bridge (默认) | 172.17.0.4 | 8529 |
| minio | bridge (默认) | 172.18.0.5 | 9000/9001 |
| nginx-gateway | bridge (默认) | - | 80/443 |
| redis | cb-network | 172.22.0.3 | 6379 |

**关键决策**: org-diagnosis API 容器加入 `bridge` 网络，即可直接通过容器名 `arangodb` 和 `minio` 访问服务。

### 2.2 端口规划

| 服务 | 端口 | 用途 |
|------|------|------|
| nginx-gateway | 80/443 | 唯一对外入口 |
| org-diagnosis-api | 8000 (内部) | 后端 API |
| arangodb | 8529 (内部) | 数据库 |
| minio | 9000/9001 (内部) | 文件存储 / 控制台 |

> 所有服务仅通过 nginx 对外暴露，不直接映射端口到宿主机。

---

## 3. 服务详情

### 3.1 ArangoDB (复用)

```
容器名: arangodb
网络: bridge
IP: 172.17.0.4
端口: 8529
用户: root
密码: Fisheros@2024
```

**org-diagnosis 专用配置**:
- 数据库名: `org_diagnosis` (新建)
- Collections: `sys_meta_models`, `sys_objects`, `sys_templates`, `sys_relations`

**初始化**:
```bash
# SSH 到 HK 节点，创建专用数据库
ssh hk-jump
docker exec -it arangodb arangosh --server.endpoint tcp://localhost:8529 --server.username root --server.password 'Fisheros@2024'

# 在 arangosh 中:
db._createDatabase("org_diagnosis");
db._useDatabase("org_diagnosis");
db._create("sys_meta_models");
db._create("sys_objects");
db._create("sys_templates");
db._create("sys_relations");
```

### 3.2 MinIO (复用)

```
容器名: minio
网络: bridge
IP: 172.18.0.5
端口: 9000 (API) / 9001 (Console)
用户: minioadmin
密码: MinioPwd2026HK
```

**org-diagnosis 专用配置**:
- Bucket: `org-diagnosis` (新建)
- 访问策略: private (通过预签名 URL 访问)

**初始化**:
```bash
ssh hk-jump
# 安装 mc 客户端 (如果没有)
docker exec -it minio mc alias set local http://localhost:9000 minioadmin MinioPwd2026HK
docker exec -it minio mc mb local/org-diagnosis
docker exec -it minio mc anonymous set none local/org-diagnosis
```

### 3.3 后端 API 容器 (新建)

```
容器名: org-diagnosis-api
网络: bridge (与 arangodb, minio 同网络)
端口: 8000 (仅内部访问)
镜像: 本地构建
```

### 3.4 Nginx (修改配置)

在现有 nginx-gateway 中添加 org-diagnosis 路由规则。

---

## 4. 部署步骤

### 4.1 在 HK 节点准备代码

```bash
# SSH 到 HK
ssh hk-jump

# 创建项目目录
mkdir -p /opt/org-diagnosis
cd /opt/org-diagnosis

# 克隆代码 (或从本地上传)
# 方式 A: Git clone
git clone <repo-url> .

# 方式 B: 从本地上传
# 在本地执行:
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '__pycache__' \
  -e "ssh -J hk-jump" \
  /Users/kjonekong/Documents/org-diagnosis/backend/ \
  root@103.59.103.85:/opt/org-diagnosis/backend/
```

### 4.2 配置环境变量

```bash
ssh hk-jump
cd /opt/org-diagnosis/backend

# 创建 .env 文件
cat > .env << 'EOF'
# 应用
DEBUG=false
CORS_ORIGINS=https://org-diagnosis.3strategy.cc,http://localhost:3000

# Supabase
SUPABASE_URL=https://yyyjnrgntymobpbgfswe.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# AI - DashScope
DASHSCOPE_API_KEY=your-dashscope-key
AI_PROVIDER=dashscope

# AI - DeepSeek (备用)
DEEPSEEK_API_KEY=your-deepseek-key

# ConsultingOS Kernel - 生产模式
KERNEL_MODE=production
ARANGO_HOST=arangodb
ARANGO_PORT=8529
ARANGO_USER=root
ARANGO_PASSWORD=Fisheros@2024
ARANGO_DATABASE=org_diagnosis

# MinIO 文件存储
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=MinioPwd2026HK
MINIO_BUCKET=org-diagnosis
EOF
```

### 4.3 构建并启动容器

```bash
ssh hk-jump
cd /opt/org-diagnosis/backend

# 构建 Docker 镜像
docker build -t org-diagnosis-api:latest .

# 启动容器 (加入 bridge 网络)
docker run -d \
  --name org-diagnosis-api \
  --restart unless-stopped \
  --network bridge \
  -p 127.0.0.1:8000:8000 \
  --env-file .env \
  -v /opt/org-diagnosis/data:/app/data \
  org-diagnosis-api:latest

# 验证启动
docker logs org-diagnosis-api --tail 20
curl http://localhost:8000/health
```

### 4.4 配置 Nginx 反向代理

```bash
ssh hk-jump

# 创建 nginx 配置
docker exec nginx-gateway bash -c 'cat > /etc/nginx/conf.d/org-diagnosis.conf << EOF
server {
    listen 80;
    server_name org-diagnosis.3strategy.cc;

    # API 代理
    location / {
        proxy_pass http://org-diagnosis-api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;

        # WebSocket 支持 (SSE 流式响应)
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;

        # 超时 (AI 请求可能较长)
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        # 文件上传大小
        client_max_body_size 25M;
    }
}
EOF'

# 测试并重载
docker exec nginx-gateway nginx -t
docker exec nginx-gateway nginx -s reload
```

### 4.5 配置 DNS

```
# 在域名 DNS 管理面板添加 A 记录:
org-diagnosis.3strategy.cc → 103.59.103.85

# 或 CNAME 记录 (如果有):
org-diagnosis.3strategy.cc → hk.3strategy.cc
```

### 4.6 配置 SSL (Let's Encrypt)

如果 nginx-gateway 已配置 certbot 或使用通配符证书：

```bash
ssh hk-jump
# 如果使用通配符证书 *.3strategy.cc，已在现有 nginx 中配置
# 只需确认 nginx 配置中包含 SSL 相关指令

# 如果需要单独申请:
docker exec nginx-gateway certbot --nginx -d org-diagnosis.3strategy.cc
```

### 4.7 更新前端 API 地址

```bash
# 在本地修改 vercel.json
# NEXT_PUBLIC_API_URL 从 Render 改为 HK 域名

# 方式 A: 修改 vercel.json
{
  "env": {
    "NEXT_PUBLIC_API_URL": "https://org-diagnosis.3strategy.cc"
  }
}

# 方式 B: 在 Vercel Dashboard 环境变量中修改
# Vercel → Settings → Environment Variables
# NEXT_PUBLIC_API_URL = https://org-diagnosis.3strategy.cc
```

---

## 5. 初始化数据

### 5.1 ArangoDB 数据库

```bash
ssh hk-jump
docker exec -it arangodb arangosh \
  --server.endpoint tcp://localhost:8529 \
  --server.username root \
  --server.password 'Fisheros@2024' \
  --javascript.execute - << 'EOF'
// 创建数据库
db._createDatabase("org_diagnosis");
db._useDatabase("org_diagnosis");

// 创建集合
db._create("sys_meta_models", { waitForSync: true });
db._create("sys_objects", { waitForSync: true });
db._create("sys_templates", { waitForSync: true });
db._create("sys_relations", { waitForSync: true });

// 创建索引
db.sys_objects.ensureIndex({ type: "persistent", fields: ["_key", "name", "meta_model_id"] });
db.sys_relations.ensureIndex({ type: "persistent", fields: ["_from", "_to", "relation_type"] });

print("org_diagnosis 数据库初始化完成!");
EOF
```

### 5.2 MinIO Bucket

```bash
ssh hk-jump
docker exec -it minio sh -c '
mc alias set local http://localhost:9000 minioadmin MinioPwd2026HK
mc mb local/org-diagnosis --ignore-existing
mc anonymous set none local/org-diagnosis
echo "Bucket org-diagnosis 创建完成"
'
```

---

## 6. 更新部署 (CI/CD)

### 6.1 手动更新

```bash
# 本地 → HK 节点
rsync -avz --exclude '__pycache__' --exclude '.venv' \
  -e "ssh -J hk-jump" \
  /Users/kjonekong/Documents/org-diagnosis/backend/ \
  root@103.59.103.85:/opt/org-diagnosis/backend/

# 重建并重启
ssh hk-jump "cd /opt/org-diagnosis/backend && \
  docker build -t org-diagnosis-api:latest . && \
  docker restart org-diagnosis-api"
```

### 6.2 一键部署脚本 (deploy.sh)

```bash
#!/bin/bash
# 在项目根目录执行
# Usage: ./deploy.sh [branch]

BRANCH=${1:-frontend}
LOCAL_BACKEND="/Users/kjonekong/Documents/org-diagnosis/backend"
REMOTE="root@103.59.103.85"
REMOTE_DIR="/opt/org-diagnosis/backend"

echo ">>> 同步代码到 HK..."
rsync -avz --delete \
  --exclude '__pycache__' \
  --exclude '.venv' \
  --exclude 'data/' \
  --exclude '.env' \
  -e "ssh -J hk-jump" \
  "$LOCAL_BACKEND/" \
  "${REMOTE}:${REMOTE_DIR}/"

echo ">>> 构建镜像..."
ssh hk-jump "cd ${REMOTE_DIR} && docker build -t org-diagnosis-api:latest ."

echo ">>> 重启容器..."
ssh hk-jump "docker restart org-diagnosis-api"

echo ">>> 检查健康..."
sleep 5
ssh hk-jump "curl -sf http://localhost:8000/health && echo 'OK' || echo 'FAILED'"

echo ">>> 完成!"
```

---

## 7. 监控与维护

### 7.1 常用命令

```bash
# 查看容器状态
ssh hk-jump "docker ps --filter 'name=org-diagnosis-api'"

# 查看日志
ssh hk-jump "docker logs org-diagnosis-api --tail 50 -f"

# 重启
ssh hk-jump "docker restart org-diagnosis-api"

# 查看资源占用
ssh hk-jump "docker stats org-diagnosis-api --no-stream"
```

### 7.2 健康检查

```bash
# API 健康检查
curl https://org-diagnosis.3strategy.cc/health

# ArangoDB 连通性
curl https://org-diagnosis.3strategy.cc/api/v1/kernel/status

# 端到端测试
curl https://org-diagnosis.3strategy.cc/api/v1/projects
```

### 7.3 数据备份

```bash
# ArangoDB 备份
ssh hk-jump "docker exec arangodb arangodump \
  --server.endpoint tcp://localhost:8529 \
  --server.username root \
  --server.password 'Fisheros@2024' \
  --database org_diagnosis \
  --output /tmp/backup/org-diagnosis-$(date +%Y%m%d)"

# MinIO 备份 (mc mirror)
ssh hk-jump "docker exec minio mc mirror local/org-diagnosis /tmp/backup/minio-org-diagnosis-$(date +%Y%m%d)"
```

---

## 8. 回滚方案

如果新版本有问题：

```bash
# 方式 A: 使用旧镜像重启
ssh hk-jump "docker tag org-diagnosis-api:latest org-diagnosis-api:rollback-$(date +%Y%m%d)"
ssh hk-jump "docker tag org-diagnosis-api:previous org-diagnosis-api:latest 2>/dev/null || true"
ssh hk-jump "docker restart org-diagnosis-api"

# 方式 B: 切回 Render (紧急)
# 修改 vercel.json 中的 NEXT_PUBLIC_API_URL 回 Render 地址
# 重新部署前端到 Vercel
```

---

## 9. 从 Render 迁移检查清单

- [ ] HK 节点创建 org-diagnosis 数据库 (ArangoDB)
- [ ] HK 节点创建 org-diagnosis bucket (MinIO)
- [ ] 后端代码部署到 HK Docker
- [ ] 环境变量配置 (.env)
- [ ] Nginx 反向代理配置
- [ ] DNS A/CNAME 记录添加
- [ ] SSL 证书配置
- [ ] 前端 API 地址更新 (Vercel)
- [ ] 健康检查通过
- [ ] ArangoDB Kernel 模式验证
- [ ] MinIO 文件上传/下载验证
- [ ] CORS 验证 (前端 → HK API)
- [ ] Render 服务关闭 (确认一切正常后)

---

## 10. 环境变量参考

| 变量名 | 值 (HK 生产) | 说明 |
|--------|-------------|------|
| `DEBUG` | `false` | 关闭调试模式 |
| `CORS_ORIGINS` | `https://org-diagnosis.3strategy.cc,http://localhost:3000` | 前端域名 |
| `SUPABASE_URL` | `https://yyyjnrgntymobpbgfswe.supabase.co` | Supabase |
| `SUPABASE_ANON_KEY` | `eyJ...` | Supabase 匿名密钥 |
| `DASHSCOPE_API_KEY` | `sk-...` | 通义千问 API |
| `AI_PROVIDER` | `dashscope` | AI 提供商 |
| `KERNEL_MODE` | `production` | 启用 ArangoDB |
| `ARANGO_HOST` | `arangodb` | 容器名 (Docker DNS) |
| `ARANGO_PORT` | `8529` | ArangoDB 端口 |
| `ARANGO_USER` | `root` | ArangoDB 用户 |
| `ARANGO_PASSWORD` | `Fisheros@2024` | ArangoDB 密码 |
| `ARANGO_DATABASE` | `org_diagnosis` | 专用数据库名 |
| `MINIO_ENDPOINT` | `minio:9000` | 容器名:端口 |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO 用户 |
| `MINIO_SECRET_KEY` | `MinioPwd2026HK` | MinIO 密码 |
| `MINIO_BUCKET` | `org-diagnosis` | 专用 Bucket |
