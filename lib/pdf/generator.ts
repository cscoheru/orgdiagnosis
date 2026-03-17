/**
 * PDF 生成器
 * 使用 html2canvas + jsPDF 生成高保真 PDF
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { FiveDimensionsData } from '@/types/diagnosis';
import { DIMENSION_LABELS } from '@/types/diagnosis';

interface PDFOptions {
  title?: string;
  data: FiveDimensionsData;
  element: HTMLElement;
}

/**
 * 生成 PDF 文档
 */
export async function generatePDF(options: PDFOptions): Promise<Blob> {
  const { title = '五维组织诊断报告', data, element } = options;

  // 1. 使用 html2canvas 截图
  const canvas = await html2canvas(element, {
    scale: 2, // 高分辨率
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  // 2. 创建 PDF
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;

  // 3. 添加标题
  pdf.setFontSize(24);
  pdf.setTextColor(37, 99, 235); // blue-600
  pdf.text(title, pageWidth / 2, 25, { align: 'center' });

  // 4. 添加日期
  pdf.setFontSize(10);
  pdf.setTextColor(107, 114, 128); // gray-500
  pdf.text(`生成日期: ${new Date().toLocaleDateString('zh-CN')}`, pageWidth / 2, 35, { align: 'center' });

  // 5. 添加整体健康度
  pdf.setFontSize(14);
  pdf.setTextColor(31, 41, 55); // gray-800
  pdf.text('整体健康度', margin, 55);

  pdf.setFontSize(36);
  pdf.setTextColor(37, 99, 235);
  pdf.text(String(data.overall_score), margin, 70);

  pdf.setFontSize(10);
  pdf.setTextColor(107, 114, 128);
  pdf.text('/ 100', margin + 25, 70);

  // 6. 添加五维分数概览
  pdf.setFontSize(12);
  pdf.setTextColor(31, 41, 55);
  pdf.text('五维评分', margin, 90);

  let yOffset = 100;
  const dimensions = ['strategy', 'structure', 'performance', 'compensation', 'talent'] as const;

  dimensions.forEach((key) => {
    const dim = data[key];
    if (!dim) return;

    const label = DIMENSION_LABELS[key];
    const score = dim.score || 0;

    // 维度名称
    pdf.setFontSize(11);
    pdf.setTextColor(55, 65, 81); // gray-700
    pdf.text(label, margin, yOffset);

    // 分数
    pdf.setFontSize(11);
    if (score >= 80) {
      pdf.setTextColor(34, 197, 94); // green
    } else if (score >= 60) {
      pdf.setTextColor(245, 158, 11); // yellow
    } else {
      pdf.setTextColor(239, 68, 68); // red
    }
    pdf.text(`${score}`, margin + 40, yOffset);

    // 进度条
    const barWidth = 100;
    const barHeight = 4;
    const barX = margin + 60;
    const barY = yOffset - 2;

    // 背景条
    pdf.setFillColor(229, 231, 235); // gray-200
    pdf.roundedRect(barX, barY, barWidth, barHeight, 2, 2, 'F');

    // 前景条
    const fillWidth = (score / 100) * barWidth;
    if (score >= 80) {
      pdf.setFillColor(34, 197, 94);
    } else if (score >= 60) {
      pdf.setFillColor(245, 158, 11);
    } else {
      pdf.setFillColor(239, 68, 68);
    }
    pdf.roundedRect(barX, barY, fillWidth, barHeight, 2, 2, 'F');

    yOffset += 12;
  });

  // 7. 添加截图内容
  const imgData = canvas.toDataURL('image/png');
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // 检查是否需要新页面
  if (yOffset + imgHeight > pageHeight - margin) {
    pdf.addPage();
    yOffset = margin;
  }

  pdf.addImage(imgData, 'PNG', margin, yOffset, imgWidth, imgHeight);

  // 8. 添加页脚
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(156, 163, 175); // gray-400
    pdf.text(
      `第 ${i} 页 / 共 ${totalPages} 页 | 五维组织诊断系统`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // 9. 返回 Blob
  return pdf.output('blob');
}

/**
 * 下载 PDF
 */
export async function downloadPDF(options: PDFOptions, filename?: string): Promise<void> {
  const blob = await generatePDF(options);
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `五维诊断报告_${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
