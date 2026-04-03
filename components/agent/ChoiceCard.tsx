'use client';

import { useState } from 'react';

interface ChoiceOption {
  value: string
  label: string
  description?: string
}

export interface SingleChoiceGroupProps {
  component: {
    key: string
    label: string
    options: string[] | ChoiceOption[]
    required?: boolean
    ui_style?: 'cards' | 'chips'
  }
  value: string
  onChange: (key: string, value: string) => void
}

export interface MultiChoiceGroupProps {
  component: {
    key: string
    label: string
    options: string[] | ChoiceOption[]
    required?: boolean
    allow_custom?: boolean
    ui_style?: 'cards' | 'chips'
  }
  value: string[]
  onChange: (key: string, value: string[]) => void
}

function normalizeOptions(options: string[] | ChoiceOption[]): ChoiceOption[] {
  return options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  )
}

export function SingleChoiceGroup({ component, value, onChange }: SingleChoiceGroupProps) {
  const opts = normalizeOptions(component.options)
  const style = component.ui_style || 'cards'

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {component.label}
        {component.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {style === 'cards' ? (
        <div className="grid grid-cols-2 gap-2">
          {opts.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(component.key, opt.value)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                value === opt.value
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-sm text-gray-900">{opt.label}</div>
              {opt.description && (
                <div className="text-xs text-gray-500 mt-1">{opt.description}</div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {opts.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(component.key, opt.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                value === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function MultiChoiceGroup({ component, value, onChange }: MultiChoiceGroupProps) {
  const opts = normalizeOptions(component.options)
  const style = component.ui_style || 'chips'

  const toggle = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(component.key, value.filter(v => v !== optValue))
    } else {
      onChange(component.key, [...value, optValue])
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {component.label}
        {component.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {style === 'chips' ? (
        <div className="flex flex-wrap gap-2">
          {opts.map(opt => {
            const selected = value.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selected
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {selected && <span className="mr-1.5">✓</span>}
                {opt.label}
              </button>
            )
          })}
          {component.allow_custom && (
            <CustomInput
              onAdd={(customValue) => toggle(customValue)}
              componentKey={component.key}
            />
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {opts.map(opt => {
            const selected = value.includes(opt.value)
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  selected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}
                >
                  {selected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="font-medium text-sm text-gray-900">{opt.label}</div>
                  {opt.description && (
                    <div className="text-xs text-gray-500">{opt.description}</div>
                  )}
                </div>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CustomInput({ onAdd, componentKey }: { onAdd: (v: string) => void; componentKey: string }) {
  const [showInput, setShowInput] = useState(false)
  const [customValue, setCustomValue] = useState('')

  if (!showInput) {
    return (
      <button
        type="button"
        onClick={() => setShowInput(true)}
        className="px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        + 自定义
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={customValue}
        onChange={e => setCustomValue(e.target.value)}
        placeholder="输入自定义选项..."
        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        onKeyDown={e => {
          if (e.key === 'Enter' && customValue.trim()) {
            onAdd(customValue.trim())
            setCustomValue('')
            setShowInput(false)
          }
        }}
      />
      <button
        type="button"
        onClick={() => {
          if (customValue.trim()) {
            onAdd(customValue.trim())
            setCustomValue('')
            setShowInput(false)
          }
        }}
        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        disabled={!customValue.trim()}
      >
        添加
      </button>
      <button
        type="button"
        onClick={() => { setShowInput(false); setCustomValue('') }}
        className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        取消
      </button>
    </div>
  )
}
