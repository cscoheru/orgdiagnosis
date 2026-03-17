# 使用 Python 3.11 slim 镜像
FROM python:3.11-slim-bookworm

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 设置工作目录
WORKDIR /app

# 安装系统依赖 (分步执行，更稳定)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # 基础工具
    curl \
    # PDF 处理
    poppler-utils \
    # OCR
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    # 图像处理
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    # 清理
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 安装 Playwright 和浏览器
RUN pip install playwright && \
    playwright install-deps chromium && \
    playwright install chromium

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
