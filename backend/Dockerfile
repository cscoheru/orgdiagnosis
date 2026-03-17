# 使用 Python 3.11 slim 镜像
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    # PDF 解析依赖
    poppler-utils \
    # OCR 依赖
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    # 图像处理
    libgl1-mesa-glx \
    libglib2.0-0 \
    # 清理
    && rm -rf /var/lib/apt/lists/*

# 安装 Playwright 依赖
RUN pip install playwright && playwright install-deps chromium

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 安装 Playwright 浏览器
RUN playwright install chromium

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
