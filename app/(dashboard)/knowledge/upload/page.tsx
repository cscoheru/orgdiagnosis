'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  uploadDocument,
  getCategories,
  getCategoryName,
  pollUploadStatus,
  type Category,
  type UploadStatus
} from '@/lib/kb-api';

interface UploadTask {
  id: string;
  file: File;
  category: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  taskId?: string;
  chunksCreated?: number;
  error?: string;
}

export default function KnowledgeUploadPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('general');
  const [uploadQueue, setUploadQueue] = useState<UploadTask[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load categories on mount
  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
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
  }, [selectedCategory]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFilesToQueue(files);
    }
  }, [selectedCategory]);

  const addFilesToQueue = (files: File[]) => {
    const supportedTypes = ['.pdf', '.docx', '.pptx', '.md', '.txt'];
    const maxSizeKB = 50 * 1024; // 50MB

    const validFiles = files.filter(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const sizeKB = file.size / 1024;

      if (!supportedTypes.includes(ext)) {
        alert(`不支持的文件类型: ${file.name}`);
        return false;
      }

      if (sizeKB > maxSizeKB) {
        alert(`文件过大: ${file.name} (最大50MB)`);
        return false;
      }

      return true;
    });

    const newTasks: UploadTask[] = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      category: selectedCategory,
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
      const response = await uploadDocument(task.file, task.category);

      // Update status to processing
      setUploadQueue(prev =>
        prev.map(t => t.id === task.id ? {
          ...t,
          status: 'processing',
          progress: 20,
          taskId: response.task_id
        } : t)
      );

      // Poll for status
      pollUploadStatus(
        response.task_id,
        (status: UploadStatus) => {
          // Completed
          setUploadQueue(prev =>
            prev.map(t => t.id === task.id ? {
              ...t,
              status: 'completed',
              progress: 100,
              chunksCreated: status.chunks_created || 0
            } : t)
          );
        },
        (error: string) => {
          // Failed
          setUploadQueue(prev =>
            prev.map(t => t.id === task.id ? {
              ...t,
              status: 'failed',
              error
            } : t)
          );
        },
        2000, // Poll every 2 seconds
        60    // Max 60 attempts (2 minutes)
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
        return { text: '上传中...', color: 'text-blue-500', icon: '📤' };
      case 'processing':
        return { text: '处理中...', color: 'text-purple-500', icon: '🔄' };
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">⬆️ 上传中心</h1>
          <p className="text-gray-500 mt-1">上传历史咨询报告到知识库</p>
        </div>
        <Link
          href="/knowledge/documents"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
        >
          <span>📚</span>
          文档管理
        </Link>
      </div>

      {/* Category Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          默认分类 (可针对每个文件单独设置)
        </label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
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
          accept=".pdf,.docx,.pptx,.md,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />

        <span className="text-6xl block mb-4">📂</span>
        <p className="text-lg text-gray-700 mb-2">
          拖拽文件到此处，或点击选择文件
        </p>
        <p className="text-sm text-gray-500">
          支持: PDF, DOCX, PPTX, MD, TXT &nbsp;|&nbsp; 单个文件最大: 50MB
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
              const icon = {
                pdf: '📄',
                docx: '📝',
                pptx: '📊',
                md: '📑',
                txt: '📃'
              }[ext] || '📁';

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
                          {task.status !== 'uploading' && task.status !== 'processing' && (
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
                        <span>•</span>
                        <span>{getCategoryName(task.category)}</span>
                      </div>

                      {/* Progress Bar */}
                      {(task.status === 'uploading' || task.status === 'processing') && (
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              task.status === 'uploading' ? 'bg-blue-500' : 'bg-purple-500'
                            }`}
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      )}

                      {/* Success Message */}
                      {task.status === 'completed' && task.chunksCreated && (
                        <p className="text-sm text-green-600 mt-1">
                          ✓ 创建了 {task.chunksCreated} 个文档块
                        </p>
                      )}

                      {/* Error Message */}
                      {task.status === 'failed' && task.error && (
                        <p className="text-sm text-red-600 mt-1">
                          {task.error}
                        </p>
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
          <li>• 文档上传后会自动进行文本提取和向量化处理</li>
          <li>• 处理时间取决于文件大小，通常需要几秒到几分钟</li>
          <li>• 建议为每个文档选择合适的分类，以便后续检索</li>
          <li>• 如需批量上传大量文档，请联系管理员获取 API 密钥</li>
        </ul>
      </div>
    </div>
  );
}
