'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import mermaid from 'mermaid';

interface MermaidEditorProps {
  code: string;
  onChange?: (code: string) => void;
  readOnly?: boolean;
  height?: string;
}

let mermaidInitialized = false;

export default function MermaidEditor({
  code: initialCode,
  onChange,
  readOnly = false,
  height = '500px',
}: MermaidEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState('');
  const [renderedSvg, setRenderedSvg] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  // Initialize mermaid once (module-level)
  useEffect(() => {
    if (mermaidInitialized) return;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: '#3b82f6',
        primaryTextColor: '#fff',
        primaryBorderColor: '#1d4ed8',
        lineColor: '#64748b',
        secondaryColor: '#f1f5f9',
        tertiaryColor: '#fff',
        fontSize: '13px',
      },
      flowchart: { htmlLabels: true, curve: 'basis', padding: 15 },
    });
    mermaidInitialized = true;
  }, []);

  const renderCode = useCallback(async (source: string) => {
    try {
      const id = `mermaid-${Date.now()}`;
      const { svg } = await mermaid.render(id, source);
      setRenderedSvg(svg);
      setError('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.replace(/^Parse error[^:]*:/, '语法错误:'));
    }
  }, []);

  // Initial render
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      renderCode(code);
    }
  }, [code, renderCode]);

  // Debounced render on code change
  useEffect(() => {
    if (!mountedRef.current) return;
    if (renderTimer.current) clearTimeout(renderTimer.current);
    renderTimer.current = setTimeout(() => renderCode(code), 400);
    return () => { if (renderTimer.current) clearTimeout(renderTimer.current); };
  }, [code, renderCode]);

  const handleCodeChange = (val: string) => {
    setCode(val);
    onChange?.(val);
  };

  const downloadSVG = () => {
    const blob = new Blob([renderedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'diagram.svg'; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPNG = () => {
    const svgEl = previewRef.current?.querySelector('svg');
    if (!svgEl) return;
    const svgStr = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'diagram.png'; a.click();
        URL.revokeObjectURL(url);
      });
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
  };

  return (
    <div className="flex flex-col border rounded-lg overflow-hidden bg-white" style={{ height }}>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b text-xs">
        <span className="text-gray-500 font-medium">Mermaid</span>
        <div className="flex-1" />
        <button onClick={downloadSVG} className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700">SVG</button>
        <button onClick={downloadPNG} className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700">PNG</button>
        {readOnly && <span className="text-gray-400 ml-2">只读</span>}
      </div>
      <div className="flex flex-1 overflow-hidden">
        {!readOnly && (
          <div className="w-2/5 border-r flex flex-col">
            <div className="px-2 py-1 text-[10px] text-gray-400 bg-gray-50 border-b">代码</div>
            <textarea
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="flex-1 p-3 text-xs font-mono resize-none outline-none bg-gray-50 text-gray-800 leading-relaxed"
              spellCheck={false}
              placeholder="输入 mermaid 代码..."
            />
          </div>
        )}
        <div className={`${readOnly ? 'w-full' : 'w-3/5'} flex flex-col`}>
          <div className="px-2 py-1 text-[10px] text-gray-400 bg-gray-50 border-b">预览</div>
          <div
            ref={previewRef}
            className={`flex-1 overflow-auto p-4 ${error ? '' : 'flex items-center justify-center'}`}
          >
            {error ? (
              <pre className="text-xs text-red-600 bg-red-50 p-3 rounded max-w-md whitespace-pre-wrap">{error}</pre>
            ) : renderedSvg ? (
              <div dangerouslySetInnerHTML={{ __html: renderedSvg }} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
