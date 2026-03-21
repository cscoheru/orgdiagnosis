'use client';

interface SlidePreviewProps {
  title: string;
  keyMessage: string;
  bullets: string[];
  layout: string;
  className?: string;
}

export default function SlidePreview({
  title,
  keyMessage,
  bullets,
  layout,
  className = '',
}: SlidePreviewProps) {
  // Render based on layout type
  const renderLayout = () => {
    const layoutUpper = layout?.toUpperCase() || 'PARALLEL_CARDS';

    switch (layoutUpper) {
      case 'MATRIX_2X2':
        return <MatrixLayout title={title} keyMessage={keyMessage} bullets={bullets} size={2} />;
      case 'MATRIX_3X3':
        return <MatrixLayout title={title} keyMessage={keyMessage} bullets={bullets} size={3} />;
      case 'PROCESS_HORIZONTAL':
        return <ProcessLayout title={title} keyMessage={keyMessage} bullets={bullets} direction="horizontal" />;
      case 'PROCESS_VERTICAL':
        return <ProcessLayout title={title} keyMessage={keyMessage} bullets={bullets} direction="vertical" />;
      case 'PROCESS_CIRCULAR':
        return <CircularProcessLayout title={title} keyMessage={keyMessage} bullets={bullets} />;
      case 'PARALLEL_CARDS':
        return <ParallelLayout title={title} keyMessage={keyMessage} bullets={bullets} variant="cards" />;
      case 'PARALLEL_ICONS':
        return <ParallelLayout title={title} keyMessage={keyMessage} bullets={bullets} variant="icons" />;
      case 'TABLE_PRO_CON':
        return <ComparisonLayout title={title} keyMessage={keyMessage} bullets={bullets} type="procon" />;
      case 'TABLE_BEFORE_AFTER':
        return <ComparisonLayout title={title} keyMessage={keyMessage} bullets={bullets} type="beforeafter" />;
      case 'MILESTONE':
        return <MilestoneLayout title={title} keyMessage={keyMessage} bullets={bullets} />;
      case 'TIMELINE_HORIZONTAL':
        return <TimelineLayout title={title} keyMessage={keyMessage} bullets={bullets} />;
      case 'RADAR_DATA':
        return <RadarLayout title={title} keyMessage={keyMessage} bullets={bullets} />;
      case 'KEY_INSIGHT':
        return <KeyInsightLayout title={title} keyMessage={keyMessage} bullets={bullets} />;
      case 'SUMMARY_3KEY':
        return <SummaryLayout title={title} keyMessage={keyMessage} bullets={bullets} />;
      default:
        return <ParallelLayout title={title} keyMessage={keyMessage} bullets={bullets} variant="cards" />;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Slide Container - 16:9 aspect ratio */}
      <div className="aspect-[16/9] bg-gradient-to-br from-slate-50 to-blue-50 p-6 flex flex-col">
        {renderLayout()}
      </div>
    </div>
  );
}

// ============================================
// Layout Components
// ============================================

// Matrix Layout (2x2, 3x3)
function MatrixLayout({ title, keyMessage, bullets, size }: { title: string; keyMessage: string; bullets: string[]; size: 2 | 3 }) {
  const cells = bullets.slice(0, size * size);

  return (
    <div className="h-full flex flex-col">
      {/* Title */}
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-900 truncate">{title}</h3>
        <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-1">{keyMessage}</p>
      </div>

      {/* Matrix Grid */}
      <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {Array.from({ length: size * size }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded border border-gray-200 p-2 flex items-center justify-center text-center"
          >
            <p className="text-[9px] text-gray-700 line-clamp-3">
              {cells[i] || `象限 ${i + 1}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Process Layout (Horizontal/Vertical)
function ProcessLayout({
  title,
  keyMessage,
  bullets,
  direction,
}: {
  title: string;
  keyMessage: string;
  bullets: string[];
  direction: 'horizontal' | 'vertical';
}) {
  const steps = bullets.slice(0, 6);

  if (direction === 'vertical') {
    return (
      <div className="h-full flex flex-col">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <p className="text-[10px] text-gray-600">{keyMessage}</p>
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 bg-white rounded border border-gray-200 p-1.5">
                <p className="text-[9px] text-gray-700 truncate">{step}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="w-0.5 h-3 bg-blue-300" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <p className="text-[10px] text-gray-600">{keyMessage}</p>
      </div>
      <div className="flex-1 flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold mb-1">
              {i + 1}
            </div>
            <div className="w-full bg-white rounded border border-gray-200 p-1.5 flex-1">
              <p className="text-[8px] text-gray-700 line-clamp-3 text-center">{step}</p>
            </div>
            {i < steps.length - 1 && (
              <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 text-blue-400 text-xs">
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Circular Process Layout
function CircularProcessLayout({ title, keyMessage, bullets }: { title: string; keyMessage: string; bullets: string[] }) {
  const steps = bullets.slice(0, 5);
  const angleStep = (2 * Math.PI) / steps.length;

  return (
    <div className="h-full flex flex-col">
      <div className="mb-2 text-center">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <p className="text-[10px] text-gray-600">{keyMessage}</p>
      </div>
      <div className="flex-1 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-blue-200" />
        </div>
        {steps.map((step, i) => {
          const angle = angleStep * i - Math.PI / 2;
          const x = 50 + 35 * Math.cos(angle);
          const y = 50 + 35 * Math.sin(angle);
          return (
            <div
              key={i}
              className="absolute w-10 h-10 bg-white rounded-lg border border-gray-200 shadow-sm flex items-center justify-center"
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
            >
              <p className="text-[7px] text-gray-700 text-center px-0.5 line-clamp-2">{step}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Parallel Cards Layout
function ParallelLayout({
  title,
  keyMessage,
  bullets,
  variant,
}: {
  title: string;
  keyMessage: string;
  bullets: string[];
  variant: 'cards' | 'icons';
}) {
  const items = bullets.slice(0, 4);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <p className="text-[10px] text-gray-600">{keyMessage}</p>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-2">
        {items.map((item, i) => (
          <div
            key={i}
            className={`bg-white rounded-lg border border-gray-200 p-2 ${
              variant === 'icons' ? 'flex flex-col items-center text-center' : ''
            }`}
          >
            {variant === 'icons' && (
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-1">
                <span className="text-xs">◆</span>
              </div>
            )}
            <p className="text-[9px] text-gray-700 line-clamp-3">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Comparison Layout
function ComparisonLayout({
  title,
  keyMessage,
  bullets,
  type,
}: {
  title: string;
  keyMessage: string;
  bullets: string[];
  type: 'procon' | 'beforeafter';
}) {
  const midpoint = Math.ceil(bullets.length / 2);
  const leftItems = bullets.slice(0, midpoint);
  const rightItems = bullets.slice(midpoint);

  const leftLabel = type === 'procon' ? '优势' : '变革前';
  const rightLabel = type === 'procon' ? '挑战' : '变革后';
  const leftColor = type === 'procon' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  const rightColor = type === 'procon' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200';

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3 text-center">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <p className="text-[10px] text-gray-600">{keyMessage}</p>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-3">
        <div className={`rounded-lg border p-2 ${leftColor}`}>
          <h4 className="text-[10px] font-semibold text-gray-700 mb-1">{leftLabel}</h4>
          <ul className="space-y-0.5">
            {leftItems.map((item, i) => (
              <li key={i} className="text-[8px] text-gray-600 flex items-start gap-1">
                <span className="text-green-500">•</span>
                <span className="line-clamp-2">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={`rounded-lg border p-2 ${rightColor}`}>
          <h4 className="text-[10px] font-semibold text-gray-700 mb-1">{rightLabel}</h4>
          <ul className="space-y-0.5">
            {rightItems.map((item, i) => (
              <li key={i} className="text-[8px] text-gray-600 flex items-start gap-1">
                <span className="text-red-500">•</span>
                <span className="line-clamp-2">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Milestone Layout
function MilestoneLayout({ title, keyMessage, bullets }: { title: string; keyMessage: string; bullets: string[] }) {
  const milestones = bullets.slice(0, 5);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <p className="text-[10px] text-gray-600">{keyMessage}</p>
      </div>
      <div className="flex-1 relative">
        {/* Timeline line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-blue-200" />

        <div className="flex justify-between pt-2 h-full">
          {milestones.map((item, i) => (
            <div key={i} className="flex flex-col items-center flex-1">
              <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow z-10" />
              <div className="mt-2 w-full px-0.5">
                <div className="bg-white rounded border border-gray-200 p-1">
                  <p className="text-[7px] text-gray-700 text-center line-clamp-2">{item}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Timeline Layout
function TimelineLayout({ title, keyMessage, bullets }: { title: string; keyMessage: string; bullets: string[] }) {
  const events = bullets.slice(0, 5);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <p className="text-[10px] text-gray-600">{keyMessage}</p>
      </div>
      <div className="flex-1 flex flex-col gap-1.5">
        {events.map((event, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-12 text-[8px] text-gray-500 text-right">Week {i + 1}</div>
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <div className="flex-1 bg-white rounded border border-gray-200 p-1">
              <p className="text-[8px] text-gray-700 truncate">{event}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Radar Layout (simplified as a visual representation)
function RadarLayout({ title, keyMessage, bullets }: { title: string; keyMessage: string; bullets: string[] }) {
  const dimensions = bullets.slice(0, 5);
  const angleStep = (2 * Math.PI) / dimensions.length;

  return (
    <div className="h-full flex flex-col">
      <div className="mb-2 text-center">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <p className="text-[10px] text-gray-600">{keyMessage}</p>
      </div>
      <div className="flex-1 relative">
        {/* Simplified radar representation */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full h-full max-w-[120px] max-h-[120px]">
            {/* Grid circles */}
            <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="30" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="20" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />

            {/* Axes */}
            {dimensions.map((_, i) => {
              const angle = angleStep * i - Math.PI / 2;
              const x2 = 50 + 40 * Math.cos(angle);
              const y2 = 50 + 40 * Math.sin(angle);
              return (
                <line key={i} x1="50" y1="50" x2={x2} y2={y2} stroke="#e5e7eb" strokeWidth="0.5" />
              );
            })}

            {/* Data polygon */}
            <polygon
              points={dimensions.map((_, i) => {
                const angle = angleStep * i - Math.PI / 2;
                const r = 25 + Math.random() * 15; // Simulated data
                return `${50 + r * Math.cos(angle)},${50 + r * Math.sin(angle)}`;
              }).join(' ')}
              fill="rgba(59, 130, 246, 0.2)"
              stroke="#3b82f6"
              strokeWidth="1"
            />
          </svg>
        </div>

        {/* Labels */}
        {dimensions.map((dim, i) => {
          const angle = angleStep * i - Math.PI / 2;
          const x = 50 + 48 * Math.cos(angle);
          const y = 50 + 48 * Math.sin(angle);
          return (
            <div
              key={i}
              className="absolute text-[7px] text-gray-600 text-center"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                width: '40px',
              }}
            >
              {dim.split(':')[0]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Key Insight Layout
function KeyInsightLayout({ title, keyMessage, bullets }: { title: string; keyMessage: string; bullets: string[] }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-4">
      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
        <span className="text-xl">★</span>
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-xs text-gray-600 mb-4 max-w-[80%]">{keyMessage}</p>
      {bullets.length > 0 && (
        <div className="text-[10px] text-gray-500 bg-blue-50 px-3 py-1.5 rounded-full">
          {bullets[0]}
        </div>
      )}
    </div>
  );
}

// Summary Layout (3 Key Points)
function SummaryLayout({ title, keyMessage, bullets }: { title: string; keyMessage: string; bullets: string[] }) {
  const points = bullets.slice(0, 3);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3 text-center">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <p className="text-[10px] text-gray-600">{keyMessage}</p>
      </div>
      <div className="flex-1 flex gap-2">
        {points.map((point, i) => (
          <div key={i} className="flex-1 bg-white rounded-lg border border-gray-200 p-2 flex flex-col">
            <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold mb-1 self-center">
              {i + 1}
            </div>
            <p className="text-[8px] text-gray-700 text-center line-clamp-4">{point}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
