'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { parseFile, getAcceptString, isFileTypeSupported, ParseResult, OCRProgressCallback } from '@/lib/file-parser';
import { AudioRecorder, isSpeechRecognitionSupported, RecordingStatus } from '@/lib/audio-transcriber';

export default function InputPage() {
  const router = useRouter();
  const [rawText, setRawText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseInfo, setParseInfo] = useState<ParseResult['metadata'] | null>(null);
  const [ocrProgress, setOcrProgress] = useState<{ progress: number; status: string } | null>(null);

  // 录音相关状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
  const [interimText, setInterimText] = useState('');
  const [recordedText, setRecordedText] = useState('');
  const audioRecorderRef = useRef<AudioRecorder | null>(null);

  const handleAnalyze = async () => {
    // 合并录音文本和输入文本
    const fullText = (recordedText + '\n' + rawText).trim();

    if (fullText.length < 50) {
      setError('请输入至少 50 个字符的文本');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullText }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || '分析失败，请重试');
        setIsLoading(false);
        return;
      }

      // 保存诊断结果
      const saveResponse = await fetch('/api/diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_input: fullText,
          data: result.data,
        }),
      });

      const savedSession = await saveResponse.json();

      if (savedSession.success) {
        router.push(`/result/${savedSession.data.id}`);
      } else {
        setError('保存失败，请重试');
      }
    } catch (err) {
      setError('网络错误，请检查连接');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setParseInfo(null);
    setOcrProgress(null);

    // 检查文件类型
    if (!isFileTypeSupported(file.name)) {
      setError(`不支持的文件格式: ${file.name}`);
      return;
    }

    // 检查文件大小 (最大 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('文件大小超过 10MB 限制');
      return;
    }

    try {
      // OCR 进度回调
      const onOCRProgress: OCRProgressCallback = (progress, status) => {
        setOcrProgress({ progress, status });
      };

      const result = await parseFile(file, onOCRProgress);

      // 清除进度显示
      setOcrProgress(null);

      if (!result.success) {
        setError(result.error || '文件解析失败');
        return;
      }

      setRawText(result.text);
      setParseInfo(result.metadata);
    } catch (err) {
      setOcrProgress(null);
      setError('文件处理失败，请重试');
    }
  };

  // 开始录音
  const startRecording = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      setError('您的浏览器不支持语音识别，建议使用 Chrome 浏览器');
      return;
    }

    audioRecorderRef.current = new AudioRecorder({
      language: 'zh-CN',
      onStatusChange: (status) => {
        setRecordingStatus(status);
        setIsRecording(status === 'recording');
      },
      onInterimResult: (text) => {
        setInterimText(text);
      },
    });

    audioRecorderRef.current.startRecording();
    setRecordedText('');
    setInterimText('');
  }, []);

  // 停止录音
  const stopRecording = useCallback(async () => {
    if (!audioRecorderRef.current) return;

    // 保存当前的临时文本
    setRecordedText(prev => prev + ' ' + interimText);
    setInterimText('');

    await audioRecorderRef.current.stopRecording();
    audioRecorderRef.current = null;
  }, [interimText]);

  // 取消录音
  const cancelRecording = useCallback(() => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.cancelRecording();
      audioRecorderRef.current = null;
    }
    setInterimText('');
  }, []);

  // 清除录音文本
  const clearRecording = useCallback(() => {
    setRecordedText('');
    setInterimText('');
  }, []);

  const exampleText = `客户是一家成立于2018年的科技公司，目前有200多名员工。
主要问题：
1. 战略层面：公司去年营收增长8%，远低于预期的15%。创始人认为错过了两个重要的市场机会。
2. 组织层面：公司采用职能制架构，但部门墙很厚，跨部门协作经常出问题。
3. 绩效层面：使用KPI考核，但指标分解不够科学，员工普遍反映考核不公平。
4. 薪酬层面：薪酬水平在行业中属于中游，但核心员工流失率较高。
5. 人才层面：老员工混日子的情况比较严重，新员工留不住，去年入职的10个新人走了6个。`;

  const displayText = rawText || interimText || recordedText;
  const fullTextLength = (recordedText + '\n' + rawText).trim().length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">新建诊断</h1>
        <p className="text-gray-600">
          输入会议记录、访谈文字或语音转写，AI 将自动分析并映射到五维模型
        </p>
      </div>

      {/* Input Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-medium text-gray-700">
            原始文本
          </label>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {fullTextLength} / 100,000 字符
            </span>

            {/* 录音按钮 */}
            {isSpeechRecognitionSupported() && (
              <div className="flex items-center gap-2">
                {isRecording ? (
                  <>
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                    >
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                      停止录音
                    </button>
                    <button
                      onClick={cancelRecording}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    🎤 语音输入
                  </button>
                )}
              </div>
            )}

            {/* 文件上传 */}
            <label className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">
              📎 上传文件
              <input
                type="file"
                accept={getAcceptString()}
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* 录音状态提示 */}
        {isRecording && interimText && (
          <div className="mb-3 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              正在识别...
            </div>
            <p className="mt-1 text-gray-700">{interimText}</p>
          </div>
        )}

        {/* 已识别的语音文本 */}
        {recordedText && !isRecording && (
          <div className="mb-3 p-3 bg-green-50 rounded-lg flex items-start justify-between">
            <div>
              <div className="text-sm text-green-600 mb-1">🎤 语音识别结果</div>
              <p className="text-gray-700">{recordedText}</p>
            </div>
            <button
              onClick={clearRecording}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        )}

        {/* 文件解析信息 */}
        {parseInfo && (
          <div className="mb-3 p-2 bg-gray-50 rounded-lg text-sm text-gray-600">
            📄 {parseInfo.fileName} ({(parseInfo.fileSize / 1024).toFixed(1)} KB)
            {parseInfo.pageCount && ` · ${parseInfo.pageCount} 页`}
            {parseInfo.sheetCount && ` · ${parseInfo.sheetCount} 个工作表`}
            {parseInfo.isOCR && ` · OCR 识别`}
          </div>
        )}

        {/* OCR 进度显示 */}
        {ocrProgress && (
          <div className="mb-3 p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-purple-600">{ocrProgress.status}</span>
              <span className="text-sm text-purple-600">{ocrProgress.progress}%</span>
            </div>
            <div className="w-full bg-purple-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${ocrProgress.progress}%` }}
              ></div>
            </div>
          </div>
        )}

        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="粘贴会议记录、访谈文字或语音转写..."
          className="w-full h-80 p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-700 placeholder:text-gray-400"
        />

        {error && (
          <div className="mt-3 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setRawText(exampleText)}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          使用示例文本
        </button>

        <button
          onClick={handleAnalyze}
          disabled={isLoading || fullTextLength < 50}
          className={`px-8 py-3 rounded-xl font-medium text-white transition-all ${
            isLoading || fullTextLength < 50
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/25'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              AI 分析中...
            </span>
          ) : (
            '🚀 开始分析'
          )}
        </button>
      </div>

      {/* Supported Formats */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl">
        <h3 className="font-medium text-gray-900 mb-3">📁 支持的文件格式</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <span className="w-8 h-8 flex items-center justify-center bg-blue-100 rounded">📄</span>
            <div>
              <div className="font-medium">Word</div>
              <div className="text-xs text-gray-400">.docx</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <span className="w-8 h-8 flex items-center justify-center bg-red-100 rounded">📕</span>
            <div>
              <div className="font-medium">PDF</div>
              <div className="text-xs text-gray-400">.pdf</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <span className="w-8 h-8 flex items-center justify-center bg-green-100 rounded">📊</span>
            <div>
              <div className="font-medium">Excel</div>
              <div className="text-xs text-gray-400">.xlsx, .xls</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <span className="w-8 h-8 flex items-center justify-center bg-purple-100 rounded">🖼️</span>
            <div>
              <div className="font-medium">图片 OCR</div>
              <div className="text-xs text-gray-400">.png, .jpg</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <span className="w-8 h-8 flex items-center justify-center bg-orange-100 rounded">🎤</span>
            <div>
              <div className="font-medium">语音输入</div>
              <div className="text-xs text-gray-400">实时识别</div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          同时支持: .txt, .md, .csv, .json 等纯文本格式 · 图片和扫描件使用 OCR 自动识别
        </p>
      </div>

      {/* Tips */}
      <div className="mt-4 p-4 bg-blue-50 rounded-xl">
        <h3 className="font-medium text-blue-900 mb-2">💡 提示</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 尽量包含具体的数据和事实，如"营收增长8%"、"离职率20%"</li>
          <li>• 多角度描述问题，包括战略、组织、绩效、薪酬、人才等方面</li>
          <li>• 可以包含多个会议或访谈的内容，AI 会自动识别和归类</li>
          <li>• 语音输入建议使用 Chrome 浏览器，识别效果最佳</li>
        </ul>
      </div>
    </div>
  );
}
