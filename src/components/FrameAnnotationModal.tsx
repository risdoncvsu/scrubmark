import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  RotateCcw, 
  Trash2, 
  Check, 
  PenTool, 
  ArrowUpRight, 
  Square, 
  Circle, 
  Type, 
  ClipboardPaste, 
  Download,
  Camera,
  Layers,
  Sparkles
} from 'lucide-react';
import type { Video } from '../types';
import { formatTime } from '../utils';

interface FrameAnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageDataUrl: string) => void;
  timestamp: number;
  video: Video;
}

type ToolType = 'pen' | 'arrow' | 'rect' | 'circle' | 'text';

const COLORS = [
  { name: 'Red', hex: '#EF4444' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Green', hex: '#10B981' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'White', hex: '#FFFFFF' },
];

const STROKE_WIDTHS = [
  { label: 'S', value: 3 },
  { label: 'M', value: 6 },
  { label: 'L', value: 11 },
];

export function FrameAnnotationModal({
  isOpen,
  onClose,
  onSave,
  timestamp,
  video
}: FrameAnnotationModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#EF4444');
  const [strokeWidth, setStrokeWidth] = useState<number>(6);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [isLoadingBackdrop, setIsLoadingBackdrop] = useState<boolean>(true);
  const [textInput, setTextInput] = useState<string>('Check this');
  const [isAddingText, setIsAddingText] = useState<boolean>(false);
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);

  // Drawing state
  const isDrawingRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const snapshotRef = useRef<ImageData | null>(null);

  const CANVAS_WIDTH = 1280;
  const CANVAS_HEIGHT = 720;

  // Initialize and load backdrop frame
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsLoadingBackdrop(true);

    // Fill dark placeholder first
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid pattern
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    const isDrive = video.source_type === 'google_drive' || (video.youtube_video_id && video.youtube_video_id.length > 20);
    const proxyUrl = `/api/proxy-thumbnail?id=${encodeURIComponent(video.youtube_video_id)}&type=${isDrive ? 'google_drive' : 'youtube'}`;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const drawTimecodeStamp = () => {
      // Draw watermark timecode banner in top-left
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath();
      ctx.roundRect(24, 24, 280, 52, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(46, 50, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 20px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`FRAME ${formatTime(timestamp)}`, 66, 57);
      ctx.restore();

      // Save initial state to history
      const initialSnapshot = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      setHistory([initialSnapshot]);
      setIsLoadingBackdrop(false);
    };

    img.onload = () => {
      // Draw scaled to cover 16:9 canvas
      ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawTimecodeStamp();
    };

    img.onerror = () => {
      // Fallback banner
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.font = 'bold 36px sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.textAlign = 'center';
      ctx.fillText(`Paused Frame at ${formatTime(timestamp)}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.fillText(video.project_name, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
      ctx.textAlign = 'left';
      drawTimecodeStamp();
    };

    img.src = proxyUrl;
  }, [video, timestamp]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        initCanvas();
      }, 50);
    } else {
      setHistory([]);
    }
  }, [isOpen, initCanvas]);

  // Support pasting image from clipboard (Ctrl+V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = (event) => {
            const pasteImg = new Image();
            pasteImg.onload = () => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const ctx = canvas.getContext('2d');
              if (!ctx) return;

              // Draw pasted screenshot into canvas
              ctx.drawImage(pasteImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

              // Stamp timecode
              ctx.save();
              ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
              ctx.beginPath();
              ctx.roundRect(24, 24, 280, 52, 10);
              ctx.fill();
              ctx.fillStyle = '#10B981';
              ctx.beginPath();
              ctx.arc(46, 50, 7, 0, Math.PI * 2);
              ctx.fill();
              ctx.font = 'bold 20px monospace';
              ctx.fillStyle = '#FFFFFF';
              ctx.fillText(`FRAME ${formatTime(timestamp)}`, 66, 57);
              ctx.restore();

              const snapshot = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
              setHistory(prev => [...prev, snapshot]);
            };
            pasteImg.src = event.target?.result as string;
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, timestamp]);

  // Helper to translate mouse/touch coordinate into canvas space
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, color: string, width: number) => {
    const headlen = Math.max(16, width * 3.5);
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw main line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Draw arrow head
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    startPosRef.current = coords;

    if (activeTool === 'text') {
      setTextPosition(coords);
      setIsAddingText(true);
      return;
    }

    isDrawingRef.current = true;
    snapshotRef.current = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (activeTool === 'pen') {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);

    if (activeTool === 'pen') {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else if (snapshotRef.current) {
      // Restore previous state before drawing preview shape
      ctx.putImageData(snapshotRef.current, 0, 0);

      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (activeTool === 'rect') {
        const x = Math.min(startPosRef.current.x, coords.x);
        const y = Math.min(startPosRef.current.y, coords.y);
        const w = Math.abs(coords.x - startPosRef.current.x);
        const h = Math.abs(coords.y - startPosRef.current.y);
        ctx.beginPath();
        ctx.strokeRect(x, y, w, h);
      } else if (activeTool === 'circle') {
        const radiusX = Math.abs(coords.x - startPosRef.current.x) / 2;
        const radiusY = Math.abs(coords.y - startPosRef.current.y) / 2;
        const centerX = Math.min(startPosRef.current.x, coords.x) + radiusX;
        const centerY = Math.min(startPosRef.current.y, coords.y) + radiusY;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (activeTool === 'arrow') {
        drawArrow(ctx, startPosRef.current.x, startPosRef.current.y, coords.x, coords.y, selectedColor, strokeWidth);
      }
    }
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Push new snapshot to history
    const snapshot = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setHistory(prev => [...prev, snapshot]);
  };

  const handlePlaceText = () => {
    if (!textPosition || !textInput.trim()) {
      setIsAddingText(false);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    // Background pill for readability
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const textMetrics = ctx.measureText(textInput);
    const paddingX = 14;
    const paddingY = 10;
    const boxWidth = textMetrics.width + paddingX * 2;
    const boxHeight = 36 + paddingY;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.beginPath();
    ctx.roundRect(textPosition.x, textPosition.y - 28, boxWidth, boxHeight, 8);
    ctx.fill();

    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = selectedColor;
    ctx.fillText(textInput, textPosition.x + paddingX, textPosition.y + 2);
    ctx.restore();

    const snapshot = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setHistory(prev => [...prev, snapshot]);

    setIsAddingText(false);
    setTextPosition(null);
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nextHistory = [...history];
    nextHistory.pop(); // Remove current
    const previous = nextHistory[nextHistory.length - 1];

    if (previous) {
      ctx.putImageData(previous, 0, 0);
      setHistory(nextHistory);
    }
  };

  const handleClear = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseFrame = history[0];
    if (baseFrame) {
      ctx.putImageData(baseFrame, 0, 0);
      setHistory([baseFrame]);
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png', 0.95);
      onSave(dataUrl);
      onClose();
    } catch (e) {
      console.error('Error exporting canvas:', e);
      alert('Could not export screenshot due to browser security. Please try taking a snip and pressing Ctrl+V.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-5xl h-[92vh] max-h-[820px] flex flex-col shadow-2xl overflow-hidden relative"
      >
        {/* Header */}
        <div className="h-14 bg-neutral-950 border-b border-neutral-800 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
              <Camera size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">Annotate Video Frame</h2>
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono text-xs font-bold border border-red-500/30">
                  {formatTime(timestamp)}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 truncate max-w-xs sm:max-w-md">
                Draw arrows, shapes, or callout notes directly on the frozen video frame
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-red-600/30 cursor-pointer transition-all"
            >
              <Check size={14} />
              <span>Attach to Note</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Canvas Workspace & Toolbar */}
        <div className="flex-1 flex flex-col min-h-0 bg-neutral-950/70 p-3 sm:p-4 overflow-hidden">
          {/* Top Toolset Bar */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-2 mb-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
            {/* Tool Selection */}
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
              <button
                type="button"
                onClick={() => setActiveTool('pen')}
                title="Freehand Pen"
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTool === 'pen' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <PenTool size={14} />
                <span className="hidden sm:inline">Pen</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('arrow')}
                title="Arrow Pointer"
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTool === 'arrow' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <ArrowUpRight size={15} />
                <span className="hidden sm:inline">Arrow</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('rect')}
                title="Bounding Box"
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTool === 'rect' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <Square size={14} />
                <span className="hidden sm:inline">Box</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('circle')}
                title="Circle Highlight"
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTool === 'circle' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <Circle size={14} />
                <span className="hidden sm:inline">Circle</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('text')}
                title="Text Label"
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTool === 'text' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <Type size={14} />
                <span className="hidden sm:inline">Text</span>
              </button>
            </div>

            {/* Colors */}
            <div className="flex items-center gap-1.5 bg-neutral-950 p-1.5 rounded-lg border border-neutral-800">
              <span className="text-[11px] text-neutral-500 mr-1 hidden md:inline">Color:</span>
              {COLORS.map(c => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setSelectedColor(c.hex)}
                  title={c.name}
                  className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer flex items-center justify-center ${
                    selectedColor === c.hex ? 'scale-115 border-white shadow-md' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  {selectedColor === c.hex && (
                    <span className={`w-1.5 h-1.5 rounded-full ${c.hex === '#FFFFFF' ? 'bg-black' : 'bg-white'}`} />
                  )}
                </button>
              ))}
            </div>

            {/* Stroke Width */}
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
              <span className="text-[11px] text-neutral-500 mr-1 hidden lg:inline">Width:</span>
              {STROKE_WIDTHS.map(sw => (
                <button
                  key={sw.value}
                  type="button"
                  onClick={() => setStrokeWidth(sw.value)}
                  className={`px-2 py-1 rounded text-xs font-mono font-bold transition-colors cursor-pointer ${
                    strokeWidth === sw.value ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  {sw.label}
                </button>
              ))}
            </div>

            {/* Undo / Clear Actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleUndo}
                disabled={history.length <= 1}
                title="Undo (Ctrl+Z)"
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1 text-xs"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Undo</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={history.length <= 1}
                title="Clear all drawings"
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1 text-xs"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>

          {/* Text Placement Prompt */}
          {activeTool === 'text' && (
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-2 mb-2 flex items-center justify-between text-xs text-indigo-300">
              <div className="flex items-center gap-2">
                <Type size={14} />
                <span>Text Label:</span>
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="e.g. Too dark / Fix subtitle / Logo cut off"
                  className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 w-64"
                />
              </div>
              <span className="text-[11px] text-neutral-400 hidden sm:inline">Click anywhere on the canvas to place this text</span>
            </div>
          )}

          {/* Interactive Canvas Viewport */}
          <div className="flex-1 relative flex items-center justify-center bg-black/60 rounded-xl overflow-hidden border border-neutral-800/80 shadow-inner">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="max-w-full max-h-full aspect-video object-contain cursor-crosshair touch-none select-none rounded shadow-2xl"
            />

            {isLoadingBackdrop && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 text-neutral-400">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono">Freezing video frame at {formatTime(timestamp)}...</span>
              </div>
            )}
          </div>

          {/* Bottom Helpful Hints & Quick Paste */}
          <div className="pt-2.5 flex items-center justify-between text-[11px] text-neutral-500 shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-neutral-400">
                <ClipboardPaste size={12} className="text-indigo-400" />
                <strong>Pro Tip:</strong> Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px]">Ctrl+V</kbd> to paste a high-res screenshot directly from your clipboard
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-3.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-medium cursor-pointer transition-colors flex items-center gap-1 shadow-sm"
              >
                <Check size={13} />
                <span>Save to Note</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
