'use client';

export type ShapeType = 'capsule' | 'rectangle' | 'chevron' | 'triangle' | 'diamond';

interface ShapeRendererProps {
  shape: ShapeType
  width: number
  height: number
  fillColor: string
  borderColor: string
}

export function ShapeRenderer({
  shape,
  width,
  height,
  fillColor,
  borderColor,
}: ShapeRendererProps) {
  const sw = 2; // stroke width
  const hw = sw / 2;

  switch (shape) {
    case 'capsule': {
      const r = height / 2;
      return (
        <svg
          width={width}
          height={height}
          className="absolute inset-0"
          style={{ overflow: 'visible' }}
        >
          <rect
            x={hw}
            y={hw}
            width={width - sw}
            height={height - sw}
            rx={r}
            ry={r}
            fill={fillColor}
            stroke={borderColor}
            strokeWidth={sw}
          />
        </svg>
      );
    }
    case 'rectangle': {
      return (
        <svg
          width={width}
          height={height}
          className="absolute inset-0"
          style={{ overflow: 'visible' }}
        >
          <rect
            x={hw}
            y={hw}
            width={width - sw}
            height={height - sw}
            rx={4}
            ry={4}
            fill={fillColor}
            stroke={borderColor}
            strokeWidth={sw}
          />
        </svg>
      );
    }
    case 'chevron': {
      const notch = 14;
      const points = [
        `${hw},${hw}`,
        `${width - notch},${hw}`,
        `${width - hw},${height / 2}`,
        `${width - notch},${height - hw}`,
        `${hw},${height - hw}`,
        `${notch},${height / 2}`,
      ].join(' ');
      return (
        <svg
          width={width}
          height={height}
          className="absolute inset-0"
          style={{ overflow: 'visible' }}
        >
          <polygon
            points={points}
            fill={fillColor}
            stroke={borderColor}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    case 'triangle': {
      const points = [
        `${width / 2},${hw}`,
        `${width - hw},${height - hw}`,
        `${hw},${height - hw}`,
      ].join(' ');
      return (
        <svg
          width={width}
          height={height}
          className="absolute inset-0"
          style={{ overflow: 'visible' }}
        >
          <polygon
            points={points}
            fill={fillColor}
            stroke={borderColor}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    case 'diamond': {
      const points = [
        `${width / 2},${hw}`,
        `${width - hw},${height / 2}`,
        `${width / 2},${height - hw}`,
        `${hw},${height / 2}`,
      ].join(' ');
      return (
        <svg
          width={width}
          height={height}
          className="absolute inset-0"
          style={{ overflow: 'visible' }}
        >
          <polygon
            points={points}
            fill={fillColor}
            stroke={borderColor}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    default:
      return null;
  }
}

// Icon previews for shape picker
export function ShapeIcon({ shape, size = 28 }: { shape: ShapeType; size?: number }) {
  const s = size;
  const h = size * 0.7;
  const sw = 1.5;
  const hw = sw / 2;

  switch (shape) {
    case 'capsule': {
      const r = h / 2;
      return (
        <svg width={s} height={h}>
          <rect
            x={hw}
            y={hw}
            width={s - sw}
            height={h - sw}
            rx={r}
            ry={r}
            fill="currentColor"
            opacity="0.15"
            stroke="currentColor"
            strokeWidth={sw}
          />
        </svg>
      );
    }
    case 'rectangle':
      return (
        <svg width={s} height={h}>
          <rect
            x={hw}
            y={hw}
            width={s - sw}
            height={h - sw}
            rx={2}
            ry={2}
            fill="currentColor"
            opacity="0.15"
            stroke="currentColor"
            strokeWidth={sw}
          />
        </svg>
      );
    case 'chevron': {
      const n = 5;
      const pts = `${hw},${hw} ${s - n},${hw} ${s - hw},${h / 2} ${s - n},${h - hw} ${hw},${h - hw} ${n},${h / 2}`;
      return (
        <svg width={s} height={h}>
          <polygon
            points={pts}
            fill="currentColor"
            opacity="0.15"
            stroke="currentColor"
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    case 'triangle': {
      const pts = `${s / 2},${hw} ${s - hw},${h - hw} ${hw},${h - hw}`;
      return (
        <svg width={s} height={h}>
          <polygon
            points={pts}
            fill="currentColor"
            opacity="0.15"
            stroke="currentColor"
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    case 'diamond': {
      const pts = `${s / 2},${hw} ${s - hw},${h / 2} ${s / 2},${h - hw} ${hw},${h / 2}`;
      return (
        <svg width={s} height={h}>
          <polygon
            points={pts}
            fill="currentColor"
            opacity="0.15"
            stroke="currentColor"
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    default:
      return null;
  }
}
