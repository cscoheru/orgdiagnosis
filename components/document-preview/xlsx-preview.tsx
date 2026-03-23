'use client';

import { useEffect, useState } from 'react';

interface XLSXPreviewProps {
  url: string;
  onError?: (error: string) => void;
  onDownload?: () => void;
}

interface SheetData {
  name: string;
  data: (string | number | boolean | null)[][];
}

export default function XLSXPreview({ url, onError }: XLSXPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadXLSX() {
      try {
        setLoading(true);
        setError(null);

        // Fetch the XLSX file
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load XLSX: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // Dynamic import to avoid SSR issues
        const XLSX = await import('xlsx');

        // Parse workbook
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        // Convert each sheet to array
        const sheetsData: SheetData[] = workbook.SheetNames.map(name => {
          const sheet = workbook.Sheets[name];
          const data = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: null
          }) as (string | number | boolean | null)[][];
          return { name, data };
        });

        if (mounted) {
          setSheets(sheetsData);
          setLoading(false);
        }

      } catch (err) {
        if (mounted) {
          const errorMsg = err instanceof Error ? err.message : '加载XLSX失败';
          setError(errorMsg);
          setLoading(false);
          onError?.(errorMsg);
        }
      }
    }

    loadXLSX();

    return () => {
      mounted = false;
    };
  }, [url, onError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-gray-500">加载XLSX预览...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <span className="text-4xl block mb-3">❌</span>
        <p>XLSX预览加载失败</p>
        <p className="text-sm text-gray-400 mt-2">{error}</p>
      </div>
    );
  }

  if (sheets.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <span className="text-4xl block mb-3">📭</span>
        <p>工作簿为空</p>
      </div>
    );
  }

  const currentSheet = sheets[activeSheet];
  const maxRows = 100; // Limit rows for performance
  const maxCols = 20;  // Limit columns for display

  return (
    <div className="xlsx-preview-container">
      {/* Sheet Tabs */}
      {sheets.length > 1 && (
        <div className="flex gap-1 mb-3 border-b border-gray-200 pb-2 overflow-x-auto">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              onClick={() => setActiveSheet(index)}
              className={`px-4 py-2 text-sm rounded-t-lg whitespace-nowrap transition-colors ${
                activeSheet === index
                  ? 'bg-green-100 text-green-700 font-medium border-b-2 border-green-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto border border-gray-200 rounded-lg" style={{ maxHeight: '600px' }}>
        <table className="w-full text-sm">
          <tbody>
            {currentSheet.data.slice(0, maxRows).map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={rowIndex === 0 ? 'bg-gray-100 font-medium sticky top-0' : 'hover:bg-gray-50'}
              >
                {/* Row number */}
                <td className="px-2 py-1 border-r border-b border-gray-200 bg-gray-50 text-gray-400 text-xs w-10 text-center">
                  {rowIndex + 1}
                </td>
                {/* Cells */}
                {(row as any[]).slice(0, maxCols).map((cell, colIndex) => (
                  <td
                    key={colIndex}
                    className="px-3 py-2 border-r border-b border-gray-200 min-w-[80px]"
                  >
                    {cell !== null && cell !== undefined ? String(cell) : ''}
                  </td>
                ))}
                {/* Empty cells if row is shorter */}
                {Array.from({ length: Math.max(0, maxCols - (row?.length || 0)) }, (_, i) => (
                  <td key={`empty-${i}`} className="px-3 py-2 border-r border-b border-gray-200 min-w-[80px]">
                    &nbsp;
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info */}
      <div className="mt-3 text-xs text-gray-400 flex justify-between">
        <span>工作表: {currentSheet.name}</span>
        <span>
          {currentSheet.data.length} 行
          {currentSheet.data.length > maxRows && ` (显示前 ${maxRows} 行)`}
        </span>
      </div>
    </div>
  );
}
