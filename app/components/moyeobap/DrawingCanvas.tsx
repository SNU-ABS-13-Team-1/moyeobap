'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../lib/phoneMatch';

// 갈틱폰용 그림판. 도구를 일부러 적게 뒀습니다(펜·지우개·채우기·색·되돌리기·전체 지우기) —
// "잘 못 그리게" 만드는 것이 이 게임의 재미이기 때문입니다. 마우스·터치 모두 Pointer Events로 받습니다.

export type DrawingCanvasHandle = {
  /** 현재 그림을 PNG data URL로 내보냅니다(배경 흰색 포함). */
  toDataURL: () => string;
  /** 아무것도 안 그렸는지. */
  isBlank: () => boolean;
};

const PALETTE = [
  '#111827', '#6b7280', '#ffffff', '#dc2626', '#f97316', '#facc15', '#16a34a', '#84cc16',
  '#0d9488', '#0ea5e9', '#2563eb', '#4f46e5', '#9333ea', '#ec4899', '#92400e', '#fdba74',
];
const SIZES = [
  { key: 'thin', label: '얇게', px: 3 },
  { key: 'normal', label: '보통', px: 7 },
  { key: 'thick', label: '굵게', px: 16 },
] as const;
type Tool = 'pen' | 'eraser' | 'fill';
const MAX_UNDO = 25;

/** 같은 색 영역을 칠합니다(4방향 스캔). 선 경계의 안티앨리어싱은 약간의 허용치로 넘어갑니다. */
function floodFill(ctx: CanvasRenderingContext2D, startX: number, startY: number, hex: string) {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  const idx = (x: number, y: number) => (y * width + x) * 4;
  const start = idx(startX, startY);
  const target = [d[start], d[start + 1], d[start + 2], d[start + 3]];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (Math.abs(target[0] - r) + Math.abs(target[1] - g) + Math.abs(target[2] - b) < 6 && target[3] === 255) return;
  const near = (i: number) => Math.abs(d[i] - target[0]) + Math.abs(d[i + 1] - target[1]) + Math.abs(d[i + 2] - target[2]) + Math.abs(d[i + 3] - target[3]) < 90;
  const stack = [startX, startY];
  const seen = new Uint8Array(width * height);
  while (stack.length) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    let lx = x;
    while (lx >= 0 && !seen[y * width + lx] && near(idx(lx, y))) lx -= 1;
    lx += 1;
    let up = false;
    let down = false;
    for (let cx = lx; cx < width && !seen[y * width + cx] && near(idx(cx, y)); cx += 1) {
      const i = idx(cx, y);
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      seen[y * width + cx] = 1;
      if (y > 0) {
        const ok = !seen[(y - 1) * width + cx] && near(idx(cx, y - 1));
        if (ok && !up) { stack.push(cx, y - 1); up = true; } else if (!ok) up = false;
      }
      if (y < height - 1) {
        const ok = !seen[(y + 1) * width + cx] && near(idx(cx, y + 1));
        if (ok && !down) { stack.push(cx, y + 1); down = true; } else if (!ok) down = false;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, { disabled?: boolean }>(function DrawingCanvas({ disabled = false }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const undoRef = useRef<ImageData[]>([]);
  const dirtyRef = useRef(false);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(PALETTE[0]);
  const [size, setSize] = useState<(typeof SIZES)[number]['key']>('normal');
  const [undoCount, setUndoCount] = useState(0);

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null, []);

  // 처음 한 번 흰 배경으로 채웁니다.
  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }, [getCtx]);

  useImperativeHandle(ref, () => ({
    toDataURL: () => canvasRef.current?.toDataURL('image/png') ?? '',
    isBlank: () => !dirtyRef.current,
  }));

  function snapshot() {
    const ctx = getCtx();
    if (!ctx) return;
    undoRef.current.push(ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT));
    if (undoRef.current.length > MAX_UNDO) undoRef.current.shift();
    setUndoCount(undoRef.current.length);
  }

  function undo() {
    const ctx = getCtx();
    const prev = undoRef.current.pop();
    if (!ctx || !prev) return;
    ctx.putImageData(prev, 0, 0);
    setUndoCount(undoRef.current.length);
  }

  function clearAll() {
    const ctx = getCtx();
    if (!ctx) return;
    snapshot();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  function pointFrom(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (CANVAS_WIDTH / rect.width));
    const y = Math.round((e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height));
    return { x: Math.max(0, Math.min(CANVAS_WIDTH - 1, x)), y: Math.max(0, Math.min(CANVAS_HEIGHT - 1, y)) };
  }

  function strokeStyle(ctx: CanvasRenderingContext2D) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    const px = SIZES.find((s) => s.key === size)?.px ?? 7;
    ctx.lineWidth = tool === 'eraser' ? px * 2 : px;
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || e.button !== 0) return;
    const ctx = getCtx();
    if (!ctx) return;
    e.preventDefault();
    const p = pointFrom(e);
    snapshot();
    dirtyRef.current = true;
    if (tool === 'fill') {
      floodFill(ctx, p.x, p.y, color);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = p;
    strokeStyle(ctx);
    // 점 하나도 찍히게
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y);
    ctx.stroke();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    const ctx = getCtx();
    const last = lastRef.current;
    if (!ctx || !last) return;
    e.preventDefault();
    const p = pointFrom(e);
    strokeStyle(ctx);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // 이미 해제됨
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    }
  }

  return (
    <div className={`draw ${disabled ? 'draw--disabled' : ''}`} onKeyDown={onKeyDown} tabIndex={-1}>
      <div className="draw__tools" role="toolbar" aria-label="그림 도구">
        <div className="draw__group">
          <button aria-pressed={tool === 'pen'} className={`draw__tool ${tool === 'pen' ? 'draw__tool--active' : ''}`} disabled={disabled} onClick={() => setTool('pen')} title="펜" type="button">✏️</button>
          <button aria-pressed={tool === 'eraser'} className={`draw__tool ${tool === 'eraser' ? 'draw__tool--active' : ''}`} disabled={disabled} onClick={() => setTool('eraser')} title="지우개" type="button">🧽</button>
          <button aria-pressed={tool === 'fill'} className={`draw__tool ${tool === 'fill' ? 'draw__tool--active' : ''}`} disabled={disabled} onClick={() => setTool('fill')} title="채우기" type="button">🪣</button>
        </div>
        <div className="draw__group" aria-label="굵기">
          {SIZES.map((s) => (
            <button aria-pressed={size === s.key} className={`draw__tool draw__size ${size === s.key ? 'draw__tool--active' : ''}`} disabled={disabled} key={s.key} onClick={() => setSize(s.key)} title={s.label} type="button">
              <span style={{ width: Math.min(22, s.px + 4), height: Math.min(22, s.px + 4) }} />
            </button>
          ))}
        </div>
        <div className="draw__group">
          <button className="draw__tool" disabled={disabled || undoCount === 0} onClick={undo} title="되돌리기 (⌘Z)" type="button">↶</button>
          <button className="draw__tool" disabled={disabled} onClick={clearAll} title="전체 지우기" type="button">🗑️</button>
        </div>
      </div>
      <div className="draw__palette" role="radiogroup" aria-label="색">
        {PALETTE.map((c) => (
          <button
            aria-checked={color === c}
            aria-label={c}
            className={`draw__swatch ${color === c ? 'draw__swatch--active' : ''}`}
            disabled={disabled}
            key={c}
            onClick={() => {
              setColor(c);
              if (tool === 'eraser') setTool('pen');
            }}
            role="radio"
            style={{ background: c }}
            type="button"
          />
        ))}
      </div>
      <canvas
        aria-label="그림판"
        className={`draw__canvas draw__canvas--${tool}`}
        height={CANVAS_HEIGHT}
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerLeave={onPointerUp}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={canvasRef}
        width={CANVAS_WIDTH}
      />
    </div>
  );
});
