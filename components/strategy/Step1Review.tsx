'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Step1Data, DimensionCard, ChatMessage, DimensionType } from '@/types/strategy';
import {
  generateAttributionMap,
  startDiagnosticChat
} from '@/lib/zhipu-api';
import {
  Sparkles,
  Save,
  ArrowRight,
  TrendingUp,
  Target,
  Users,
  DollarSign,
  BarChart,
  Settings,
  CheckCircle2,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { DiagnosticChat } from './DiagnosticChat';

// 3力3平台图标配置
const DIMENSION_ICONS: Record<DimensionType, React.ElementType> = {
  sales: TrendingUp,
  product: Target,
  delivery: BarChart,
  hr: Users,
  finance: DollarSign,
  digital: Settings,
};

const DIMENSION_DESCRIPTIONS: Record<DimensionType, string> = {
  sales: '线索获取、转化率、客户关系、销售团队',
  product: '产品竞争力、创新能力、质量稳定性、上市速度',
  delivery: '履约能力、服务体验、交付效率、客户满意度',
  hr: '人才密度、组织能力、激励机制、文化氛围',
  finance: '资金充足性、成本控制、资源配置、投入产出',
  digital: '流程效率、数字化工具、数据决策、协同能力',
};

export default function Step1Review() {
  const { data, setData, modelConfig, setStep } = useStore();

  // 状态管理
  const [goals, setGoals] = useState(data.step1?.goals || '');
  const [actuals, setActuals] = useState(data.step1?.actuals || '');
  const [dimensions, setDimensions] = useState<DimensionCard[]>(data.step1?.dimensions || []);
  const [summary, setSummary] = useState(data.step1?.summary || '');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [selectedDimension, setSelectedDimension] = useState<DimensionCard | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [initialChatMessage, setInitialChatMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rootCause, setRootCause] = useState(data.step1?.rootCause || '');
  const [showDataRestored, setShowDataRestored] = useState(false);

  // 初始化加载 - 只在组件挂载时执行一次
  useEffect(() => {
    const step1Data = data.step1;
    if (step1Data) {
      // 检查是否有有效数据
      const hasData =
        step1Data.goals ||
        step1Data.actuals ||
        (step1Data.dimensions && step1Data.dimensions.length > 0) ||
        step1Data.rootCause;

      if (hasData) {
        setGoals(step1Data.goals || '');
        setActuals(step1Data.actuals || '');
        // 类型转换：确保 dimension.id 是 DimensionType 类型
        setDimensions((step1Data.dimensions || []).map(d => ({
          ...d,
          id: d.id as any // 从 JSON 恢复时需要类型断言
        })));
        setSummary(step1Data.summary || '');
        setRootCause(step1Data.rootCause || '');

        // 如果之前已完成诊断，恢复诊断会话（不恢复 selectedDimension，需要用户重新选择）
        if (step1Data.diagnosticSession) {
          setChatMessages(step1Data.diagnosticSession.messages || []);
        }

        // 显示数据恢复提示
        setShowDataRestored(true);
        setTimeout(() => setShowDataRestored(false), 3000);
      }
    }
  }, []); // 只在组件挂载时执行一次

  // 分析业绩差距
  const handleAnalyze = async () => {
    if (!goals.trim() || !actuals.trim()) {
      alert('请填写完整的目标和实际完成数据');
      return;
    }

    setIsAnalyzing(true);
    try {
      // 使用后端 API，无需前端 API Key
      const result = await generateAttributionMap('', goals, actuals);
      setSummary(result.summary);
      // 类型转换：API 返回的 id 是 string，需要转换为 DimensionType
      setDimensions(result.dimensions.map(d => ({ ...d, id: d.id as any })));
    } catch (error: any) {
      alert(`分析失败: ${error.message || '请检查 API 配置是否正确'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 选择维度进行深度诊断
  const handleSelectDimension = async (dimension: DimensionCard) => {
    setSelectedDimension(dimension);
    setShowChat(true);

    // 获取第一问
    try {
      const firstQuestion = await startDiagnosticChat(
        modelConfig.apiKey,
        {
          id: dimension.id,
          name: dimension.name,
          reason: dimension.reason
        },
        goals,
        actuals
      );
      setInitialChatMessage(firstQuestion);
    } catch (error: any) {
      alert(`启动诊断失败: ${error.message || '请检查 API 配置'}`);
      setShowChat(false);
    }
  };

  // 聊天消息更新
  const handleMessagesChange = (messages: ChatMessage[]) => {
    setChatMessages(messages);
  };

  // 根因提取完成
  const handleRootCauseExtracted = (extractedRootCause: string) => {
    setRootCause(extractedRootCause);
    setShowChat(false);

    // 更新选中的维度说明
    if (selectedDimension) {
      const updatedDimensions = dimensions.map(d =>
        d.id === selectedDimension.id
          ? { ...d, reason: `根因：${extractedRootCause.split('。')[0]}` }
          : d
      );
      setDimensions(updatedDimensions);
    }
  };

  // 保存数据
  const handleSave = () => {
    const step1Data: Step1Data = {
      goals,
      actuals,
      summary,
      dimensions,
      diagnosticSession: {
        selectedDimension: selectedDimension?.id || null,
        messages: chatMessages,
        rootCause: rootCause || null,
        isCompleted: !!rootCause
      },
      rootCause
    };
    setData('step1', step1Data);
    alert('数据已保存');
  };

  // 下一步
  const handleNext = () => {
    if (!goals.trim() || !actuals.trim()) {
      alert('请输入去年目标和实际完成数据');
      return;
    }
    handleSave();
    setStep(2);
  };

  // 计算进度
  const calculateProgress = () => {
    let completed = 0;
    let total = 4;

    if (goals.trim() && actuals.trim()) completed++;
    if (dimensions.length >= 6) completed++;
    if (selectedDimension && chatMessages.length >= 4) completed++;
    if (rootCause.trim()) completed++;

    return { completed, total, percentage: Math.round((completed / total) * 100) };
  };

  const progress = calculateProgress();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 数据恢复提示 */}
      {showDataRestored && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                数据已恢复
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                上次的输入和分析结果已自动加载，您可以继续之前的工作
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 进度指示器 */}
      {(goals || actuals || dimensions.length > 0) && (
        <div className="mb-6 p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              当前进度
            </h3>
            <span className="text-sm text-gray-600 dark:text-slate-400">
              {progress.completed}/{progress.total} 完成 ({progress.percentage}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 mb-3">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className={`p-2 rounded text-center ${goals.trim() && actuals.trim() ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
              1. 业绩输入
            </div>
            <div className={`p-2 rounded text-center ${dimensions.length >= 6 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
              2. 归因分析
            </div>
            <div className={`p-2 rounded text-center ${selectedDimension && chatMessages.length >= 4 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
              3. 深度诊断
            </div>
            <div className={`p-2 rounded text-center ${rootCause.trim() ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
              4. 根因确认
            </div>
          </div>
        </div>
      )}

      {/* 标题 */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Step 1: 业绩复盘 - 3力3平台根因诊断
        </h2>
        <p className="text-gray-600 dark:text-slate-400">
          基于假设性归因地图，使用 5 问法深度挖掘业绩差距的根本原因
        </p>
      </div>

      {/* 输入区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            去年目标
          </label>
          <textarea
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="请输入去年的关键目标..."
            rows={10}
            className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg
                       bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       resize-none transition-all duration-200"
          />
        </div>

        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            实际完成
          </label>
          <textarea
            value={actuals}
            onChange={(e) => setActuals(e.target.value)}
            placeholder="请输入实际完成的情况..."
            rows={10}
            className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg
                       bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       resize-none transition-all duration-200"
          />
        </div>
      </div>

      {/* 分析按钮 */}
      <div className="flex justify-center mb-8">
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="px-8 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed
                     text-white font-semibold rounded-lg flex items-center gap-2
                     transition-all duration-200"
        >
          {isAnalyzing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              生成归因地图...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              生成 3力3平台归因地图
            </>
          )}
        </button>
      </div>

      {/* 归因仪表盘 */}
      {dimensions.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              归因仪表盘
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
              <AlertCircle className="w-4 h-4" />
              <span>点击高亮卡片开始深度诊断</span>
            </div>
          </div>

          {/* 总体复盘 */}
          {summary && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">总体复盘</h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">{summary}</p>
            </div>
          )}

          {/* 3力 */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-primary-500 rounded-full" />
              3力（业务层）
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {dimensions
                .filter(d => d.category === 'force')
                .map(dimension => {
                  const Icon = DIMENSION_ICONS[dimension.id as DimensionType] || TrendingUp;
                  return (
                    <button
                      key={dimension.id}
                      onClick={() => handleSelectDimension(dimension)}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                        dimension.isHighlighted
                          ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:border-orange-500'
                          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-5 h-5 ${
                          dimension.isHighlighted ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-slate-400'
                        }`} />
                        <span className={`font-semibold ${
                          dimension.isHighlighted ? 'text-orange-900 dark:text-orange-100' : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {dimension.name}
                        </span>
                        {dimension.isHighlighted && (
                          <span className="ml-auto px-2 py-0.5 bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 text-xs rounded-full">
                            {dimension.score}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-slate-400 mb-2">
                        {DIMENSION_DESCRIPTIONS[dimension.id]}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                        {dimension.reason}
                      </p>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* 3平台 */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              3平台（支撑层）
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {dimensions
                .filter(d => d.category === 'platform')
                .map(dimension => {
                  const Icon = DIMENSION_ICONS[dimension.id as DimensionType] || Settings;
                  return (
                    <button
                      key={dimension.id}
                      onClick={() => handleSelectDimension(dimension)}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                        dimension.isHighlighted
                          ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:border-orange-500'
                          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-5 h-5 ${
                          dimension.isHighlighted ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-slate-400'
                        }`} />
                        <span className={`font-semibold ${
                          dimension.isHighlighted ? 'text-orange-900 dark:text-orange-100' : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {dimension.name}
                        </span>
                        {dimension.isHighlighted && (
                          <span className="ml-auto px-2 py-0.5 bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 text-xs rounded-full">
                            {dimension.score}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-slate-400 mb-2">
                        {DIMENSION_DESCRIPTIONS[dimension.id]}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                        {dimension.reason}
                      </p>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* 根因展示 */}
      {rootCause && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                已锁定核心短板
              </h4>
              <p className="text-green-800 dark:text-green-200">{rootCause}</p>
            </div>
          </div>
        </div>
      )}

      {/* 底部操作按钮 */}
      <div className="flex justify-between items-center">
        <button
          onClick={handleSave}
          className="px-6 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300
                     hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2
                     transition-all duration-200"
        >
          <Save className="w-4 h-4" />
          保存数据
        </button>
        <button
          onClick={handleNext}
          disabled={!goals.trim() || !actuals.trim()}
          className="px-8 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed
                     text-white font-medium rounded-lg flex items-center gap-2 transition-all duration-200"
        >
          下一步
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 诊断聊天对话框 */}
      {showChat && selectedDimension && (
        <DiagnosticChat
          dimensionId={selectedDimension.id}
          dimensionName={selectedDimension.name}
          initialMessage={initialChatMessage}
          messages={chatMessages}
          onMessagesChange={handleMessagesChange}
          onRootCauseExtracted={handleRootCauseExtracted}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
}
