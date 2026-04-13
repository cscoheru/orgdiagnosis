'use client';

import { useStore } from '@/lib/store';
import { Copy, ArrowLeft, CheckCircle, Printer, Download, FileJson, FileText } from 'lucide-react';
import { useState } from 'react';

function generateMarkdownReport(data: any): string {
  let report = '# 企业战略解码报告\n\n';
  report += `**生成时间:** ${new Date().toLocaleString('zh-CN')}\n\n`;

  // Section 1: 业绩复盘
  if (data.step1) {
    report += '## 一、业绩复盘\n\n';
    report += `**去年目标:**\n${data.step1.goals}\n\n`;
    report += `**实际完成:**\n${data.step1.actuals}\n\n`;
    if (data.step1.summary) {
      report += `**复盘总结:**\n${data.step1.summary}\n\n`;
    }
    if (data.step1.rootCause) {
      report += `**核心短板:** ${data.step1.rootCause}\n\n`;
    }
    if (data.step1.dimensions && data.step1.dimensions.length > 0) {
      report += '**3力3平台归因:**\n';
      data.step1.dimensions.forEach((d: any) => {
        if (d.isHighlighted) {
          report += `- **${d.name}** (${d.score}%): ${d.reason}\n`;
        }
      });
      report += '\n';
    }
  }

  // Section 2: 市场与机会
  if (data.step2) {
    report += '## 二、市场与机会\n\n';

    if (data.step2.customerInsight?.kbf?.length > 0) {
      report += '### 客户需求洞察\n';
      report += `**关键购买因素 (KBF):** ${data.step2.customerInsight.kbf.join('、')}\n\n`;
    }

    if (data.step2.competitorAnalysis?.advantages?.length > 0) {
      report += '### 竞对优势分析\n';
      data.step2.competitorAnalysis.advantages.forEach((a: any) => {
        report += `- ${a.competitorName}: ${a.advantage}\n`;
      });
      report += '\n';
    }

    if (data.step2.ksfDimensions?.length > 0) {
      report += '### 关键成功要素 (KSF)\n';
      data.step2.ksfDimensions.forEach(ksf => {
        report += `- **${ksf.name}**: ${ksf.reasoning}\n`;
      });
      report += '\n';
    }

    if (data.step2.benchmarkScores?.length > 0) {
      report += '### 竞争力对标\n';
      data.step2.benchmarkScores.forEach(bs => {
        const gap = bs.myScore - bs.competitorScore;
        const indicator = gap > 0 ? '▲' : gap < 0 ? '▼' : '●';
        report += `- ${bs.dimensionName}: 我方${bs.myScore} vs 竞对${bs.competitorScore} (${indicator}${Math.abs(gap)})\n`;
      });
      report += '\n';
    }

    if (data.step2.swot) {
      report += '### SWOT 分析\n';
      report += `- **优势:** ${data.step2.swot.strengths.join('、')}\n`;
      report += `- **劣势:** ${data.step2.swot.weaknesses.join('、')}\n`;
      report += `- **机会:** ${data.step2.swot.opportunities.join('、')}\n`;
      report += `- **威胁:** ${data.step2.swot.threats.join('、')}\n\n`;
    }

    if (data.step2.towsStrategies) {
      report += '### TOWS 交叉策略\n';
      if (data.step2.towsStrategies.so?.length) {
        report += '**SO (增长策略):** ' + data.step2.towsStrategies.so.join('；') + '\n';
      }
      if (data.step2.towsStrategies.wo?.length) {
        report += '**WO (转型策略):** ' + data.step2.towsStrategies.wo.join('；') + '\n';
      }
      if (data.step2.towsStrategies.st?.length) {
        report += '**ST (多元化策略):** ' + data.step2.towsStrategies.st.join('；') + '\n';
      }
      if (data.step2.towsStrategies.wt?.length) {
        report += '**WT (防御策略):** ' + data.step2.towsStrategies.wt.join('；') + '\n';
      }
      report += '\n';
    }

    if (data.step2.strategicDirection) {
      report += `**战略方向:** ${data.step2.strategicDirection}\n\n`;
    }

    if (data.step2.productCustomerMatrix) {
      const m = data.step2.productCustomerMatrix;
      report += '### 产品-客户矩阵 (Ansoff)\n';
      if (m.marketPenetration?.length) report += `- **市场渗透**: ${m.marketPenetration.join('、')}\n`;
      if (m.productDevelopment?.length) report += `- **产品开发**: ${m.productDevelopment.join('、')}\n`;
      if (m.marketDevelopment?.length) report += `- **市场开发**: ${m.marketDevelopment.join('、')}\n`;
      if (m.diversification?.length) report += `- **多元化**: ${m.diversification.join('、')}\n`;
      report += '\n';
    }
  }

  // Section 3: 年度目标
  if (data.step3) {
    report += '## 三、年度目标\n\n';

    if (data.step3.calculatedTargets) {
      const { base, standard, challenge } = data.step3.calculatedTargets;
      report += '| 目标档位 | 金额 |\n|---------|------|\n';
      report += `| 保底目标 | ${base.toLocaleString()} 万 |\n`;
      report += `| 达标目标 | ${standard.toLocaleString()} 万 |\n`;
      report += `| 挑战目标 | ${challenge.toLocaleString()} 万 |\n\n`;
      report += `信心指数: ${data.step3.confidenceIndex}%\n\n`;
    }

    if (data.step3.matrixData) {
      const md = data.step3.matrixData;
      if (md.oldClients.length || md.newClients.length) {
        report += '### 客户-产品矩阵\n';
        report += `**客户群:** ${[...md.oldClients, ...md.newClients].join('、')}\n`;
        report += `**产品线:** ${[...md.oldProducts, ...md.newProducts].join('、')}\n\n`;
      }
    }

    if (data.step3.targets && data.step3.targets.length > 0) {
      report += '**目标明细:**\n';
      data.step3.targets.forEach((target, idx) => {
        const typeLabel = target.type === 'revenue' ? '营收' : target.type === 'market' ? '市场' : '其他';
        report += `${idx + 1}. **${target.name}** (${typeLabel}) — ${target.description}\n`;
      });
      report += '\n';
    }
  }

  // Section 4: 执行方案
  if (data.step4) {
    report += '## 四、执行方案\n\n';

    if (data.step4.actionPlanTable && data.step4.actionPlanTable.length > 0) {
      report += '### 3力3平台行动计划表\n\n';
      report += '| # | 客户群 | 产品 | 营收目标 | 销售力 | 产品力 | 交付力 | 人力 | 财务&资产 | 数字化&流程 |\n';
      report += '|---|--------|------|---------|--------|--------|--------|------|----------|------------|\n';
      data.step4.actionPlanTable.forEach(row => {
        report += `| ${row.seqNumber} | ${row.customerGroup} | ${row.product} | ${row.revenueTarget} | ${row.salesForce} | ${row.productForce} | ${row.deliveryForce} | ${row.hr} | ${row.financeAssets} | ${row.digitalProcess} |\n`;
      });
      report += '\n';
    }

    if (data.step4.strategyMap && typeof data.step4.strategyMap === 'object') {
      const sm = data.step4.strategyMap as any;
      if (sm.theme) {
        report += '### 战略主题\n';
        report += `**${sm.theme}**: ${sm.themeDescription || ''}\n\n`;
      }
    }

    if (data.step4?.keyBattles && data.step4.keyBattles.length > 0) {
      report += '**关键战役:**\n';
      data.step4.keyBattles.forEach((battle, idx) => {
        report += `${idx + 1}. **${battle.name}** — ${battle.owner}\n`;
        report += `   ${battle.description}\n\n`;
      });
    }

    if (data.step4?.quarterlyActions && data.step4.quarterlyActions?.length > 0) {
      const actionsList = data.step4.quarterlyActions;
      report += '**季度行动计划:**\n';
      ['Q1', 'Q2', 'Q3', 'Q4'].forEach(quarter => {
        const actions = actionsList.filter(a => a.quarter === quarter);
        if (actions.length > 0) {
          report += `\n**${quarter}:**\n`;
          actions.forEach(action => {
            report += `- ${action.action} (${action.deadline})\n`;
          });
        }
      });
    }
  }

  return report;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const dateStamp = () => new Date().toISOString().slice(0, 10);

export default function ReportPage() {
  const { data, setStep } = useStore();
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyReport = () => {
    const report = generateMarkdownReport(data);
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadJSON = () => {
    const exportData = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      report: data,
    };
    downloadFile(
      JSON.stringify(exportData, null, 2),
      `战略解码报告_${dateStamp()}.json`,
      'application/json'
    );
  };

  const handleDownloadMD = () => {
    const md = generateMarkdownReport(data);
    downloadFile(md, `战略解码报告_${dateStamp()}.md`, 'text/markdown;charset=utf-8');
  };

  const step3 = data.step3;
  const step4 = data.step4;
  const step2 = data.step2;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:px-0 print:py-0">
      <div className="flex items-center justify-between mb-8 print:hidden">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          战略解码报告
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleCopyReport}
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300
                       hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5
                       transition-all duration-200 text-sm"
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                复制
              </>
            )}
          </button>
          <button
            onClick={handleDownloadMD}
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300
                       hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5
                       transition-all duration-200 text-sm"
          >
            <FileText className="w-4 h-4" />
            导出 MD
          </button>
          <button
            onClick={handleDownloadJSON}
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300
                       hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5
                       transition-all duration-200 text-sm"
          >
            <FileJson className="w-4 h-4" />
            导出 JSON
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                       flex items-center gap-1.5 transition-all duration-200 shadow-md hover:shadow-lg text-sm"
          >
            <Printer className="w-4 h-4" />
            打印/PDF
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-8 mb-6 shadow-sm">
        <div className="border-b border-gray-200 dark:border-slate-700 pb-4 mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            企业战略解码报告
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            生成时间: {new Date().toLocaleString('zh-CN')}
          </p>
        </div>

        <div className="space-y-8">
          {/* Section 1: Performance Review */}
          {data.step1 && (
            <section className="print:break-after-avoid">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-slate-700">
                一、业绩复盘
              </h4>
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">去年目标</h5>
                  <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-line print:text-black">{data.step1.goals}</p>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">实际完成</h5>
                  <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-line print:text-black">{data.step1.actuals}</p>
                </div>
                {data.step1.summary && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">复盘总结</h5>
                    <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-line print:text-black">{data.step1.summary}</p>
                  </div>
                )}
                {data.step1.rootCause && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">核心短板</h5>
                    <p className="text-sm text-green-700 dark:text-green-300">{data.step1.rootCause}</p>
                  </div>
                )}
                {data.step1.dimensions && data.step1.dimensions.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">3力3平台归因</h5>
                    <div className="grid grid-cols-2 gap-2">
                      {data.step1.dimensions.filter(d => d.isHighlighted).map(d => (
                        <div key={d.id} className="border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{d.name}</span>
                            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">{d.score}%</span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-slate-400">{d.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Section 2: Market & Opportunities */}
          {step2 && (
            <section className="print:break-after-avoid">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-slate-700">
                二、市场与机会
              </h4>
              <div className="space-y-4">
                {/* SWOT */}
                {step2.swot && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2">
                    <div className="border-l-4 border-green-500 pl-4">
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">优势</h5>
                      <ul className="text-sm text-gray-600 dark:text-slate-400 space-y-1">
                        {step2.swot.strengths.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                    <div className="border-l-4 border-red-500 pl-4">
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">劣势</h5>
                      <ul className="text-sm text-gray-600 dark:text-slate-400 space-y-1">
                        {step2.swot.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">机会</h5>
                      <ul className="text-sm text-gray-600 dark:text-slate-400 space-y-1">
                        {step2.swot.opportunities.map((o, i) => <li key={i}>{o}</li>)}
                      </ul>
                    </div>
                    <div className="border-l-4 border-yellow-500 pl-4">
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">威胁</h5>
                      <ul className="text-sm text-gray-600 dark:text-slate-400 space-y-1">
                        {step2.swot.threats.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  </div>
                )}

                {/* KSF */}
                {step2.ksfDimensions && step2.ksfDimensions.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">关键成功要素 (KSF)</h5>
                    <div className="space-y-2">
                      {step2.ksfDimensions.map(ksf => (
                        <div key={ksf.id} className="flex items-start gap-2">
                          <span className="text-blue-600 dark:text-blue-400 font-bold text-sm mt-0.5">●</span>
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{ksf.name}</span>
                            <p className="text-xs text-gray-500 dark:text-slate-400">{ksf.reasoning}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 竞争对标 */}
                {step2.benchmarkScores && step2.benchmarkScores.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">竞争力对标</h5>
                    <div className="space-y-1">
                      {step2.benchmarkScores.map(bs => {
                        const gap = bs.myScore - bs.competitorScore;
                        return (
                          <div key={bs.dimensionId} className="flex items-center gap-3 text-sm">
                            <span className="w-24 text-gray-700 dark:text-gray-300">{bs.dimensionName}</span>
                            <span className={`font-mono ${gap > 0 ? 'text-green-600' : gap < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                              {bs.myScore}
                            </span>
                            <span className="text-gray-400">vs</span>
                            <span className="font-mono text-gray-600 dark:text-slate-400">{bs.competitorScore}</span>
                            <span className={`text-xs ${gap > 0 ? 'text-green-600' : gap < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                              {gap > 0 ? `+${gap}` : gap}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TOWS */}
                {step2.towsStrategies && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">TOWS 交叉策略</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {step2.towsStrategies.so?.length > 0 && (
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                          <h6 className="text-xs font-bold text-green-700 dark:text-green-300 mb-1">SO 增长策略</h6>
                          <ul className="text-xs text-green-600 dark:text-green-400 space-y-1">
                            {step2.towsStrategies.so.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      )}
                      {step2.towsStrategies.wo?.length > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                          <h6 className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-1">WO 转型策略</h6>
                          <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                            {step2.towsStrategies.wo.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      )}
                      {step2.towsStrategies.st?.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                          <h6 className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">ST 多元化策略</h6>
                          <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
                            {step2.towsStrategies.st.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      )}
                      {step2.towsStrategies.wt?.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                          <h6 className="text-xs font-bold text-red-700 dark:text-red-300 mb-1">WT 防御策略</h6>
                          <ul className="text-xs text-red-600 dark:text-red-400 space-y-1">
                            {step2.towsStrategies.wt.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 战略方向 */}
                {step2.strategicDirection && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">战略方向</h5>
                    <p className="text-sm text-blue-700 dark:text-blue-300">{step2.strategicDirection}</p>
                  </div>
                )}

                {/* 产品-客户矩阵 */}
                {step2.productCustomerMatrix && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">产品-客户矩阵 (Ansoff)</h5>
                    <div className="grid grid-cols-2 gap-3">
                      {step2.productCustomerMatrix.marketPenetration?.length > 0 && (
                        <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-3">
                          <h6 className="text-xs font-bold text-gray-600 dark:text-slate-400 mb-1">市场渗透</h6>
                          <ul className="text-xs text-gray-600 dark:text-slate-400">{step2.productCustomerMatrix.marketPenetration.map((s, i) => <li key={i}>{s}</li>)}</ul>
                        </div>
                      )}
                      {step2.productCustomerMatrix.productDevelopment?.length > 0 && (
                        <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-3">
                          <h6 className="text-xs font-bold text-gray-600 dark:text-slate-400 mb-1">产品开发</h6>
                          <ul className="text-xs text-gray-600 dark:text-slate-400">{step2.productCustomerMatrix.productDevelopment.map((s, i) => <li key={i}>{s}</li>)}</ul>
                        </div>
                      )}
                      {step2.productCustomerMatrix.marketDevelopment?.length > 0 && (
                        <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-3">
                          <h6 className="text-xs font-bold text-gray-600 dark:text-slate-400 mb-1">市场开发</h6>
                          <ul className="text-xs text-gray-600 dark:text-slate-400">{step2.productCustomerMatrix.marketDevelopment.map((s, i) => <li key={i}>{s}</li>)}</ul>
                        </div>
                      )}
                      {step2.productCustomerMatrix.diversification?.length > 0 && (
                        <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-3">
                          <h6 className="text-xs font-bold text-gray-600 dark:text-slate-400 mb-1">多元化</h6>
                          <ul className="text-xs text-gray-600 dark:text-slate-400">{step2.productCustomerMatrix.diversification.map((s, i) => <li key={i}>{s}</li>)}</ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Section 3: Targets */}
          {step3 && (
            <section className="print:break-after-avoid">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-slate-700">
                三、年度目标
              </h4>
              <div className="space-y-4">
                {step3.calculatedTargets && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 text-center">
                      <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">保底目标</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {step3.calculatedTargets.base.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400">万元</div>
                    </div>
                    <div className="border-2 border-blue-500 rounded-lg p-4 text-center bg-blue-50 dark:bg-blue-900/20">
                      <div className="text-xs text-blue-600 dark:text-blue-400 mb-1 font-medium">达标目标</div>
                      <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {step3.calculatedTargets.standard.toLocaleString()}
                      </div>
                      <div className="text-xs text-blue-400">万元</div>
                    </div>
                    <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 text-center">
                      <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">挑战目标</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {step3.calculatedTargets.challenge.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400">万元</div>
                    </div>
                  </div>
                )}

                {step3.confidenceIndex && (
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    信心指数: <span className="font-semibold">{step3.confidenceIndex}%</span>
                  </div>
                )}

                {step3.targets && step3.targets.length > 0 && (
                  <div className="space-y-3">
                    {step3.targets.map((target, idx) => (
                      <div key={idx} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                        <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                          {idx + 1}. {target.name}
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">{target.description}</p>
                        <div className="text-sm">
                          <span className="text-gray-500">当前值:</span>{' '}
                          <span className="text-gray-700 dark:text-gray-300">{target.currentValue}</span>{' '}
                          <span className="mx-2">→</span>{' '}
                          <span className="text-gray-500">目标值:</span>{' '}
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{target.targetValue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Section 4: Execution */}
          {step4 && (
            <section className="print:break-after-avoid">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-slate-700">
                四、执行方案
              </h4>
              <div className="space-y-6">
                {step4.actionPlanTable && step4.actionPlanTable.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">3力3平台行动计划表</h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr>
                            <th className="border border-gray-300 dark:border-slate-600 px-2 py-1.5 bg-gray-50 dark:bg-slate-700 text-left">#</th>
                            <th className="border border-gray-300 dark:border-slate-600 px-2 py-1.5 bg-gray-50 dark:bg-slate-700 text-left">客户群</th>
                            <th className="border border-gray-300 dark:border-slate-600 px-2 py-1.5 bg-gray-50 dark:bg-slate-700 text-left">产品</th>
                            <th className="border border-gray-300 dark:border-slate-600 px-2 py-1.5 bg-gray-50 dark:bg-slate-700 text-right">营收目标</th>
                            <th className="border border-gray-300 dark:border-slate-600 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-left">销售力</th>
                            <th className="border border-gray-300 dark:border-slate-600 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-left">产品力</th>
                            <th className="border border-gray-300 dark:border-slate-600 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-left">交付力</th>
                            <th className="border border-gray-300 dark:border-slate-600 px-2 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-left">人力</th>
                            <th className="border border-gray-300 dark:border-slate-600 px-2 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-left">财务&资产</th>
                            <th className="border border-gray-300 dark:border-slate-600 px-2 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-left">数字化&流程</th>
                          </tr>
                        </thead>
                        <tbody>
                          {step4.actionPlanTable.map(row => (
                            <tr key={row.id}>
                              <td className="border border-gray-300 dark:border-slate-600 px-2 py-1">{row.seqNumber}</td>
                              <td className="border border-gray-300 dark:border-slate-600 px-2 py-1">{row.customerGroup}</td>
                              <td className="border border-gray-300 dark:border-slate-600 px-2 py-1">{row.product}</td>
                              <td className="border border-gray-300 dark:border-slate-600 px-2 py-1 text-right font-mono">{row.revenueTarget}</td>
                              <td className="border border-gray-300 dark:border-slate-600 px-2 py-1">{row.salesForce}</td>
                              <td className="border border-gray-300 dark:border-slate-600 px-2 py-1">{row.productForce}</td>
                              <td className="border border-gray-300 dark:border-slate-600 px-2 py-1">{row.deliveryForce}</td>
                              <td className="border border-gray-300 dark:border-slate-600 px-2 py-1">{row.hr}</td>
                              <td className="border border-gray-300 dark:border-slate-600 px-2 py-1">{row.financeAssets}</td>
                              <td className="border border-gray-300 dark:border-slate-600 px-2 py-1">{row.digitalProcess}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {step4.strategyMap && typeof step4.strategyMap === 'object' && (step4.strategyMap as any).theme && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">战略主题</h5>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        {(step4.strategyMap as any).theme}
                      </span>
                      {(step4.strategyMap as any).themeDescription && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          {(step4.strategyMap as any).themeDescription}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {step4?.keyBattles && step4.keyBattles.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">关键战役</h5>
                    <div className="space-y-3">
                      {step4.keyBattles.map((battle, idx) => (
                        <div key={idx} className="border-l-4 border-blue-500 pl-4">
                          <h6 className="font-medium text-gray-900 dark:text-gray-100">{battle.name}</h6>
                          <p className="text-sm text-gray-600 dark:text-slate-400">{battle.description}</p>
                          <span className="text-xs text-gray-500 dark:text-slate-500">负责人: {battle.owner}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {step4?.quarterlyActions && step4.quarterlyActions.length > 0 && (() => {
                  const actionsList = step4.quarterlyActions;
                  return (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">季度行动计划</h5>
                      <div className="space-y-4">
                        {['Q1', 'Q2', 'Q3', 'Q4'].map(quarter => {
                          const actions = actionsList.filter(a => a.quarter === quarter);
                          if (actions.length === 0) return null;
                          return (
                            <div key={quarter}>
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{quarter}</h6>
                              <ul className="space-y-1 ml-4">
                                {actions.map((action, idx) => (
                                  <li key={idx} className="text-sm text-gray-600 dark:text-slate-400">
                                    • {action.action} <span className="text-gray-400 dark:text-slate-500">({action.deadline})</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="flex justify-center mt-8 print:hidden">
        <button
          onClick={() => setStep(4)}
          className="px-6 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300
                     hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2
                     transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          返回修改
        </button>
      </div>
    </div>
  );
}
