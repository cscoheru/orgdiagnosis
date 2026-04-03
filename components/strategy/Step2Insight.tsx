'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Step2Data, KSFDimension, BenchmarkScore, CustomerInsight, CompetitorAnalysis, CompetitorAdvantage } from '@/types/strategy';
import {
  analyzeCustomerKBF,
  analyzeCompetitorCSF,
  extractKSFDimensions,
  generateBenchmarkScores,
  generateSWOTFromBenchmark,
  generateTOWSStrategies,
  generateProductCustomerMatrix,
  generateInsightSummary
} from '@/lib/zhipu-api';
import AIAnalysisChat from './AIAnalysisChat';
import {
  Save,
  ArrowLeft,
  ArrowRight,
  Edit2,
  Check,
  TrendingUp,
  Users,
  Award,
  Upload,
  X,
  Plus,
  ChevronRight,
  Target,
  BarChart3,
  Search,
  Eye,
  Lightbulb,
  AlertCircle,
  Shield,
  Sparkles
} from 'lucide-react';

export default function Step2Insight() {
  const { data, setData, modelConfig, setStep } = useStore();

  // ========== 原始输入 ==========
  const [trends, setTrends] = useState(data.step2?.trends || '');
  const [competitors, setCompetitors] = useState(data.step2?.competitors || '');
  const [companyInfo, setCompanyInfo] = useState(data.step2?.companyInfo || '');
  const [trendsFile, setTrendsFile] = useState<File | null>(null);
  const [competitorsFile, setCompetitorsFile] = useState<File | null>(null);

  // ========== 客户需求洞察（新增） ==========
  const [customerProfile, setCustomerProfile] = useState(data.step2?.customerInsight?.profile || '');
  const [kbfInput, setKbfInput] = useState('');
  const [customerKbf, setCustomerKbf] = useState<string[]>(data.step2?.customerInsight?.kbf || []);
  const [kbfLocked, setKbfLocked] = useState(data.step2?.customerInsight?.kbfLocked || false);
  const [kbvFeedback, setKbvFeedback] = useState<{ validated: boolean; feedback: string; suggestions: string[] } | null>(null);
  const [isValidatingKBF, setIsValidatingKBF] = useState(false);

  // ========== 竞对深度侦察（新增） ==========
  const [competitorSearchResults, setCompetitorSearchResults] = useState(data.step2?.competitorAnalysis?.searchResults || '');
  const [showCSFModal, setShowCSFModal] = useState(false);
  const [competitorAdvantages, setCompetitorAdvantages] = useState<CompetitorAdvantage[]>(
    data.step2?.competitorAnalysis?.advantages || []
  );
  const [analysisLocked, setAnalysisLocked] = useState(data.step2?.competitorAnalysis?.analysisLocked || false);
  const [isAnalyzingCSF, setIsAnalyzingCSF] = useState(false);

  // ========== KSF 维度 ==========
  const [ksfDimensions, setKsfDimensions] = useState<KSFDimension[]>(data.step2?.ksfDimensions || []);
  const [ksfLocked, setKsfLocked] = useState(data.step2?.ksfLocked || false);
  const [isAnalyzingKSF, setIsAnalyzingKSF] = useState(false);
  const [editingDimension, setEditingDimension] = useState<number | null>(null);
  const [newDimensionName, setNewDimensionName] = useState('');

  // ========== 竞争力对标 ==========
  const [benchmarkScores, setBenchmarkScores] = useState<BenchmarkScore[]>(data.step2?.benchmarkScores || []);
  const [benchmarkLocked, setBenchmarkLocked] = useState(data.step2?.benchmarkLocked || false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  // ========== SWOT 结果 ==========
  const [swot, setSwot] = useState(data.step2?.swot || { strengths: [], weaknesses: [], opportunities: [], threats: [] });
  const [strategicPoints, setStrategicPoints] = useState<string[]>(data.step2?.strategicPoints || []);
  const [swotLocked, setSwotLocked] = useState(data.step2?.swotLocked || false);
  const [isEditingSwot, setIsEditingSwot] = useState(false);

  // ========== 洞察小结（新增）==========
  const [insightSummary, setInsightSummary] = useState({
    strengths: data.step2?.insightSummary?.strengths || '',
    weaknesses: data.step2?.insightSummary?.weaknesses || '',
    opportunities: data.step2?.insightSummary?.opportunities || '',
    threats: data.step2?.insightSummary?.threats || ''
  });
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);

  // ========== TOWS 交叉策略推演（新增）==========
  const [towsStrategies, setTowsStrategies] = useState(data.step2?.towsStrategies || { so: [], wo: [], st: [], wt: [] });
  const [towsGenerated, setTowsGenerated] = useState(data.step2?.towsGenerated || false);
  const [isGeneratingTows, setIsGeneratingTows] = useState(false);

  // ========== 战略方向决策（新增）==========
  const [strategicDirection, setStrategicDirection] = useState<string | undefined>(data.step2?.strategicDirection);
  const [aiStrategicRecommendation, setAiStrategicRecommendation] = useState<string | undefined>(data.step2?.aiStrategicRecommendation);
  const [isAnalyzingDirection, setIsAnalyzingDirection] = useState(false);

  // ========== 产品-客户矩阵（新增）==========
  const [productCustomerMatrix, setProductCustomerMatrix] = useState(data.step2?.productCustomerMatrix || {
    marketPenetration: [],
    productDevelopment: [],
    marketDevelopment: [],
    diversification: []
  });
  const [matrixGenerated, setMatrixGenerated] = useState(data.step2?.matrixGenerated || false);
  const [isGeneratingMatrix, setIsGeneratingMatrix] = useState(false);

  // 数据恢复状态
  const [showDataRestored, setShowDataRestored] = useState(false);

  // 初始化加载 - 确保数据正确恢复
  useEffect(() => {
    const step2Data = data.step2;
    if (step2Data) {
      // 检查是否有有效数据
      const hasData =
        step2Data.trends ||
        step2Data.competitors ||
        step2Data.companyInfo ||
        step2Data.customerInsight?.profile ||
        (step2Data.customerInsight?.kbf && step2Data.customerInsight.kbf.length > 0) ||
        step2Data.ksfDimensions?.length > 0;

      if (hasData) {
        setTrends(step2Data.trends || '');
        setCompetitors(step2Data.competitors || '');
        setCompanyInfo(step2Data.companyInfo || '');

        // 恢复客户洞察数据
        if (step2Data.customerInsight) {
          setCustomerProfile(step2Data.customerInsight.profile || '');
          setCustomerKbf(step2Data.customerInsight.kbf || []);
          setKbfLocked(step2Data.customerInsight.kbfLocked || false);
        }

        // 恢复竞对分析数据
        if (step2Data.competitorAnalysis) {
          setCompetitorSearchResults(step2Data.competitorAnalysis.searchResults || '');
          setCompetitorAdvantages(step2Data.competitorAnalysis.advantages || []);
          setAnalysisLocked(step2Data.competitorAnalysis.analysisLocked || false);
        }

        // 恢复 KSF 维度
        setKsfDimensions(step2Data.ksfDimensions || []);
        setKsfLocked(step2Data.ksfLocked || false);

        // 恢复对标评分
        setBenchmarkScores(step2Data.benchmarkScores || []);
        setBenchmarkLocked(step2Data.benchmarkLocked || false);

        // 恢复 SWOT 结果
        setSwot(step2Data.swot || { strengths: [], weaknesses: [], opportunities: [], threats: [] });
        setSwotLocked(step2Data.swotLocked || false);
        setStrategicPoints(step2Data.strategicPoints || []);

        // 恢复洞察小结
        setInsightSummary(step2Data.insightSummary || {
          strengths: '',
          weaknesses: '',
          opportunities: '',
          threats: ''
        });

        // 恢复 TOWS 策略
        setTowsStrategies(step2Data.towsStrategies || { so: [], wo: [], st: [], wt: [] });
        setTowsGenerated(step2Data.towsGenerated || false);

        // 恢复战略方向
        setStrategicDirection(step2Data.strategicDirection);
        setAiStrategicRecommendation(step2Data.aiStrategicRecommendation);

        // 恢复产品-客户矩阵
        setProductCustomerMatrix(step2Data.productCustomerMatrix || {
          marketPenetration: [],
          productDevelopment: [],
          marketDevelopment: [],
          diversification: []
        });
        setMatrixGenerated(step2Data.matrixGenerated || false);

        // 显示数据恢复提示
        setShowDataRestored(true);
        setTimeout(() => setShowDataRestored(false), 3000);
      }
    }
  }, []); // 只在组件挂载时执行一次

  // ========== 实时计算 SWOT（对标打分联动）==========
  useEffect(() => {
    // 只有在未锁定 SWOT 编辑时才自动更新
    if (swotLocked || benchmarkScores.length === 0) return;

    // 实时计算 S 和 W（基于对标分数差异）
    const newStrengths: string[] = [];
    const newWeaknesses: string[] = [];

    benchmarkScores.forEach(score => {
      const diff = score.myScore - score.competitorScore;

      if (diff >= 1) {
        // 我司显著领先 -> 优势
        const reason = `我司在${score.dimensionName}上领先竞对${diff}分（${score.myScore} vs ${score.competitorScore}）`;
        if (!newStrengths.includes(reason)) {
          newStrengths.push(reason);
        }
      } else if (diff <= -1) {
        // 竞对显著领先 -> 劣势
        const reason = `我司在${score.dimensionName}上落后竞对${Math.abs(diff)}分（${score.myScore} vs ${score.competitorScore}）`;
        if (!newWeaknesses.includes(reason)) {
          newWeaknesses.push(reason);
        }
      }
      // 差异在 -1 到 1 之间视为"均势"，不显示在 S/W 中
    });

    // O 和 T 保持不变（来自行业趋势分析）
    setSwot(prev => ({
      ...prev,
      strengths: newStrengths,
      weaknesses: newWeaknesses
    }));
  }, [benchmarkScores, swotLocked]); // 监听对标分数变化

  // 文件上传处理（Mock）
  const handleFileUpload = async (file: File | null, type: 'trends' | 'competitors') => {
    if (!file) return;
    setTimeout(() => {
      const mockContent = `[文件内容] ${file.name}\n这是从文件中提取的模拟文本内容。`;
      if (type === 'trends') {
        setTrends(prev => prev + '\n' + mockContent);
      } else {
        setCompetitors(prev => prev + '\n' + mockContent);
      }
      alert(`文件 "${file.name}" 已上传（模拟读取）`);
    }, 500);
  };

  // ========== 客户需求洞察功能 ==========

  // 添加 KBF
  const handleAddKBF = () => {
    if (!kbfInput.trim()) return;
    setCustomerKbf([...customerKbf, kbfInput.trim()]);
    setKbfInput('');
    setKbvFeedback(null); // 清除之前的验证结果
  };

  // 删除 KBF
  const handleDeleteKBF = (index: number) => {
    setCustomerKbf(customerKbf.filter((_, i) => i !== index));
    setKbvFeedback(null);
  };

  // 验证 KBF
  const handleValidateKBF = async () => {
    if (!modelConfig.apiKey) {
      alert('请先配置 AI API Key');
      return;
    }
    if (customerKbf.length === 0) {
      alert('请先至少添加一个 KBF');
      return;
    }

    setIsValidatingKBF(true);
    try {
      const result = await analyzeCustomerKBF(
        modelConfig.apiKey,
        customerProfile,
        customerKbf,
        companyInfo.substring(0, 100) // 简单的行业推断
      );
      setKbvFeedback(result);
    } catch (error: any) {
      alert(`KBF 验证失败: ${error.message}`);
    } finally {
      setIsValidatingKBF(false);
    }
  };

  // 确认 KBF
  const handleConfirmKBF = () => {
    setKbfLocked(true);
  };

  // ========== 竞对深度侦察功能 ==========

  // AI 深度侦察
  const handleDeepReconnaissance = async () => {
    if (!modelConfig.apiKey) {
      alert('请先配置 AI API Key');
      return;
    }
    if (!competitors.trim() && !competitorSearchResults.trim()) {
      alert('请先填写竞对信息或粘贴搜索结果');
      return;
    }

    setIsAnalyzingCSF(true);
    try {
      const advantages = await analyzeCompetitorCSF(
        modelConfig.apiKey,
        competitors,
        competitorSearchResults
      );
      setCompetitorAdvantages(advantages);
      setShowCSFModal(false);
    } catch (error: any) {
      alert(`竞对分析失败: ${error.message}`);
    } finally {
      setIsAnalyzingCSF(false);
    }
  };

  // 手动添加竞对优势
  const handleAddManualAdvantage = () => {
    // 简化版：从竞对描述中提取
    const name = prompt('请输入竞对名称:');
    if (!name) return;
    const advantage = prompt('请输入该竞对的核心优势:');
    if (!advantage) return;

    setCompetitorAdvantages([
      ...competitorAdvantages,
      {
        id: `manual_${Date.now()}`,
        competitorName: name,
        advantage
      }
    ]);
  };

  // 删除竞对优势
  const handleDeleteAdvantage = (id: string) => {
    setCompetitorAdvantages(competitorAdvantages.filter(a => a.id !== id));
  };

  // 确认竞对分析
  const handleConfirmCompetitorAnalysis = () => {
    if (competitorAdvantages.length === 0) {
      alert('请先进行竞对分析或手动添加优势');
      return;
    }
    setAnalysisLocked(true);
  };

  // ========== KSF 提炼功能 ==========

  const handleExtractKSF = async () => {
    if (!modelConfig.apiKey) {
      alert('请先配置 AI API Key');
      return;
    }
    if (!kbfLocked) {
      alert('请先完成客户需求洞察并确认 KBF');
      return;
    }
    if (!analysisLocked) {
      alert('请先完成竞对深度侦察并确认');
      return;
    }
    if (!trends.trim()) {
      alert('请先填写行业趋势');
      return;
    }

    setIsAnalyzingKSF(true);
    try {
      const dimensions = await extractKSFDimensions(
        modelConfig.apiKey,
        trends,
        companyInfo,
        customerKbf,
        competitorAdvantages
      );
      setKsfDimensions(dimensions);
    } catch (error: any) {
      alert(`KSF 提取失败: ${error.message}`);
    } finally {
      setIsAnalyzingKSF(false);
    }
  };

  // ========== 竞争力对标功能 ==========

  const handleBenchmark = async () => {
    if (!modelConfig.apiKey) {
      alert('请先配置 AI API Key');
      return;
    }
    if (ksfDimensions.length === 0) {
      alert('请先提炼 KSF 维度');
      return;
    }

    setIsBenchmarking(true);
    try {
      const scores = await generateBenchmarkScores(
        modelConfig.apiKey,
        ksfDimensions,
        competitors,
        companyInfo
      );
      setBenchmarkScores(scores);
    } catch (error: any) {
      alert(`对标分析失败: ${error.message}`);
    } finally {
      setIsBenchmarking(false);
    }
  };

  // ========== SWOT 生成功能 ==========

  const handleGenerateSWOT = async () => {
    if (!modelConfig.apiKey) {
      alert('请先配置 AI API Key');
      return;
    }

    if (benchmarkScores.length === 0) {
      alert('请先完成竞争力对标');
      return;
    }

    setIsBenchmarking(true);
    try {
      // 1. 基于对标生成本地推导的 S 和 W
      const localStrengths: string[] = [];
      const localWeaknesses: string[] = [];

      benchmarkScores.forEach(score => {
        const diff = score.myScore - score.competitorScore;
        if (diff >= 1) {
          localStrengths.push(`我司在${score.dimensionName}上领先竞对${diff}分`);
        } else if (diff <= -1) {
          localWeaknesses.push(`我司在${score.dimensionName}上落后竞对${Math.abs(diff)}分`);
        }
      });

      // 2. 合并洞察小结和对标推导
      const finalSwot = {
        strengths: [
          ...localStrengths,  // 对标推导的优势
          ...(insightSummary.strengths ? insightSummary.strengths.split('\n').filter(s => s.trim()) : [])  // 洞察小结的优势
        ],
        weaknesses: [
          ...localWeaknesses,  // 对标推导的劣势
          ...(insightSummary.weaknesses ? insightSummary.weaknesses.split('\n').filter(w => w.trim()) : [])  // 洞察小结的劣势
        ],
        opportunities: insightSummary.opportunities ? insightSummary.opportunities.split('\n').filter(o => o.trim()) : [],
        threats: insightSummary.threats ? insightSummary.threats.split('\n').filter(t => t.trim()) : []
      };

      setSwot(finalSwot);
    } catch (error: any) {
      alert(`SWOT 生成失败: ${error.message}`);
    } finally {
      setIsBenchmarking(false);
    }
  };

  // ========== SWOT 编辑功能 ==========

  const handleAddSwotItem = (category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats', item: string) => {
    if (item.trim()) {
      setSwot(prev => ({
        ...prev,
        [category]: [...prev[category], item.trim()]
      }));
    }
  };

  const handleRemoveSwotItem = (category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats', index: number) => {
    setSwot(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index)
    }));
  };

  const handleUpdateSwotItem = (category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats', index: number, value: string) => {
    setSwot(prev => {
      const newItems = [...prev[category]];
      newItems[index] = value;
      return {
        ...prev,
        [category]: newItems
      };
    });
  };

  const handleLockSwot = () => {
    setSwotLocked(true);
  };

  // ========== 洞察小结功能 ==========

  const handleGenerateInsightSummary = async () => {
    if (!modelConfig.apiKey) {
      alert('请先配置 AI API Key');
      return;
    }

    // 检查是否有足够的数据
    const hasData = trends || competitors || companyInfo || customerProfile || competitorAdvantages.length > 0;
    if (!hasData) {
      alert('请先填写部分数据以便 AI 总结');
      return;
    }

    setIsGeneratingInsight(true);
    try {
      const summary = await generateInsightSummary(
        modelConfig.apiKey,
        trends,
        customerKbf,
        competitorAdvantages,
        companyInfo
      );

      setInsightSummary(summary);
    } catch (error: any) {
      alert(`洞察总结失败: ${error.message}`);
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const handleUpdateInsightSummary = (field: 'strengths' | 'weaknesses' | 'opportunities' | 'threats', value: string) => {
    setInsightSummary(prev => ({ ...prev, [field]: value }));
  };

  // ========== TOWS 交叉策略推演功能 ==========

  const handleGenerateTOWS = async () => {
    if (!modelConfig.apiKey) {
      alert('请先配置 AI API Key');
      return;
    }

    // 检查 SWOT 是否有内容
    const hasSWOTContent =
      swot.strengths.length > 0 ||
      swot.weaknesses.length > 0 ||
      swot.opportunities.length > 0 ||
      swot.threats.length > 0;

    if (!hasSWOTContent) {
      alert('请先生成 SWOT 矩阵');
      return;
    }

    setIsGeneratingTows(true);
    try {
      const result = await generateTOWSStrategies(
        modelConfig.apiKey,
        swot
      );

      setTowsStrategies({
        so: result.so,
        wo: result.wo,
        st: result.st,
        wt: result.wt
      });
      // AI recommendation is no longer part of TOWS result
      setAiStrategicRecommendation('');
      setTowsGenerated(true);
    } catch (error: any) {
      alert(`TOWS 分析失败: ${error.message}`);
    } finally {
      setIsGeneratingTows(false);
    }
  };

  // ========== 战略方向选择功能 ==========

  const handleSelectDirection = (direction: string) => {
    setStrategicDirection(direction);
  };

  // ========== 产品-客户矩阵生成功能 ==========

  const handleGenerateMatrix = async () => {
    if (!modelConfig.apiKey) {
      alert('请先配置 AI API Key');
      return;
    }

    if (!towsGenerated) {
      alert('请先生成 TOWS 交叉策略');
      return;
    }

    setIsGeneratingMatrix(true);
    try {
      const result = await generateProductCustomerMatrix(
        modelConfig.apiKey,
        swot,
        strategicDirection || ''
      );

      setProductCustomerMatrix(result);
      setMatrixGenerated(true);
    } catch (error: any) {
      alert(`产品-客户矩阵生成失败: ${error.message}`);
    } finally {
      setIsGeneratingMatrix(false);
    }
  };

  // ========== 其他功能 ==========

  const handleAddDimension = () => {
    if (!newDimensionName.trim()) return;
    const newDim: KSFDimension = {
      id: `custom_${Date.now()}`,
      name: newDimensionName,
      description: '自定义维度',
      reasoning: '用户手动添加'
    };
    setKsfDimensions([...ksfDimensions, newDim]);
    setNewDimensionName('');
  };

  const handleDeleteDimension = (id: string) => {
    setKsfDimensions(ksfDimensions.filter(d => d.id !== id));
  };

  const handleUpdateScore = (dimensionId: string, field: 'myScore' | 'competitorScore', value: number) => {
    setBenchmarkScores(benchmarkScores.map(s =>
      s.dimensionId === dimensionId ? { ...s, [field]: value } : s
    ));
  };

  // 保存数据
  const handleSave = () => {
    const step2Data: Step2Data = {
      trends,
      competitors,
      companyInfo,
      customerInsight: {
        profile: customerProfile,
        kbf: customerKbf,
        kbfLocked
      },
      competitorAnalysis: {
        advantages: competitorAdvantages,
        searchResults: competitorSearchResults,
        analysisLocked
      },
      ksfDimensions,
      ksfLocked,
      benchmarkScores,
      benchmarkLocked,
      insightSummary,
      swot,
      swotLocked,
      towsStrategies,
      towsGenerated,
      strategicDirection,
      aiStrategicRecommendation,
      productCustomerMatrix,
      matrixGenerated,
      strategicPoints
    };
    setData('step2', step2Data);
    alert('数据已保存');
  };

  // 下一步
  const handleNext = () => {
    if (!matrixGenerated) {
      alert('请完成所有分析步骤（包括产品-客户矩阵）后再进入下一步');
      return;
    }
    handleSave();
    setStep(3);
  };

  // 上一步
  const handlePrev = () => {
    handleSave();
    setStep(1);
  };

  // 计算当前进度
  const calculateProgress = () => {
    let completed = 0;
    let total = 8; // 更新为 8 个阶段（增加了洞察小结）

    if (trends.trim()) completed++;
    if (customerProfile.trim() && customerKbf.length >= 3 && kbfLocked) completed++;
    if (competitorAdvantages.length >= 2 && analysisLocked) completed++;
    if (ksfDimensions.length >= 3 && ksfLocked) completed++;
    if (benchmarkScores.length >= 3) completed++;
    if (swotLocked && swot.strengths.length > 0) completed++;
    if (towsGenerated && strategicDirection) completed++;
    if (matrixGenerated) completed++;

    return { completed, total, percentage: Math.round((completed / total) * 100) };
  };

  const progress = calculateProgress();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 数据恢复提示 */}
      {showDataRestored && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg animate-fade-in">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500" />
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          <div className={`p-2 rounded text-center ${trends.trim() ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
            1. 行业趋势
          </div>
          <div className={`p-2 rounded text-center ${customerProfile.trim() && customerKbf.length >= 3 && kbfLocked ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
            2. 客户洞察
          </div>
          <div className={`p-2 rounded text-center ${competitorAdvantages.length >= 2 && analysisLocked ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
            3. 竞对分析
          </div>
          <div className={`p-2 rounded text-center ${ksfDimensions.length >= 3 && ksfLocked ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
            4. KSF 提炼
          </div>
          <div className={`p-2 rounded text-center ${benchmarkScores.length >= 3 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
            5. 竞争对标
          </div>
          <div className={`p-2 rounded text-center ${swotLocked && swot.strengths.length > 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
            6. SWOT 分析
          </div>
          <div className={`p-2 rounded text-center ${towsGenerated && strategicDirection ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
            7. TOWS 推演
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Step 2: 行业竞争力建模与对标
        </h2>
        <p className="text-gray-600 dark:text-slate-400">
          数据收集 → 客户洞察 → 竞对侦察 → KSF 提炼 → 竞争对标 → SWOT 分析 → TOWS 推演 → 战略矩阵
        </p>
      </div>

      {/* ========== 阶段 1: 数据收集与深度分析 ========== */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-500 text-white text-sm">1</span>
          数据收集与深度分析
        </h3>

        <div className="grid grid-cols-1 gap-6">
          {/* 1.1 行业趋势 */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
            <label className="flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary-500" />
                行业趋势
              </div>
            </label>
            <textarea
              value={trends}
              onChange={(e) => setTrends(e.target.value)}
              placeholder="请描述行业发展趋势、政策变化、技术革新等..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg
                         bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-primary-500
                         resize-none transition-all duration-200"
            />

            {/* AI 助手 */}
            <div className="mt-4">
              <AIAnalysisChat
                apiKey={modelConfig.apiKey}
                module="trends"
                title="行业趋势分析助手"
                placeholder="例如：行业正经历数字化转型..."
                currentValue={trends}
                onValueChange={setTrends}
                onAnalysisComplete={(data) => {
                  if (data.length > 0) {
                    setTrends(prev => prev ? prev + '\n' + data.join('\n') : data.join('\n'));
                  }
                }}
              />
            </div>
          </div>

          {/* 1.2 客户需求洞察（新增模块） */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
              <Eye className="w-4 h-4 text-blue-500" />
              客户需求洞察
              <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded-full">
                新增
              </span>
            </div>

            {/* 典型客户画像 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                典型客户画像
              </label>
              <textarea
                value={customerProfile}
                onChange={(e) => setCustomerProfile(e.target.value)}
                placeholder="描述核心买单的人是谁？例如：华东地区中小制造企业的采购经理，35-45岁，关注性价比..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg
                           bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-blue-500
                           resize-none transition-all duration-200"
              />

              {/* 客户画像 AI 助手 */}
              <div className="mt-2">
                <AIAnalysisChat
                  apiKey={modelConfig.apiKey}
                  module="customer"
                  title="客户画像分析助手"
                  placeholder="例如：核心客户是华东地区中小制造企业..."
                  currentValue={customerProfile}
                  onValueChange={setCustomerProfile}
                  onAnalysisComplete={(data) => {
                    if (data.length > 0) {
                      setCustomerProfile(prev => prev ? prev + '\n' + data.join('\n') : data.join('\n'));
                    }
                  }}
                />
              </div>
            </div>

            {/* 关键购买因素 (KBF) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                关键购买因素 (KBF)
                <span className="ml-2 text-xs text-gray-500 dark:text-slate-400">
                  客户在做购买决策时最看重哪 3-5 点？
                </span>
              </label>

              {!kbfLocked ? (
                <div className="space-y-3">
                  {/* KBF 标签列表 */}
                  {customerKbf.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {customerKbf.map((kbf, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20
                                     border border-blue-200 dark:border-blue-800 rounded-full"
                        >
                          <span className="text-sm text-blue-700 dark:text-blue-300">{kbf}</span>
                          <button
                            onClick={() => handleDeleteKBF(index)}
                            className="text-blue-500 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 添加 KBF 输入框 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={kbfInput}
                      onChange={(e) => setKbfInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddKBF()}
                      placeholder="例如：账期、次品率、交付周期..."
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg
                                 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100
                                 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleAddKBF}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg
                                 flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      添加
                    </button>
                  </div>

                  {/* 验证和确认按钮 */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleValidateKBF}
                      disabled={isValidatingKBF || customerKbf.length === 0}
                      className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400
                                 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                      {isValidatingKBF ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          验证中...
                        </>
                      ) : (
                        <>
                          <Lightbulb className="w-4 h-4" />
                          AI 验证 KBF
                        </>
                      )}
                    </button>

                    {kbvFeedback?.validated && (
                      <button
                        onClick={handleConfirmKBF}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg
                                   flex items-center gap-2 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        确认 KBF
                      </button>
                    )}
                  </div>

                  {/* 验证反馈 */}
                  {kbvFeedback && (
                    <div className={`p-4 rounded-lg ${
                      kbvFeedback.validated
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                    }`}>
                      <div className="flex items-start gap-2">
                        {kbvFeedback.validated ? (
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm text-gray-700 dark:text-gray-300">{kbvFeedback.feedback}</p>
                          {kbvFeedback.suggestions.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                建议补充：
                              </p>
                              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                {kbvFeedback.suggestions.map((suggestion, i) => (
                                  <li key={i}>• {suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20
                               border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">
                        KBF 已确认 ({customerKbf.length} 条)
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {customerKbf.join('、')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setKbfLocked(false)}
                    className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-500"
                  >
                    解锁修改
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 1.3 竞对深度侦察（升级模块） */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <Shield className="w-4 h-4 text-orange-500" />
                竞对深度侦察
                <span className="ml-2 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs rounded-full">
                  升级
                </span>
              </div>
            </div>

            {/* 基础竞对信息 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                竞对基本信息
              </label>
              <textarea
                value={competitors}
                onChange={(e) => setCompetitors(e.target.value)}
                placeholder="请描述主要竞争对手的情况、市场份额、优劣势等..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg
                           bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-orange-500
                           resize-none transition-all duration-200"
              />
            </div>

            {/* 网络搜索结果粘贴区 */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Search className="w-4 h-4" />
                网络搜索结果（可选）
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  将搜索到的竞对新闻/财报粘贴到这里
                </span>
              </label>
              <textarea
                value={competitorSearchResults}
                onChange={(e) => setCompetitorSearchResults(e.target.value)}
                placeholder="粘贴从搜索引擎、新闻网站、财报等渠道获取的竞对信息..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg
                           bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-orange-500
                           resize-none transition-all duration-200 text-sm"
              />

              {/* 竞对分析 AI 助手 */}
              <div className="mt-2">
                <AIAnalysisChat
                  apiKey={modelConfig.apiKey}
                  module="competitors"
                  title="竞对分析助手"
                  placeholder="例如：主要竞对A公司市场份额30%..."
                  currentValue={competitors}
                  onValueChange={setCompetitors}
                  onAnalysisComplete={(data) => {
                    if (data.length > 0) {
                      setCompetitors(prev => prev ? prev + '\n' + data.join('\n') : data.join('\n'));
                    }
                  }}
                />
              </div>
            </div>

            {/* 操作按钮 */}
            {!analysisLocked ? (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDeepReconnaissance}
                  disabled={isAnalyzingCSF}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400
                             text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  {isAnalyzingCSF ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      AI 深度侦察
                    </>
                  )}
                </button>

                <button
                  onClick={handleAddManualAdvantage}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg
                             flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  手动添加优势
                </button>

                {competitorAdvantages.length > 0 && (
                  <button
                    onClick={handleConfirmCompetitorAnalysis}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg
                               flex items-center gap-2 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    确认分析结果
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20
                             border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    竞对分析已完成 ({competitorAdvantages.length} 条优势)
                  </p>
                </div>
                <button
                  onClick={() => setAnalysisLocked(false)}
                  className="text-sm text-gray-600 dark:text-slate-400 hover:text-orange-500"
                >
                  解锁修改
                </button>
              </div>
            )}

            {/* 竞对优势清单展示 */}
            {competitorAdvantages.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  竞对优势清单 (CSF)
                </h4>
                <div className="space-y-2">
                  {competitorAdvantages.map((advantage) => (
                    <div
                      key={advantage.id}
                      className="flex items-start justify-between p-3 bg-white dark:bg-slate-800
                                 border border-gray-200 dark:border-slate-600 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {advantage.competitorName}
                          </span>
                          {advantage.category && (
                            <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30
                                           text-orange-600 dark:text-orange-400 text-xs rounded-full">
                              {advantage.category}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                          核心优势：{advantage.advantage}
                        </p>
                      </div>
                      {!analysisLocked && (
                        <button
                          onClick={() => handleDeleteAdvantage(advantage.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 1.4 本公司信息 */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              <Award className="w-4 h-4 text-primary-500" />
              本公司详细信息
            </label>
            <textarea
              value={companyInfo}
              onChange={(e) => setCompanyInfo(e.target.value)}
              placeholder="请描述公司的现状、财务状况、技术实力、团队规模等关键信息..."
              rows={5}
              className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg
                         bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-primary-500
                         resize-none transition-all duration-200"
            />

            {/* 公司信息 AI 助手 */}
            <div className="mt-4">
              <AIAnalysisChat
                apiKey={modelConfig.apiKey}
                module="company"
                title="企业诊断助手"
                placeholder="例如：公司成立于2020年，目前团队规模50人..."
                currentValue={companyInfo}
                onValueChange={setCompanyInfo}
                onAnalysisComplete={(data) => {
                  if (data.length > 0) {
                    setCompanyInfo(prev => prev ? prev + '\n' + data.join('\n') : data.join('\n'));
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========== 洞察小结（新增）========== */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500 text-white text-sm">1.5</span>
          洞察小结 (SWOT 基础)
        </h3>

        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              💡 <strong>提示：</strong>这是基于您收集的行业、竞对、客户信息进行的人工总结或 AI 总结。这些内容将与后续的"竞争力对标推导"合并，生成最终的 SWOT 矩阵。
            </p>
          </div>

          {/* AI 总结按钮 */}
          <div className="flex justify-center mb-4">
            <button
              onClick={handleGenerateInsightSummary}
              disabled={isGeneratingInsight}
              className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 text-white font-medium rounded-lg flex items-center gap-2 transition-all duration-200"
            >
              {isGeneratingInsight ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  AI 总结中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI 洞察总结
                </>
              )}
            </button>
          </div>

          {/* 四个文本域 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 优势 S */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                优势 (Strengths)
                <span className="ml-2 text-xs text-gray-500 dark:text-slate-400">
                  我司的核心竞争力、资源优势
                </span>
              </label>
              <textarea
                value={insightSummary.strengths}
                onChange={(e) => handleUpdateInsightSummary('strengths', e.target.value)}
                placeholder="例如：行业领先的技术、强大的销售团队、品牌知名度..."
                rows={5}
                className="w-full px-3 py-2 border border-green-300 dark:border-green-700 rounded-lg
                           bg-green-50 dark:bg-green-900/10 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-green-500
                           placeholder:text-gray-400 dark:placeholder:text-slate-500 resize-none text-sm"
              />
            </div>

            {/* 劣势 W */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                劣势 (Weaknesses)
                <span className="ml-2 text-xs text-gray-500 dark:text-slate-400">
                  我司的短板、资源约束
                </span>
              </label>
              <textarea
                value={insightSummary.weaknesses}
                onChange={(e) => handleUpdateInsightSummary('weaknesses', e.target.value)}
                placeholder="例如：产能不足、技术研发滞后、资金紧张..."
                rows={5}
                className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg
                           bg-red-50 dark:bg-red-900/10 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-red-500
                           placeholder:text-gray-400 dark:placeholder:text-slate-500 resize-none text-sm"
              />
            </div>

            {/* 机会 O */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                机会 (Opportunities)
                <span className="ml-2 text-xs text-gray-500 dark:text-slate-400">
                  行业趋势中的增长点、政策红利
                </span>
              </label>
              <textarea
                value={insightSummary.opportunities}
                onChange={(e) => handleUpdateInsightSummary('opportunities', e.target.value)}
                placeholder="例如：新能源政策扶持、下游需求快速增长、出口市场开放..."
                rows={5}
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg
                           bg-blue-50 dark:bg-blue-900/10 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-blue-500
                           placeholder:text-gray-400 dark:placeholder:text-slate-500 resize-none text-sm"
              />
            </div>

            {/* 威胁 T */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                威胁 (Threats)
                <span className="ml-2 text-xs text-gray-500 dark:text-slate-400">
                  竞争压力、行业风险、政策变化
                </span>
              </label>
              <textarea
                value={insightSummary.threats}
                onChange={(e) => handleUpdateInsightSummary('threats', e.target.value)}
                placeholder="例如：竞对价格战、原材料价格上涨、环保法规趋严..."
                rows={5}
                className="w-full px-3 py-2 border border-yellow-300 dark:border-yellow-700 rounded-lg
                           bg-yellow-50 dark:bg-yellow-900/10 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-yellow-500
                           placeholder:text-gray-400 dark:placeholder:text-slate-500 resize-none text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========== 阶段 2: KSF 提炼（带推导理由） ========== */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-500 text-white text-sm">2</span>
          提炼行业关键成功要素 (KSF)
          <span className="ml-2 text-xs font-normal text-gray-500 dark:text-slate-400">
            公式：KSF = 满足客户 KBF 的能力 + 抵御竞对 CSF 的能力
          </span>
        </h3>

        {/* 前置条件提示 */}
        {(!kbfLocked || !analysisLocked) && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                  请先完成前置分析
                </p>
                <ul className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 space-y-1">
                  {!kbfLocked && <li>• 完成客户需求洞察并确认 KBF</li>}
                  {!analysisLocked && <li>• 完成竞对深度侦察并确认</li>}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center mb-6">
          <button
            onClick={handleExtractKSF}
            disabled={isAnalyzingKSF || ksfLocked || !kbfLocked || !analysisLocked}
            className="px-8 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed
                       text-white font-semibold rounded-lg flex items-center gap-2 transition-all duration-200"
          >
            {isAnalyzingKSF ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Target className="w-5 h-5" />
                基于逻辑链提炼 KSF
              </>
            )}
          </button>
        </div>

        {ksfDimensions.length > 0 && (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                AI 推荐的 KSF 维度（含推导理由）
              </h4>
              {!ksfLocked && (
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  可以编辑、删除或添加维度
                </div>
              )}
            </div>

            <div className="space-y-4 mb-4">
              {ksfDimensions.map((dim, index) => (
                <div
                  key={dim.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    ksfLocked
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      {editingDimension === index ? (
                        <input
                          type="text"
                          value={dim.name}
                          onChange={(e) => {
                            const newDims = [...ksfDimensions];
                            newDims[index].name = e.target.value;
                            setKsfDimensions(newDims);
                          }}
                          onBlur={() => setEditingDimension(null)}
                          onKeyPress={(e) => e.key === 'Enter' && setEditingDimension(null)}
                          className="bg-white dark:bg-slate-800 px-3 py-1 rounded text-sm
                                     focus:outline-none focus:ring-2 focus:ring-primary-500 font-semibold"
                          autoFocus
                        />
                      ) : (
                        <h5 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                          {dim.name}
                        </h5>
                      )}
                    </div>
                    {!ksfLocked && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingDimension(index)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-slate-600 rounded"
                          title="编辑"
                        >
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => handleDeleteDimension(dim.id)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                          title="删除"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                    {dim.description}
                  </p>

                  {/* 推导理由（新增显示） */}
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-r">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                          推导理由
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          {dim.reasoning}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 添加自定义维度 */}
            {!ksfLocked && (
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newDimensionName}
                  onChange={(e) => setNewDimensionName(e.target.value)}
                  placeholder="添加自定义维度..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg
                             bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddDimension()}
                />
                <button
                  onClick={handleAddDimension}
                  className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200
                             dark:hover:bg-slate-600 rounded-lg flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  添加
                </button>
              </div>
            )}

            {!ksfLocked ? (
              <button
                onClick={() => setKsfLocked(true)}
                className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                <Check className="w-4 h-4 inline mr-2" />
                确认锁定维度
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">维度已锁定</span>
                <button
                  onClick={() => setKsfLocked(false)}
                  className="ml-4 text-sm text-gray-600 dark:text-slate-400 hover:text-primary-500"
                >
                  解锁
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========== 阶段 3: 竞争力对标 ========== */}
      {ksfLocked && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-500 text-white text-sm">3</span>
            竞争力对标打分
          </h3>

          <div className="flex justify-center mb-6">
            <button
              onClick={handleBenchmark}
              disabled={isBenchmarking}
              className="px-8 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed
                         text-white font-semibold rounded-lg flex items-center gap-2 transition-all duration-200"
            >
              {isBenchmarking ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  分析中...
                </>
              ) : benchmarkScores.length > 0 ? (
                <>
                  <BarChart3 className="w-5 h-5" />
                  重新分析
                </>
              ) : (
                <>
                  <BarChart3 className="w-5 h-5" />
                  开始对标分析
                </>
              )}
            </button>
          </div>

          {benchmarkScores.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  竞争力评分对比
                </h4>
                {!benchmarkLocked && (
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    可拖动滑块调整评分
                  </p>
                )}
              </div>

              <div className="space-y-6">
                {benchmarkScores.map((score) => {
                  const myScoreColor = score.myScore >= 7 ? 'bg-green-500' : score.myScore >= 5 ? 'bg-yellow-500' : 'bg-red-500';
                  const competitorColor = score.competitorScore >= 7 ? 'bg-green-500' : score.competitorScore >= 5 ? 'bg-yellow-500' : 'bg-red-500';

                  return (
                    <div key={score.dimensionId} className="border-b border-gray-200 dark:border-slate-700 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{score.dimensionName}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                          score.ranking === 'high' ? 'bg-green-500' : score.ranking === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}>
                          {score.ranking === 'high' ? '高' : score.ranking === 'medium' ? '中' : '低'}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {/* 我司评分 */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600 dark:text-slate-400">我司评分</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{score.myScore}/10</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={score.myScore}
                              onChange={(e) => handleUpdateScore(score.dimensionId, 'myScore', Number(e.target.value))}
                              disabled={benchmarkLocked}
                              className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div className={`w-3 h-3 rounded-full ${myScoreColor}`} />
                          </div>
                        </div>

                        {/* 竞对评分 */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600 dark:text-slate-400">主要竞对</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{score.competitorScore}/10</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={score.competitorScore}
                              onChange={(e) => handleUpdateScore(score.dimensionId, 'competitorScore', Number(e.target.value))}
                              disabled={benchmarkLocked}
                              className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div className={`w-3 h-3 rounded-full ${competitorColor}`} />
                          </div>
                        </div>
                      </div>

                      {!benchmarkLocked && (
                        <button
                          onClick={() => setBenchmarkLocked(true)}
                          className="mt-3 w-full py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          确认评分
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {benchmarkLocked && (
                <div className="mt-6 flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">对标分析已完成</span>
                  <button
                    onClick={() => setBenchmarkLocked(false)}
                    className="ml-4 text-sm text-gray-600 dark:text-slate-400 hover:text-primary-500"
                  >
                    重新调整
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========== 阶段 4: SWOT 生成 ========== */}
      {benchmarkLocked && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-500 text-white text-sm">4</span>
            SWOT 分析生成
          </h3>

          {swot.strengths.length === 0 && (
            <div className="flex justify-center mb-6">
              <button
                onClick={handleGenerateSWOT}
                className="px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg flex items-center gap-2 transition-all duration-200"
              >
                <Target className="w-5 h-5" />
                生成 SWOT 矩阵
              </button>
            </div>
          )}

          {swot.strengths.length > 0 && (
            <>
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    SWOT 分析矩阵
                  </h4>
                  {!swotLocked && swot.strengths.length > 0 && (
                    <button
                      onClick={handleLockSwot}
                      className="text-sm px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      锁定编辑
                    </button>
                  )}
                  {swotLocked && (
                    <button
                      onClick={() => setSwotLocked(false)}
                      className="text-sm text-gray-600 dark:text-slate-400 hover:text-primary-500 flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      解锁编辑
                    </button>
                  )}
                </div>

                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    💡 <strong>提示：</strong>优势/劣势基于对标分数自动计算（我司分 - 竞对分 ≥ 1 为优势，≤ -1 为劣势）。您可以手动添加、编辑或删除条目。
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SwotSection
                    title="优势 (Strengths)"
                    color="green"
                    items={swot.strengths}
                    onAdd={(item) => handleAddSwotItem('strengths', item)}
                    onRemove={(index) => handleRemoveSwotItem('strengths', index)}
                    onUpdate={(index, value) => handleUpdateSwotItem('strengths', index, value)}
                    locked={swotLocked}
                  />
                  <SwotSection
                    title="劣势 (Weaknesses)"
                    color="red"
                    items={swot.weaknesses}
                    onAdd={(item) => handleAddSwotItem('weaknesses', item)}
                    onRemove={(index) => handleRemoveSwotItem('weaknesses', index)}
                    onUpdate={(index, value) => handleUpdateSwotItem('weaknesses', index, value)}
                    locked={swotLocked}
                  />
                  <SwotSection
                    title="机会 (Opportunities)"
                    color="blue"
                    items={swot.opportunities}
                    onAdd={(item) => handleAddSwotItem('opportunities', item)}
                    onRemove={(index) => handleRemoveSwotItem('opportunities', index)}
                    onUpdate={(index, value) => handleUpdateSwotItem('opportunities', index, value)}
                    locked={swotLocked}
                  />
                  <SwotSection
                    title="威胁 (Threats)"
                    color="yellow"
                    items={swot.threats}
                    onAdd={(item) => handleAddSwotItem('threats', item)}
                    onRemove={(index) => handleRemoveSwotItem('threats', index)}
                    onUpdate={(index, value) => handleUpdateSwotItem('threats', index, value)}
                    locked={swotLocked}
                  />
                </div>
              </div>
            </>
          )}

          {/* ========== TOWS 交叉策略摘要（新增）========== */}
          {towsGenerated && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-purple-500 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                    TOWS 交叉策略摘要
                  </h4>
                  <p className="text-xs text-purple-700 dark:text-purple-300 mb-3">
                    💡 下方的策略组合由 AI 基于当前 SWOT 分析生成。您可以在此基础上进行人工修订、补充或总结。
                  </p>

                  {/* 可编辑的 TOWS 摘要 Textarea */}
                  <textarea
                    value={`${towsStrategies.so.map((s, i) => `[SO] ${s}`).join('\n')}\n\n${towsStrategies.wo.map((w, i) => `[WO] ${w}`).join('\n')}\n\n${towsStrategies.st.map((s, i) => `[ST] ${s}`).join('\n')}\n\n${towsStrategies.wt.map((w, i) => `[WT] ${w}`).join('\n')}`}
                    onChange={(e) => {
                      const text = e.target.value;
                      const lines = text.split('\n');
                      const so: string[] = [];
                      const wo: string[] = [];
                      const st: string[] = [];
                      const wt: string[] = [];
                      let currentArray = so;

                      lines.forEach(line => {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('[SO]')) {
                          currentArray = so;
                          if (trimmed.length > 4) so.push(trimmed.substring(4).trim());
                        } else if (trimmed.startsWith('[WO]')) {
                          currentArray = wo;
                          if (trimmed.length > 4) wo.push(trimmed.substring(4).trim());
                        } else if (trimmed.startsWith('[ST]')) {
                          currentArray = st;
                          if (trimmed.length > 4) st.push(trimmed.substring(4).trim());
                        } else if (trimmed.startsWith('[WT]')) {
                          currentArray = wt;
                          if (trimmed.length > 4) wt.push(trimmed.substring(4).trim());
                        } else if (trimmed && currentArray) {
                          currentArray.push(trimmed);
                        }
                      });

                      setTowsStrategies({ so, wo, st, wt });
                    }}
                    className="w-full h-64 px-4 py-3 border border-purple-300 dark:border-purple-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="在此编辑 TOWS 策略摘要...

格式示例：
[SO] 利用技术领先优势拓展高端市场
[SO] 发挥品牌优势把握政策红利

[WO] 通过战略合作补齐产能短板
[WO] 引入人才提升研发能力

[ST] 发挥成本优势抵御价格战
[ST] 强化客户关系抵御竞对冲击

[WT] 收缩非核心业务降低风险
[WT] 优化成本结构提升生存能力"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== 阶段 5: TOWS 交叉策略推演（新增）========== */}
      {swot.strengths.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500 text-white text-sm">5</span>
            SWOT 交叉策略推演（TOWS）
          </h3>

          {!towsGenerated ? (
            <div className="flex justify-center mb-6">
              <button
                onClick={handleGenerateTOWS}
                disabled={isGeneratingTows}
                className="px-8 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white font-semibold rounded-lg flex items-center gap-2 transition-all duration-200"
              >
                {isGeneratingTows ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    生成 TOWS 交叉策略
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              {/* AI 战略基调建议 */}
              {aiStrategicRecommendation && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6 mb-6">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-6 h-6 text-purple-500 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                        AI 战略基调建议
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                        {aiStrategicRecommendation}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TOWS 矩阵 */}
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6 mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  TOWS 交叉策略矩阵
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SO 策略 */}
                  <div className="border-l-4 border-green-500 pl-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-semibold rounded">SO</span>
                      <h5 className="font-medium text-gray-900 dark:text-gray-100">追击型（优势+机会）</h5>
                    </div>
                    <ul className="space-y-2">
                      {towsStrategies.so.map((item, index) => (
                        <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* WO 策略 */}
                  <div className="border-l-4 border-blue-500 pl-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded">WO</span>
                      <h5 className="font-medium text-gray-900 dark:text-gray-100">改进型（劣势+机会）</h5>
                    </div>
                    <ul className="space-y-2">
                      {towsStrategies.wo.map((item, index) => (
                        <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* ST 策略 */}
                  <div className="border-l-4 border-yellow-500 pl-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-semibold rounded">ST</span>
                      <h5 className="font-medium text-gray-900 dark:text-gray-100">防御型（优势+威胁）</h5>
                    </div>
                    <ul className="space-y-2">
                      {towsStrategies.st.map((item, index) => (
                        <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* WT 策略 */}
                  <div className="border-l-4 border-red-500 pl-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-semibold rounded">WT</span>
                      <h5 className="font-medium text-gray-900 dark:text-gray-100">止损型（劣势+威胁）</h5>
                    </div>
                    <ul className="space-y-2">
                      {towsStrategies.wt.map((item, index) => (
                        <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* 重新生成按钮 */}
              <div className="text-center">
                <button
                  onClick={() => setTowsGenerated(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-purple-500"
                >
                  重新分析 TOWS
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========== 阶段 6: 战略方向决策（新增）========== */}
      {towsGenerated && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500 text-white text-sm">6</span>
            战略方向选择
          </h3>

          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              请根据 TOWS 分析结果，选择企业的总体战略方向：
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { id: 'expansion', name: '扩张型', desc: '积极进取，扩大市场份额', color: 'blue' },
                { id: 'diversification', name: '多元化', desc: '多产品多市场，分散风险', color: 'purple' },
                { id: 'stability', name: '稳定型', desc: '保持现状，巩固优势', color: 'green' },
                { id: 'defensive', name: '收缩型', desc: '聚焦核心，减少投入', color: 'yellow' }
              ].map(direction => {
                const isSelected = strategicDirection === direction.id;
                const colorClasses = {
                  blue: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30',
                  purple: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30',
                  green: 'border-green-500 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30',
                  yellow: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                };
                return (
                  <button
                    key={direction.id}
                    onClick={() => handleSelectDirection(direction.id)}
                    className={`p-4 border-2 rounded-lg transition-all text-left ${
                      isSelected
                        ? colorClasses[direction.color as keyof typeof colorClasses].replace('hover:', '').replace('/30', '/40')
                        : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div className={`font-semibold text-sm mb-1 ${isSelected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-slate-400'}`}>
                      {direction.name}
                    </div>
                    <div className={`text-xs ${isSelected ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-slate-500'}`}>
                      {direction.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {strategicDirection && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300">
                  ✅ 已选择战略方向：<strong>{strategicDirection === 'expansion' ? '扩张型' : strategicDirection === 'diversification' ? '多元化' : strategicDirection === 'stability' ? '稳定型' : '收缩型'}</strong>
                </p>
              </div>
            )}
          </div>

          {/* 生成产品-客户矩阵按钮 */}
          {strategicDirection && !matrixGenerated && (
            <div className="flex justify-center mt-6">
              <button
                onClick={handleGenerateMatrix}
                disabled={isGeneratingMatrix}
                className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 text-white font-semibold rounded-lg flex items-center gap-2 transition-all duration-200"
              >
                {isGeneratingMatrix ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-5 h-5" />
                    生成产品-客户矩阵
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========== 阶段 7: 产品-客户矩阵（新增）========== */}
      {matrixGenerated && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-pink-500 text-white text-sm">7</span>
            产品-客户战略矩阵（安索夫矩阵）
          </h3>

          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 市场渗透：老客户+老产品 */}
              <div className="border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/10">
                <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                  <span className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs font-semibold rounded">老客户 + 老产品</span>
                  市场渗透
                </h4>
                <ul className="space-y-2">
                  {productCustomerMatrix.marketPenetration.map((item, index) => (
                    <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <span className="text-blue-500 font-semibold">{index + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 产品开发：老客户+新产品 */}
              <div className="border-2 border-purple-200 dark:border-purple-800 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/10">
                <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">
                  <span className="px-2 py-1 bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 text-xs font-semibold rounded">老客户 + 新产品</span>
                  产品开发
                </h4>
                <ul className="space-y-2">
                  {productCustomerMatrix.productDevelopment.map((item, index) => (
                    <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <span className="text-purple-500 font-semibold">{index + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 市场开发：新客户+老产品 */}
              <div className="border-2 border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-900/10">
                <h4 className="font-semibold text-green-700 dark:text-green-300 mb-3 flex items-center gap-2">
                  <span className="px-2 py-1 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs font-semibold rounded">新客户 + 老产品</span>
                  市场开发
                </h4>
                <ul className="space-y-2">
                  {productCustomerMatrix.marketDevelopment.map((item, index) => (
                    <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <span className="text-green-500 font-semibold">{index + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 多元化：新客户+新产品 */}
              <div className="border-2 border-pink-200 dark:border-pink-800 rounded-lg p-4 bg-pink-50 dark:bg-pink-900/10">
                <h4 className="font-semibold text-pink-700 dark:text-pink-300 mb-3 flex items-center gap-2">
                  <span className="px-2 py-1 bg-pink-200 dark:bg-pink-800 text-pink-800 dark:text-pink-200 text-xs font-semibold rounded">新客户 + 新产品</span>
                  多元化
                </h4>
                <ul className="space-y-2">
                  {productCustomerMatrix.diversification.map((item, index) => (
                    <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <span className="text-pink-500 font-semibold">{index + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 重新生成按钮 */}
            <div className="text-center mt-6">
              <button
                onClick={() => setMatrixGenerated(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-pink-500"
              >
                重新生成产品-客户矩阵
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部操作按钮 */}
      <div className="flex justify-between items-center">
        <button
          onClick={handlePrev}
          className="px-6 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          上一步
        </button>
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            className="px-6 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 transition-all duration-200"
          >
            <Save className="w-4 h-4" />
            保存数据
          </button>
          <button
            onClick={handleNext}
            disabled={strategicPoints.length === 0}
            className="px-8 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-2 transition-all duration-200"
          >
            下一步
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SwotSection({
  title,
  color,
  items,
  onAdd,
  onRemove,
  onUpdate,
  locked
}: {
  title: string;
  color: 'green' | 'red' | 'blue' | 'yellow';
  items: string[];
  onAdd?: (item: string) => void;
  onRemove?: (index: number) => void;
  onUpdate?: (index: number, value: string) => void;
  locked?: boolean;
}) {
  const colorClasses = {
    green: 'border-green-500 bg-green-50 dark:bg-green-900/20',
    red: 'border-red-500 bg-red-50 dark:bg-red-900/20',
    blue: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
    yellow: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
  };

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleStartEdit = (index: number, item: string) => {
    setEditingIndex(index);
    setEditValue(item);
  };

  const handleSaveEdit = (index: number) => {
    if (onUpdate && editValue.trim()) {
      onUpdate(index, editValue.trim());
    }
    setEditingIndex(null);
    setEditValue('');
  };

  const handleAddNewItem = () => {
    const newItem = prompt('请输入新的条目:');
    if (newItem && onAdd) {
      onAdd(newItem.trim());
    }
  };

  return (
    <div className={`border-l-4 p-4 rounded-r-lg ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h4>
        {!locked && (
          <button
            onClick={handleAddNewItem}
            className="text-xs px-2 py-1 bg-white dark:bg-slate-700 rounded hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
            title="添加新条目"
          >
            + 添加
          </button>
        )}
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2 group">
            {editingIndex === index ? (
              <>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit(index)}
                  onBlur={() => handleSaveEdit(index)}
                  className={`flex-1 px-2 py-1 text-sm rounded border-2 ${colorClasses[color].split(' ').filter(c => c.includes('border-')).join(' ')}`}
                  autoFocus
                />
                <button
                  onClick={() => handleSaveEdit(index)}
                  className="text-green-500 hover:text-green-600"
                >
                  <Check className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">• {item}</span>
                {!locked && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartEdit(index, item)}
                      className="text-gray-400 hover:text-blue-500"
                      title="编辑"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onRemove && onRemove(index)}
                      className="text-gray-400 hover:text-red-500"
                      title="删除"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-sm text-gray-400 dark:text-slate-500 italic">
            暂无内容
          </li>
        )}
      </ul>
    </div>
  );
}
