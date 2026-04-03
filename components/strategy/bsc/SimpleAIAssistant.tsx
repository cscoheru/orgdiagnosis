'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, MessageCircle, Send } from 'lucide-react'
import { useStore } from '@/lib/store'

interface BSCData {
  financial: any[]
  customer: any[]
  process: any[]
  learning: any[]
  connections: any[]
}

export function SimpleAIAssistant({ financial, customer, process, learning, connections }: BSCData) {
  const bscData = { financial, customer, process, learning }
  const { data } = useStore() // 获取 Step 1-3 数据
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight
    }
  }, [messages])

  // Listen for capsule double-click events - just store context, don't open
  useEffect(() => {
    const handleCapsuleDoubleClick = (e: Event) => {
      const customEvent = e as CustomEvent<{ capsuleId: string; text: string; x: number; y: number }>
      const { capsuleId, text } = customEvent.detail
      console.log('AI Assistant received capsule double-click:', capsuleId, text)
      // Store capsule context for later use, but don't open assistant
      sessionStorage.setItem('ai-capsule-context', JSON.stringify({ capsuleId, text }))
    }

    window.addEventListener('capsule-double-click', handleCapsuleDoubleClick)
    return () => {
      window.removeEventListener('capsule-double-click', handleCapsuleDoubleClick)
    }
  }, [])

  const analyzeBSC = async () => {
    if (!data.step1 || !data.step2 || !data.step3) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '请先完成 Step 1-3 的战略分析，再使用 AI 助手分析。'
        }
      ])
      return
    }

    setIsLoading(true)

    // Check if there's a capsule context from double-click
    const capsuleContext = sessionStorage.getItem('ai-capsule-context')
    let userQuestion = '请分析我的 BSC 战略地图，提供 2-3 条具体改进建议。'

    if (capsuleContext) {
      const { capsuleId, text } = JSON.parse(capsuleContext)
      userQuestion = `我双击了战略卡片「${text}」（ID: ${capsuleId}），请提供 2-3 条关于这个目标的改进建议。`
      sessionStorage.removeItem('ai-capsule-context')
    }

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userQuestion }
    ])

    try {
      // Call backend API instead of directly calling Zhipu AI
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: '你是一位资深战略管理专家，擅长运用罗伯特·卡普兰的平衡计分卡方法论。请基于平衡计分卡的因果关系，仅提供 3 条最关键的、动宾结构的改进建议。每条建议格式：动词 + 对象 + 结果（如："实施 ERP 二期"、"组建 KA 攻坚队"、"优化客户服务流程"）。严禁长篇大论，直接给出可执行的建议。' },
            { role: 'user', content: userQuestion }
          ]
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || 'AI 请求失败')
      }

      const aiReply = await response.json()

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: aiReply.choices?.[0]?.message?.content || aiReply.message || '未收到回复' }
      ])
    } catch (error: any) {
      console.error('AI 分析失败:', error)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `❌ 分析失败：${error instanceof Error ? error.message : '未知错误'}` }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: input }
    ])

    const userInput = input
    setInput('')

    if (!data.step1 || !data.step2 || !data.step3) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '请先完成 Step 1-3 的战略分析，再使用 AI 助手。'
        }
      ])
      return
    }

    setIsLoading(true)

    try {
      // Call backend API instead of directly calling Zhipu AI
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: '你是一位资深战略管理专家，擅长运用罗伯特·卡普兰的平衡计分卡方法论。请提供简洁、实用、可执行的建议。' },
            { role: 'user', content: userInput }
          ]
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || 'AI 请求失败')
      }

      const aiReply = await response.json()

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: aiReply.choices?.[0]?.message?.content || aiReply.message || '抱歉，我暂时无法回答这个问题。' }
      ])
    } catch (error: any) {
      console.error('AI 请求失败:', error)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `请求失败：${error instanceof Error ? error.message : '未知错误'}` }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setMessages([])
    setInput('')
  }

  if (!isOpen) {
    // Floating button when closed - positioned at right middle
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-1/2 right-2 z-50 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 shadow-lg transition-all flex items-center gap-2"
        title="AI 战略顾问"
      >
        <Sparkles className="w-4 h-4" />
        <span className="font-medium text-xs pr-1">AI 顾问</span>
      </button>
    )
  }

  return (
    <>
      {/* Side Panel when open - positioned at right middle */}
      <div className="fixed top-1/2 right-2 bottom-4 w-96 z-50 bg-white dark:bg-slate-800 rounded-lg shadow-2xl flex flex-col border border-gray-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-blue-500" />
            AI 战略顾问
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={messagesEndRef}
          className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0"
        >
          {messages.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 text-xs py-3">
              向 AI 顾问提问战略建议
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-2 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="bg-blue-50 dark:bg-slate-700 px-2 py-1 rounded text-xs max-w-[90%] whitespace-pre-wrap">
                  {message.content}
                </div>
              )}
              {message.role === 'user' && (
                <div className="bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded text-xs max-w-[90%]">
                  {message.content}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2 justify-start">
              <div className="bg-blue-50 dark:bg-slate-700 px-2 py-1 rounded text-xs text-gray-500">
                思考中...
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-slate-700 px-3 py-2">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleSend()
                }
              }}
              placeholder="向 AI 顾问提问..."
              className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-900 text-xs"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-3 h-3" />
            </button>
          </div>

          {/* Quick Action Button */}
          <button
            onClick={analyzeBSC}
            disabled={isLoading}
            className="w-full px-2 py-1 bg-blue-50 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-600 text-blue-700 dark:text-blue-300 rounded text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <MessageCircle className="w-3 h-3" />
            {isLoading ? '正在分析...' : '分析战略地图'}
          </button>
        </div>
      </div>
    </>
  )
}
