/**
 * 语音转文字工具
 * 支持浏览器端语音识别和录音
 */

export interface TranscriptionResult {
  success: boolean;
  text: string;
  error?: string;
  duration?: number;
}

export interface AudioRecorderOptions {
  onStatusChange?: (status: RecordingStatus) => void;
  onInterimResult?: (text: string) => void;
  language?: string;
}

export type RecordingStatus = 'idle' | 'recording' | 'processing' | 'error';

/**
 * 检查是否在浏览器环境
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * 检查浏览器是否支持语音识别
 */
export function isSpeechRecognitionSupported(): boolean {
  if (!isBrowser()) return false;
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

/**
 * 检查浏览器是否支持录音
 */
export function isMediaRecorderSupported(): boolean {
  if (!isBrowser()) return false;
  return 'MediaRecorder' in window && navigator.mediaDevices !== undefined;
}

/**
 * 创建语音识别实例
 */
export function createSpeechRecognition(options: AudioRecorderOptions = {}) {
  if (!isBrowser()) return null;

  const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

  if (!SpeechRecognition) {
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = options.language || 'zh-CN';

  return recognition;
}

/**
 * 语音录制器类
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private recognition: any = null;
  private status: RecordingStatus = 'idle';
  private options: AudioRecorderOptions;
  private startTime: number = 0;

  constructor(options: AudioRecorderOptions = {}) {
    this.options = options;
  }

  /**
   * 开始录音和实时语音识别
   */
  async startRecording(): Promise<boolean> {
    try {
      // 请求麦克风权限
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 初始化 MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // 每秒收集一次数据
      this.startTime = Date.now();

      // 同时启动语音识别（如果支持）
      if (isSpeechRecognitionSupported()) {
        this.startSpeechRecognition();
      }

      this.setStatus('recording');
      return true;
    } catch (error) {
      console.error('录音启动失败:', error);
      this.setStatus('error');
      return false;
    }
  }

  /**
   * 启动实时语音识别
   */
  private startSpeechRecognition() {
    this.recognition = createSpeechRecognition(this.options);

    if (!this.recognition) return;

    let finalTranscript = '';

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // 发送临时结果
      if (interimTranscript && this.options.onInterimResult) {
        this.options.onInterimResult(finalTranscript + interimTranscript);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('语音识别错误:', event.error);
    };

    this.recognition.onend = () => {
      // 如果还在录音，重新启动识别
      if (this.status === 'recording') {
        this.recognition.start();
      }
    };

    this.recognition.start();
  }

  /**
   * 停止录音
   */
  async stopRecording(): Promise<TranscriptionResult> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.status !== 'recording') {
        resolve({
          success: false,
          text: '',
          error: '没有正在进行的录音',
        });
        return;
      }

      this.setStatus('processing');

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const duration = (Date.now() - this.startTime) / 1000;

        // 停止语音识别
        if (this.recognition) {
          this.recognition.stop();
          this.recognition = null;
        }

        // 停止麦克风
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }

        // 注意：这里返回的是音频 Blob
        // 实际的语音转文字需要调用外部 API（如 Whisper）
        // 浏览器端语音识别结果已经在 onInterimResult 中实时返回

        this.setStatus('idle');

        resolve({
          success: true,
          text: '', // 实时识别的文本由调用方收集
          duration,
        });
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * 取消录音
   */
  cancelRecording() {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.setStatus('idle');
  }

  /**
   * 获取当前状态
   */
  getStatus(): RecordingStatus {
    return this.status;
  }

  /**
   * 更新状态
   */
  private setStatus(status: RecordingStatus) {
    this.status = status;
    if (this.options.onStatusChange) {
      this.options.onStatusChange(status);
    }
  }
}

/**
 * 支持的音频格式
 */
export const SUPPORTED_AUDIO_TYPES = {
  webm: { name: 'WebM 音频', mime: 'audio/webm' },
  mp3: { name: 'MP3 音频', mime: 'audio/mpeg' },
  wav: { name: 'WAV 音频', mime: 'audio/wav' },
  m4a: { name: 'M4A 音频', mime: 'audio/mp4' },
  ogg: { name: 'OGG 音频', mime: 'audio/ogg' },
};

/**
 * 获取音频文件接受字符串
 */
export function getAudioAcceptString(): string {
  return Object.keys(SUPPORTED_AUDIO_TYPES).map(ext => `.${ext}`).join(',');
}
