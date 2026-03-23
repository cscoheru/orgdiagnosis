'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  uploadDocument,
  getProjects,
  type Project
} from '@/lib/knowledge-v2-api';

interface UploadTask {
  id: string;
  file: File;
  projectId: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  documentId?: string;
  pageCount?: number;
  classification?: any;
  error?: string;
}

export default function KnowledgeUploadPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [autoClassify, setAutoClassify] = useState(true);
  const [uploadQueue, setUploadQueue] = useState<UploadTask[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load projects on mount
  useEffect(() => {
    getProjects().then(data => {
      setProjects(data);
    }).catch(console.error);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    addFilesToQueue(files);
  }, [selectedProject]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFilesToQueue(files);
    }
  }, [selectedProject]);

  const addFilesToQueue = (files: File[]) => {
    const supportedTypes = ['.pptx', '.pdf', '.docx', '.xlsx', '.xls', '.md', '.json', '.png', '.jpg', '.jpeg'];
    const maxSizeMB = 50;

    const validFiles = files.filter(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const sizeMB = file.size / (1024 * 1024);

      if (!supportedTypes.includes(ext)) {
        alert(`不支持的文件类型: ${file.name}\n支持: PPTX, PDF, DOCX, XLSX, MD, JSON, PNG, JPG`);
        return false;
      }

      if (sizeMB > maxSizeMB) {
        alert(`文件过大: ${file.name} (最大${maxSizeMB}MB)`);
        return false;
      }

      return true;
    });

    const newTasks: UploadTask[] = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      projectId: selectedProject,
      status: 'pending',
      progress: 0
    }));

    setUploadQueue(prev => [...prev, ...newTasks]);

    // Auto-start upload for each file
    newTasks.forEach(task => uploadFile(task));
  };

  const uploadFile = async (task: UploadTask) => {
    try {
      // Update status to uploading
      setUploadQueue(prev =>
        prev.map(t => t.id === task.id ? { ...t, status: 'uploading', progress: 10 } : t)
      );

      // Call upload API
      const response = await uploadDocument(
        task.file,
        {
          project_id: task.projectId || undefined,
          auto_classify: autoClassify
        }
      );

      // Update status to completed
      setUploadQueue(prev =>
        prev.map(t => t.id === task.id ? {
          ...t,
          status: 'completed',
          progress: 100,
          documentId: response.document_id,
          pageCount: response.page_count,
          classification: response.classification
        } : t)
      );

    } catch (error) {
      setUploadQueue(prev =>
        prev.map(t => t.id === task.id ? {
          ...t,
          status: 'failed',
          error: error instanceof Error ? error.message : '上传失败'
        } : t)
      );
    }
  };

  const removeFromQueue = (taskId: string) => {
    setUploadQueue(prev => prev.filter(t => t.id !== taskId));
  };

  const clearCompleted = () => {
    setUploadQueue(prev => prev.filter(t => t.status !== 'completed'));
  };

  const getStatusDisplay = (task: UploadTask) => {
    switch (task.status) {
      case 'pending':
        return { text: '等待中', color: 'text-gray-500', icon: '⏳' };
      case 'uploading':
        return { text: '上传处理中...', color: 'text-blue-500', icon: '📤' };
      case 'completed':
        return { text: '已完成', color: 'text-green-500', icon: '✅' };
      case 'failed':
        return { text: '失败', color: 'text-red-500', icon: '❌' };
      default:
        return { text: '未知', color: 'text-gray-500', icon: '❓' };
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const getDimensionLabel = (code: string) => {
    const names: Record<string, string> = {
      'strategy': '🎯 战略',
      'structure': '🏢 组织',
      'performance': '📊 绩效',
      'compensation': '💰 薪酬',
      'talent': '👥 人才'
    };
    return names[code] || code;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">⬆️ 上传中心</h1>
          <p className="text-gray-500 mt-1">上传咨询报告到知识库，自动解析和分类</p>
        </div>
        <Link
          href="/knowledge/documents"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
        >
          <span>📚</span>
          文档管理
        </Link>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Project Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📁 所属项目
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">不指定项目</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">可选择项目进行分组管理</p>
          </div>

          {/* Auto Classify */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🎯 自动分类
            </label>
            <div className="flex items-center gap-3 mt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoClassify}
                  onChange={(e) => setAutoClassify(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">
                  启用五维自动分类
                </span>
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-1">基于关键词自动分类到五维模型</p>
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          bg-white rounded-xl border-2 border-dashed p-12 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pptx,.pdf,.docx,.xlsx,.xls,.md,.json,.png,.jpg,.jpeg"
          onChange={handleFileSelect}
          className="hidden"
        />

        <span className="text-6xl block mb-4">📂</span>
        <p className="text-lg text-gray-700 mb-2">
          拖拽文件到此处，或点击选择文件
        </p>
        <p className="text-sm text-gray-500">
          支持: <span className="font-medium">PPTX</span>, <span className="font-medium">PDF</span>, <span className="font-medium">DOCX</span>, <span className="font-medium">XLSX</span>, <span className="font-medium">MD</span>, <span className="font-medium">JSON</span>, <span className="font-medium">图片</span>
          &nbsp;|&nbsp; 单个文件最大: 50MB
        </p>
      </div>

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-medium text-gray-800">上传队列 ({uploadQueue.length})</h3>
            <button
              onClick={clearCompleted}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              清除已完成
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {uploadQueue.map(task => {
              const status = getStatusDisplay(task);
              const ext = task.file.name.split('.').pop()?.toLowerCase() || '';
              const icon = ext === 'pdf' ? '📄' :
                          ext === 'pptx' ? '📊' :
                          ext === 'docx' ? '📝' :
                          ext === 'xlsx' || ext === 'xls' ? '📈' :
                          ext === 'md' ? '📑' :
                          ext === 'json' ? '📋' :
                          ['png', 'jpg', 'jpeg'].includes(ext) ? '🖼️' : '📁';

              return (
                <div key={task.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-gray-800 truncate">
                          {task.file.name}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${status.color}`}>
                            {status.icon} {status.text}
                          </span>
                          {task.status !== 'uploading' && (
                            <button
                              onClick={() => removeFromQueue(task.id)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <span>{formatFileSize(task.file.size)}</span>
                        {task.pageCount && (
                          <>
                            <span>•</span>
                            <span>{task.pageCount} 页</span>
                          </>
                        )}
                      </div>

                      {/* Progress Bar */}
                      {task.status === 'uploading' && (
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-2">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-300 animate-pulse"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      )}

                      {/* Classification Result */}
                      {task.status === 'completed' && task.classification?.dimension_l1 && (
                        <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">自动分类结果:</p>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {getDimensionLabel(task.classification.dimension_l1)}
                            </span>
                            {task.classification.dimension_l2_name && (
                              <>
                                <span className="text-gray-300">→</span>
                                <span className="text-sm text-gray-600">
                                  {task.classification.dimension_l2_name}
                                </span>
                              </>
                            )}
                            {task.classification.confidence && (
                              <span className="text-xs text-gray-400 ml-auto">
                                置信度 {Math.round(task.classification.confidence * 100)}%
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Error Message */}
                      {task.status === 'failed' && task.error && (
                        <p className="text-sm text-red-600 mt-1">
                          {task.error}
                        </p>
                      )}

                      {/* Success Actions */}
                      {task.status === 'completed' && task.documentId && (
                        <Link
                          href={`/knowledge/documents/${task.documentId}`}
                          className="text-sm text-blue-500 hover:text-blue-700 mt-2 inline-block"
                        >
                          查看文档详情 →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <h3 className="font-medium text-blue-800 mb-2">💡 上传提示</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 支持多种格式: PPTX, PDF, DOCX, XLSX, Markdown, JSON, 图片</li>
          <li>• 文档会自动解析，支持全文搜索</li>
          <li>• 自动分类基于五维模型关键词匹配</li>
          <li>• 可选择项目进行分组，便于按项目筛选</li>
        </ul>
      </div>
    </div>
  );
}
