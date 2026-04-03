'use client';

import { useStore } from '@/lib/store';
import { Copy, ArrowLeft, CheckCircle, Printer } from 'lucide-react';
import { useState } from 'react';

export default function ReportPage() {
  const { data, setStep } = useStore();
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyReport = () => {
    let report = '# 企业战略解码报告\n\n';
    report += `**生成时间:** ${new Date().toLocaleString('zh-CN')}\n\n`;

    if (data.step1) {
      report += '## 一、业绩复盘\n\n';
      report += `**去年目标:**\n${data.step1.goals}\n\n`;
      report += `**实际完成:**\n${data.step1.actuals}\n\n`;
      report += `**复盘总结:**\n${data.step1.summary}\n\n`;
    }

    if (data.step2) {
      report += '## 二、市场与机会\n\n';
      if (data.step2.swot) {
        report += '**SWOT 分析:**\n';
        report += `- **优势:** ${data.step2.swot.strengths.join('、')}\n`;
        report += `- **劣势:** ${data.step2.swot.weaknesses.join('、')}\n`;
        report += `- **机会:** ${data.step2.swot.opportunities.join('、')}\n`;
        report += `- **威胁:** ${data.step2.swot.threats.join('、')}\n\n`;
      }
      if (data.step2.strategicPoints) {
        report += '**战略机会点:**\n';
        data.step2.strategicPoints.forEach((point, idx) => {
          report += `${idx + 1}. ${point}\n`;
        });
        report += '\n';
      }
    }

    if (data.step3?.targets) {
      report += '## 三、年度目标\n\n';
      data.step3.targets.forEach((target, idx) => {
        const typeLabel = target.type === 'revenue' ? '营收' : target.type === 'market' ? '市场' : '其他';
        report += `${idx + 1}. **${target.name}** (${typeLabel})\n`;
        report += `   - 当前值: ${target.currentValue} | 目标值: ${target.targetValue}\n`;
        report += `   - ${target.description}\n\n`;
      });
    }

    if (data.step4) {
      report += '## 四、执行方案\n\n';

      if (data.step4?.keyBattles && data.step4.keyBattles.length > 0) {
        report += '**关键战役:**\n';
        data.step4.keyBattles.forEach((battle, idx) => {
          report += `${idx + 1}. **${battle.name}** - ${battle.owner}\n`;
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

    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:px-0 print:py-0">
      <div className="flex items-center justify-between mb-8 print:hidden">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          战略解码报告
        </h2>
        <div className="flex gap-3">
          <button
            onClick={handleCopyReport}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300
                       hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2
                       transition-all duration-200"
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                复制报告
              </>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg
                       flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <Printer className="w-4 h-4" />
            打印/导出PDF
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
                <div>
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">复盘总结</h5>
                  <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-line print:text-black">{data.step1.summary}</p>
                </div>
              </div>
            </section>
          )}

          {/* Section 2: Market & Opportunities */}
          {data.step2 && (
            <section className="print:break-after-avoid">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-slate-700">
                二、市场与机会
              </h4>
              <div className="space-y-4">
                {data.step2.swot && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2">
                    <div className="border-l-4 border-green-500 pl-4 print:border-l-4 print:border-green-600">
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 print:text-black">优势</h5>
                      <p className="text-sm text-gray-600 dark:text-slate-400 print:text-black">{data.step2.swot.strengths.join('、')}</p>
                    </div>
                    <div className="border-l-4 border-red-500 pl-4 print:border-l-4 print:border-red-600">
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 print:text-black">劣势</h5>
                      <p className="text-sm text-gray-600 dark:text-slate-400 print:text-black">{data.step2.swot.weaknesses.join('、')}</p>
                    </div>
                    <div className="border-l-4 border-blue-500 pl-4 print:border-l-4 print:border-blue-600">
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 print:text-black">机会</h5>
                      <p className="text-sm text-gray-600 dark:text-slate-400 print:text-black">{data.step2.swot.opportunities.join('、')}</p>
                    </div>
                    <div className="border-l-4 border-yellow-500 pl-4 print:border-l-4 print:border-yellow-600">
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 print:text-black">威胁</h5>
                      <p className="text-sm text-gray-600 dark:text-slate-400 print:text-black">{data.step2.swot.threats.join('、')}</p>
                    </div>
                  </div>
                )}
                {data.step2.strategicPoints && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 print:text-black">战略机会点</h5>
                    <ul className="space-y-2">
                      {data.step2.strategicPoints.map((point, idx) => (
                        <li key={idx} className="text-sm text-gray-600 dark:text-slate-400 flex items-start gap-2 print:text-black">
                          <span className="text-blue-600 dark:text-blue-400 font-bold">{idx + 1}.</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Section 3: Targets */}
          {data.step3?.targets && data.step3.targets.length > 0 && (
            <section className="print:break-after-avoid">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-slate-700">
                三、年度目标
              </h4>
              <div className="space-y-3">
                {data.step3.targets.map((target, idx) => (
                  <div key={idx} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 print:border-black print:shadow-none">
                    <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2 print:text-black">
                      {idx + 1}. {target.name}
                    </h5>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-2 print:text-black">{target.description}</p>
                    <div className="text-sm">
                      <span className="text-gray-500 dark:text-slate-500 print:text-black">当前值:</span>{' '}
                      <span className="text-gray-700 dark:text-gray-300 print:text-black">{target.currentValue}</span>{' '}
                      <span className="mx-2">→</span>{' '}
                      <span className="text-gray-500 dark:text-slate-500 print:text-black">目标值:</span>{' '}
                      <span className="font-semibold text-blue-600 dark:text-blue-400 print:text-black">{target.targetValue}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 4: Execution */}
          {data.step4 && (
            <section className="print:break-after-avoid">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-slate-700">
                四、执行方案
              </h4>
              <div className="space-y-6">
                {data.step4?.keyBattles && data.step4.keyBattles.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 print:text-black">关键战役</h5>
                    <div className="space-y-3">
                      {data.step4.keyBattles.map((battle, idx) => (
                        <div key={idx} className="border-l-4 border-blue-500 pl-4 print:border-l-4 print:border-blue-600">
                          <h6 className="font-medium text-gray-900 dark:text-gray-100 print:text-black">{battle.name}</h6>
                          <p className="text-sm text-gray-600 dark:text-slate-400 print:text-black">{battle.description}</p>
                          <span className="text-xs text-gray-500 dark:text-slate-500 print:text-black">负责人: {battle.owner}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.step4?.quarterlyActions && data.step4.quarterlyActions.length > 0 && (() => {
                  const actionsList = data.step4.quarterlyActions;
                  return (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 print:text-black">季度行动计划</h5>
                      <div className="space-y-4">
                        {['Q1', 'Q2', 'Q3', 'Q4'].map(quarter => {
                          const actions = actionsList.filter(a => a.quarter === quarter);
                        if (actions.length === 0) return null;
                        return (
                          <div key={quarter}>
                            <h6 className="font-medium text-gray-900 dark:text-gray-100 mb-2 print:text-black">{quarter}</h6>
                            <ul className="space-y-1 ml-4">
                              {actions.map((action, idx) => (
                                <li key={idx} className="text-sm text-gray-600 dark:text-slate-400 print:text-black">
                                  • {action.action} <span className="text-gray-400 dark:text-slate-500 print:text-black">({action.deadline})</span>
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
