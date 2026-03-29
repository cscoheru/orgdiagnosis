'use client';

import type { CompetencyOutput } from '@/lib/workshop/competency-types';

interface DataFlowDiagramProps {
  meta: CompetencyOutput['meta'];
}

const SOURCES = [
  { name: '交付管理访谈汇总', format: 'docx', icon: '📝' },
  { name: '技术图谱能力明细', format: 'xlsx', icon: '📊' },
  { name: '业务管理访谈汇总', format: 'docx', icon: '📝' },
  { name: '外部对标人才需求', format: 'pptx', icon: '📋' },
  { name: '岗位说明书 A', format: 'docx', icon: '📄' },
  { name: '岗位说明书 B', format: 'docx', icon: '📄' },
  { name: '测评数据与人才画像', format: 'pptx', icon: '📈' },
];

const FORMAT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  docx: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  xlsx: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  pptx: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
};

const SEEDS_DM = ['技术架构能力', '全栈实现能力', '工程化交付实施', '系统稳定性保障', '业务需求转化', '技术创新驱动', '技术团队管理', '跨方技术协同', 'AI技术理解与应用'];
const SEEDS_BM = ['业务领域精通', '业务持续性保障', '整合项目交付', '解决方案设计', '数据驱动决策', '需求与价值实现', '团队管理与赋能', '协同与影响'];

function FlowArrow() {
  return (
    <div className="flex justify-center py-1">
      <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
        <path d="M12 4 L12 24 M6 20 L12 26 L18 20" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function StageNumber({ n, color }: { n: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-white text-sm font-bold shadow-sm ${color}`}>
        {n}
      </span>
    </div>
  );
}

export default function DataFlowDiagram({ meta }: DataFlowDiagramProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-gray-900">AI 分析流程</h2>

      {/* ── Stage 1: Source Materials ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <StageNumber n={1} color="bg-indigo-600" />
          <h3 className="text-base font-semibold text-gray-800">源材料输入</h3>
          <span className="ml-auto text-sm text-gray-400 font-medium">{meta.source_count} 份文件 · 45,792 字</span>
        </div>
        <div className="grid grid-cols-7 gap-2.5">
          {SOURCES.map((s, i) => {
            const colors = FORMAT_COLORS[s.format] || FORMAT_COLORS.docx;
            return (
              <div
                key={i}
                className={`rounded-xl border p-3 text-center ${colors.bg} ${colors.border}`}
              >
                <div className="text-2xl mb-1.5">{s.icon}</div>
                <div className="text-xs font-semibold text-gray-800 leading-snug">{s.name}</div>
                <span className={`inline-block mt-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold ${colors.text} bg-white/60`}>
                  .{s.format}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <FlowArrow />

      {/* ── Stage 2: Seed List ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <StageNumber n={2} color="bg-amber-500" />
          <h3 className="text-base font-semibold text-gray-800">种子能力列表</h3>
          <span className="ml-auto text-sm text-gray-400 font-medium">{meta.seed_count} 项 · 专家预设</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full bg-indigo-500" />
              <span className="text-sm font-bold text-indigo-900">交付管理</span>
              <span className="text-xs text-indigo-500 font-semibold ml-auto">9 项</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SEEDS_DM.map((t) => (
                <span key={t} className="px-2.5 py-1 rounded-lg bg-white/80 text-xs text-indigo-700 border border-indigo-200/50 font-medium">{t}</span>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-sm font-bold text-amber-900">项目/业务管理</span>
              <span className="text-xs text-amber-500 font-semibold ml-auto">8 项</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SEEDS_BM.map((t) => (
                <span key={t} className="px-2.5 py-1 rounded-lg bg-white/80 text-xs text-amber-700 border border-amber-200/50 font-medium">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <FlowArrow />

      {/* ── Stage 3: AI Pipeline ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <StageNumber n={3} color="bg-violet-600" />
          <h3 className="text-base font-semibold text-gray-800">AI 三步分析管线</h3>
          <span className="ml-auto text-sm text-gray-400 font-medium">DashScope qwen-plus</span>
        </div>

        <div className="flex items-stretch gap-0">
          {/* FR-1.2 */}
          <div className="flex-1 rounded-l-2xl bg-gradient-to-b from-violet-50 to-white border border-violet-100 p-5 text-center">
            <div className="inline-flex items-center px-3 py-1 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold mb-3">
              FR-1.2
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-1">验证 + 发现</p>
            <p className="text-xs text-gray-500 leading-relaxed">验证种子项证据强度<br/>发现新能力概念</p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
              17 种子 + 32 新发现
            </div>
            <div className="mt-2 text-xl font-extrabold text-violet-600">= 49</div>
          </div>

          {/* Chevron */}
          <div className="flex items-center px-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 5 L12.5 10 L7.5 15" stroke="#c7d2fe" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* FR-1.3 */}
          <div className="flex-1 bg-gradient-to-b from-sky-50 to-white border border-sky-100 p-5 text-center">
            <div className="inline-flex items-center px-3 py-1 rounded-lg bg-sky-100 text-sky-700 text-xs font-bold mb-3">
              FR-1.3
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-1">二级展开</p>
            <p className="text-xs text-gray-500 leading-relaxed">为每个一级项<br/>生成 3-5 个子项</p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-100 text-sky-700 text-xs font-bold">
              49 × 5
            </div>
            <div className="mt-2 text-xl font-extrabold text-sky-600">= 245</div>
          </div>

          {/* Chevron */}
          <div className="flex items-center px-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 5 L12.5 10 L7.5 15" stroke="#a5f3fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* FR-1.4 */}
          <div className="flex-1 rounded-r-2xl bg-gradient-to-b from-emerald-50 to-white border border-emerald-100 p-5 text-center">
            <div className="inline-flex items-center px-3 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold mb-3">
              FR-1.4
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-1">行为展开</p>
            <p className="text-xs text-gray-500 leading-relaxed">为每个二级项<br/>生成 3-6 个行为</p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
              245 × ~5
            </div>
            <div className="mt-2 text-xl font-extrabold text-emerald-600">= 1,260</div>
          </div>
        </div>
      </div>

      <FlowArrow />

      {/* ── Stage 4: Weight Calibration ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <StageNumber n={4} color="bg-rose-500" />
          <h3 className="text-base font-semibold text-gray-800">综合权重校准</h3>
          <span className="ml-auto text-sm text-gray-400 font-medium">人工校准 · 无需重跑 AI</span>
        </div>

        {/* Formula */}
        <div className="rounded-xl bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 border border-rose-200/60 p-5 mb-4">
          <div className="flex items-center justify-center gap-3 text-base font-bold text-gray-800">
            <span className="px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">AI 证据强度</span>
            <span className="text-2xl text-rose-400">&times;</span>
            <span className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-sm font-bold">人工权重</span>
            <span className="text-2xl text-gray-300">=</span>
            <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-bold">综合评分</span>
          </div>
          <p className="text-center text-xs text-gray-500 mt-2.5">
            人工权重基于多方综合评估，在预计算结果上直接应用，秒级完成
          </p>
        </div>

        {/* Three weight sources */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { icon: '🏢', title: '公司与部门需求', desc: '岗位核心职责界定\n能力项与岗位匹配度', color: 'from-blue-50 to-indigo-50 border-blue-200/60', iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
            { icon: '🎓', title: '培训中心意见', desc: '可培训性评估\n课程覆盖与资源匹配', color: 'from-amber-50 to-yellow-50 border-amber-200/60', iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
            { icon: '💡', title: '咨询顾问评估', desc: '行业对标与最佳实践\n能力模型结构合理性', color: 'from-violet-50 to-purple-50 border-violet-200/60', iconBg: 'bg-violet-100', iconText: 'text-violet-600' },
          ].map((source) => (
            <div key={source.title} className={`rounded-xl bg-gradient-to-br ${source.color} border p-4`}>
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${source.iconBg} text-lg mb-2`}>
                {source.icon}
              </div>
              <p className="text-sm font-bold text-gray-800">{source.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed mt-1 whitespace-pre-line">{source.desc}</p>
            </div>
          ))}
        </div>

        {/* Example */}
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">权重校准示例</p>
          <div className="space-y-2">
            {[
              { term: '业务需求转化', score: 0.96, weight: 1.0, label: '种子项 · 核心职责' },
              { term: '全栈实现能力', score: 0.94, weight: 1.0, label: '种子项 · 核心职责' },
              { term: '翻译官能力', score: 0.97, weight: 0.6, label: '角色描述 · 非能力维度' },
              { term: '业务洞察与引领能力', score: 0.98, weight: 0.5, label: '跨模型 · 非核心职责' },
            ].map((item) => (
              <div key={item.term} className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-700 w-36 truncate">{item.term}</span>
                <span className="text-xs text-gray-400 font-mono w-12 text-right">{item.score.toFixed(2)}</span>
                <span className="text-xs text-rose-400">&times;</span>
                <span className={`text-xs font-mono w-10 text-right font-bold ${item.weight < 1 ? 'text-rose-500' : 'text-gray-500'}`}>
                  {item.weight.toFixed(1)}
                </span>
                <span className="text-xs text-gray-300">=</span>
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.weight < 1 ? 'bg-gradient-to-r from-rose-300 to-rose-400' : 'bg-gradient-to-r from-emerald-300 to-emerald-400'}`}
                      style={{ width: `${(item.score * item.weight) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold w-12 text-right ${item.weight < 1 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {(item.score * item.weight).toFixed(2)}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 w-28 text-right">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <FlowArrow />

      {/* ── Stage 5: Output ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <StageNumber n={5} color="bg-gray-800" />
          <h3 className="text-base font-semibold text-gray-800">输出 — 研讨会工具</h3>
          <span className="ml-auto text-sm text-gray-400 font-medium">{meta.generated_at ? new Date(meta.generated_at).toLocaleString('zh-CN') : ''}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: '📊', title: '一级能力项研讨', desc: '雷达图 + 胶囊备选池', tags: [{ text: '交付 25', cls: 'bg-indigo-50 text-indigo-600' }, { text: '业务 24', cls: 'bg-amber-50 text-amber-600' }] },
            { icon: '🔍', title: '二级与行为探索', desc: '三栏联动浏览器', tags: [{ text: '245 二级', cls: 'bg-sky-50 text-sky-600' }, { text: '1,260 行为', cls: 'bg-emerald-50 text-emerald-600' }] },
            { icon: '📚', title: '学习资源盘点', desc: '完整模型树 + 资源清单', tags: [{ text: '3 层级', cls: 'bg-purple-50 text-purple-600' }] },
          ].map((item) => (
            <div key={item.title} className="rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-200 p-4 text-center">
              <div className="text-3xl mb-2">{item.icon}</div>
              <p className="text-sm font-bold text-gray-800">{item.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              <div className="mt-3 flex justify-center gap-2">
                {item.tags.map((tag) => (
                  <span key={tag.text} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tag.cls}`}>
                    {tag.text}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
