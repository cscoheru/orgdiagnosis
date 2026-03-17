"""
PDF 报告生成服务
使用 Playwright (Puppeteer 替代) 生成高质量 PDF
"""
import logging
import os
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


# PDF 报告 HTML 模板
REPORT_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>五维诊断报告</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
            line-height: 1.6;
            color: #333;
            padding: 20mm;
            font-size: 12pt;
        }

        .header {
            text-align: center;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        .header h1 {
            font-size: 28pt;
            color: #1e40af;
            margin-bottom: 10px;
        }

        .header .subtitle {
            color: #64748b;
            font-size: 11pt;
        }

        .meta-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            padding: 15px;
            background: #f8fafc;
            border-radius: 8px;
        }

        .meta-item {
            text-align: center;
        }

        .meta-label {
            font-size: 10pt;
            color: #64748b;
            margin-bottom: 5px;
        }

        .meta-value {
            font-size: 14pt;
            font-weight: bold;
            color: #1e293b;
        }

        .score-overview {
            text-align: center;
            margin: 30px 0;
        }

        .overall-score {
            font-size: 72pt;
            font-weight: bold;
            color: #3b82f6;
        }

        .score-label {
            font-size: 14pt;
            color: #64748b;
            margin-top: 10px;
        }

        .dimensions-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 15px;
            margin: 30px 0;
        }

        .dimension-card {
            text-align: center;
            padding: 20px 10px;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            background: #fff;
        }

        .dimension-score {
            font-size: 36pt;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .dimension-label {
            font-size: 12pt;
            font-weight: bold;
            color: #334155;
        }

        .dimension-desc {
            font-size: 10pt;
            color: #64748b;
            margin-top: 5px;
        }

        .score-low { color: #ef4444; }
        .score-medium { color: #f59e0b; }
        .score-high { color: #10b981; }

        .section {
            margin: 30px 0;
            page-break-inside: avoid;
        }

        .section-title {
            font-size: 16pt;
            font-weight: bold;
            color: #1e293b;
            border-left: 4px solid #3b82f6;
            padding-left: 15px;
            margin-bottom: 20px;
        }

        .l2-category {
            margin: 15px 0;
            padding: 15px;
            background: #f8fafc;
            border-radius: 8px;
        }

        .l2-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .l2-label {
            font-weight: bold;
            color: #334155;
        }

        .l2-score {
            font-weight: bold;
            font-size: 14pt;
        }

        .l3-list {
            margin-left: 20px;
        }

        .l3-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px dashed #e2e8f0;
        }

        .l3-item:last-child {
            border-bottom: none;
        }

        .l3-name {
            color: #475569;
        }

        .l3-score {
            font-weight: bold;
        }

        .evidence {
            font-size: 10pt;
            color: #64748b;
            font-style: italic;
            margin-top: 5px;
            padding: 5px 10px;
            background: #fff;
            border-radius: 4px;
        }

        .summary-section {
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            color: white;
            padding: 25px;
            border-radius: 12px;
            margin: 30px 0;
        }

        .summary-section h3 {
            font-size: 14pt;
            margin-bottom: 15px;
        }

        .summary-section p {
            font-size: 12pt;
            line-height: 1.8;
        }

        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            color: #94a3b8;
            font-size: 10pt;
        }

        @media print {
            body { padding: 15mm; }
            .section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>五维组织诊断报告</h1>
        <div class="subtitle">基于 BLM 模型的企业组织健康度评估</div>
    </div>

    <div class="meta-info">
        <div class="meta-item">
            <div class="meta-label">报告编号</div>
            <div class="meta-value">{{ session_id[:8] }}</div>
        </div>
        <div class="meta-item">
            <div class="meta-label">生成时间</div>
            <div class="meta-value">{{ generated_at }}</div>
        </div>
        <div class="meta-item">
            <div class="meta-label">诊断维度</div>
            <div class="meta-value">5 大维度</div>
        </div>
    </div>

    <div class="score-overview">
        <div class="overall-score score-{% if overall_score < 60 %}low{% elif overall_score < 80 %}medium{% else %}high{% endif %}">
            {{ overall_score }}
        </div>
        <div class="score-label">综合健康度评分</div>
    </div>

    <div class="dimensions-grid">
        {% for dim_key, dim_data in dimensions.items() %}
        <div class="dimension-card">
            <div class="dimension-score score-{% if dim_data.score < 60 %}low{% elif dim_data.score < 80 %}medium{% else %}high{% endif %}">
                {{ dim_data.score }}
            </div>
            <div class="dimension-label">{{ dim_data.label }}</div>
            <div class="dimension-desc">{{ dim_data.description }}</div>
        </div>
        {% endfor %}
    </div>

    <div class="summary-section">
        <h3>📋 整体评估</h3>
        <p>{{ summary }}</p>
    </div>

    {% for dim_key, dim_data in dimensions.items() %}
    <div class="section">
        <div class="section-title">{{ dim_data.label }} ({{ dim_data.score }}分)</div>

        {% for l2_key, l2_data in dim_data.L2_categories.items() %}
        <div class="l2-category">
            <div class="l2-header">
                <span class="l2-label">{{ l2_data.label }}</span>
                <span class="l2-score score-{% if l2_data.score < 60 %}low{% elif l2_data.score < 80 %}medium{% else %}high{% endif %}">
                    {{ l2_data.score }}分
                </span>
            </div>
            <div class="l3-list">
                {% for l3_key, l3_data in l2_data.L3_items.items() %}
                <div class="l3-item">
                    <span class="l3-name">{{ l3_data.label or l3_key }}</span>
                    <span class="l3-score">{{ l3_data.score }}</span>
                </div>
                {% if l3_data.evidence %}
                <div class="evidence">证据: {{ l3_data.evidence }}</div>
                {% endif %}
                {% endfor %}
            </div>
        </div>
        {% endfor %}
    </div>
    {% endfor %}

    <div class="footer">
        <p>本报告由五维诊断系统自动生成 · 仅供参考</p>
        <p>© 2026 组织诊断系统 v2.0</p>
    </div>
</body>
</html>
"""


class PDFGenerator:
    """PDF 报告生成器"""

    def __init__(self):
        self.template_dir = Path(__file__).parent.parent / "templates"
        self.template_dir.mkdir(exist_ok=True)

    async def generate(
        self,
        diagnosis_data: Dict[str, Any],
        session_id: str
    ) -> bytes:
        """
        生成 PDF 报告

        Args:
            diagnosis_data: 诊断数据
            session_id: 会话 ID

        Returns:
            PDF 二进制数据
        """
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            raise RuntimeError("Playwright 未安装，请运行: pip install playwright && playwright install chromium")

        # 准备模板数据
        template_data = self._prepare_template_data(diagnosis_data, session_id)

        # 渲染 HTML
        html_content = self._render_template(template_data)

        # 使用 Playwright 生成 PDF
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()

            # 设置内容
            await page.set_content(html_content, wait_until="networkidle")

            # 生成 PDF
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={
                    "top": "15mm",
                    "right": "15mm",
                    "bottom": "15mm",
                    "left": "15mm"
                }
            )

            await browser.close()

        logger.info(f"PDF 生成成功: {session_id}, 大小: {len(pdf_bytes)} bytes")
        return pdf_bytes

    def _prepare_template_data(
        self,
        data: Dict[str, Any],
        session_id: str
    ) -> Dict[str, Any]:
        """准备模板数据"""
        # 提取五维数据
        dimensions = {
            "strategy": data.get("strategy", {}),
            "structure": data.get("structure", {}),
            "performance": data.get("performance", {}),
            "compensation": data.get("compensation", {}),
            "talent": data.get("talent", {})
        }

        # 计算总分
        overall_score = data.get("overall_score", 0)

        # 生成时间
        generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")

        # 摘要
        summary = data.get("summary", "暂无摘要")

        return {
            "session_id": session_id,
            "generated_at": generated_at,
            "overall_score": overall_score,
            "dimensions": dimensions,
            "summary": summary
        }

    def _render_template(self, data: Dict[str, Any]) -> str:
        """渲染 HTML 模板"""
        from jinja2 import Template

        template = Template(REPORT_TEMPLATE)
        return template.render(**data)


# 单例实例
pdf_generator = PDFGenerator()
