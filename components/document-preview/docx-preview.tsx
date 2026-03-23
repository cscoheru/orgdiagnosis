'use client';

import { useEffect, useRef, useState } from 'react';

interface DOCXPreviewProps {
  url: string;
  onError?: (error: string) => void;
  onDownload?: () => void;
}

export default function DOCXPreview({ url, onError }: DOCXPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if running in browser
    if (typeof window === 'undefined') {
      return;
    }

    let mounted = true;

    async function loadDOCX() {
      if (!containerRef.current) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch the DOCX file
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load DOCX: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // Dynamic import to avoid SSR issues - only in browser
        const docx = await import('docx-preview');

        if (!containerRef.current || !mounted) return;

        // Clear previous content
        containerRef.current.innerHTML = '';

        // Render DOCX
        await docx.renderAsync(arrayBuffer, containerRef.current, undefined, {
          className: 'docx-preview-wrapper',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });

        if (mounted) {
          setLoading(false);
        }

      } catch (err) {
        if (mounted) {
          const errorMsg = err instanceof Error ? err.message : '加载DOCX失败';
          setError(errorMsg);
          setLoading(false);
          onError?.(errorMsg);
        }
      }
    }

    loadDOCX();

    return () => {
      mounted = false;
    };
  }, [url, onError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-gray-500">加载DOCX预览...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <span className="text-4xl block mb-3">❌</span>
        <p>DOCX预览加载失败</p>
        <p className="text-sm text-gray-400 mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="docx-preview-container">
      <div
        ref={containerRef}
        className="bg-white shadow-lg mx-auto"
        style={{
          maxWidth: '100%',
          minHeight: '500px',
          maxHeight: '800px',
          overflow: 'auto'
        }}
      />
      <style jsx global>{`
        .docx-preview-wrapper {
          background: white;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin: 0 auto;
        }
        .docx-preview-wrapper section.docx {
          min-height: 500px;
        }
      `}</style>
    </div>
  );
}
