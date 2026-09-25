import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
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
  Edit2,
  Upload,
  Move
} from 'lucide-react';
import type { Video } from '../types';
import { formatTime } from '../utils';

export interface TextAnnotationItem {
  id: string;
  text: string;
  x: number; // in canvas coordinates 0..1280
  y: number; // in canvas coordinates 0..720
  color: string;
}

interface FrameAnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageDataUrl: string) => void;
  timestamp: number;
  video: Video;
  videoElement?: HTMLVideoElement | null;
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
  video,
  videoElement
}: FrameAnnotationModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#EF4444');
  const [strokeWidth, setStrokeWidth] = useState<number>(6);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [isLoadingBackdrop, setIsLoadingBackdrop] = useState<boolean>(true);

  // Text annotations state (fully editable on double-click & draggable)
  const [textItems, setTextItems] = useState<TextAnnotationItem[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editTextValue, setEditTextValue] = useState<string>('');
  const [quickTextPreset, setQuickTextPreset] = useState<string>('Check this frame');
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Strictly enforced 16:9 canvas viewport dimension to eliminate any aspect ratio distortion
  const [displayDimensions, setDisplayDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Drawing state
  const isDrawingRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const snapshotRef = useRef<ImageData | null>(null);

  const CANVAS_WIDTH = 1280;
  const CANVAS_HEIGHT = 720;

  // Measure container and compute exact 16:9 pixel dimensions
  useEffect(() => {
    if (!isOpen) return;

    const updateSize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth - 16;
      const h = containerRef.current.clientHeight - 16;
      if (w <= 0 || h <= 0) return;

      const targetRatio = 16 / 9;
      let finalW = w;
      let finalH = w / targetRatio;
      if (finalH > h) {
        finalH = h;
        finalW = finalH * targetRatio;
      }
      setDisplayDimensions({
        width: Math.max(300, Math.floor(finalW)),
        height: Math.max(168, Math.floor(finalH))
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', updateSize);
      ro.disconnect();
    };
  }, [isOpen]);

  // Initialize and load backdrop frame with true aspect ratio & maximum quality
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsLoadingBackdrop(true);

    // Fill dark placeholder
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const drawTimecodeStamp = () => {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(24, 24, 280, 50, 10);
      } else {
        ctx.rect(24, 24, 280, 50);
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(46, 49, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 20px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`FRAME ${formatTime(timestamp)}`, 66, 56);
      ctx.restore();

      const initialSnapshot = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      setHistory([initialSnapshot]);
      setIsLoadingBackdrop(false);
    };

    // If an HTML5 video element is passed and has loaded video frames, capture directly!
    if (videoElement && videoElement.videoWidth > 0 && !videoElement.error) {
      try {
        ctx.drawImage(videoElement, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawTimecodeStamp();
        return;
      } catch (err) {
        console.warn('Could not directly grab frame from video element, falling back to proxy:', err);
      }
    }

    const isDrive = video.source_type === 'google_drive' || (video.youtube_video_id && video.youtube_video_id.length > 20);
    const proxyUrl = `/api/proxy-thumbnail?id=${encodeURIComponent(video.youtube_video_id)}&type=${isDrive ? 'google_drive' : 'youtube'}`;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const canvasRatio = CANVAS_WIDTH / CANVAS_HEIGHT; // 16:9 = 1.7777778
      const imgW = img.naturalWidth || CANVAS_WIDTH;
      const imgH = img.naturalHeight || CANVAS_HEIGHT;
      const imgRatio = imgW / imgH;

      // YouTube 4:3 letterbox format check (hqdefault or sddefault have 4:3 canvas with black bars on top and bottom)
      // Extract the true 16:9 video frame by cropping the black letterbox bars:
      if (Math.abs(imgRatio - (4 / 3)) < 0.08) {
        const cropH = imgW / canvasRatio; // 480 / (16/9) = 270
        const cropY = (imgH - cropH) / 2; // (360 - 270) / 2 = 45
        ctx.drawImage(img, 0, cropY, imgW, cropH, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } else {
        // Normal aspect ratio preservation (no vertical or horizontal stretch)
        let drawW = CANVAS_WIDTH;
        let drawH = CANVAS_HEIGHT;
        let drawX = 0;
        let drawY = 0;
        if (imgRatio > canvasRatio) {
          drawH = CANVAS_WIDTH / imgRatio;
          drawY = (CANVAS_HEIGHT - drawH) / 2;
        } else if (imgRatio < canvasRatio) {
          drawW = CANVAS_HEIGHT * imgRatio;
          drawX = (CANVAS_WIDTH - drawW) / 2;
        }
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      }

      drawTimecodeStamp();
    };

    img.onerror = () => {
      // Fallback clean high-res canvas
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.font = 'bold 36px sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.textAlign = 'center';
      ctx.fillText(`Video Frame at ${formatTime(timestamp)}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.fillText(video.project_name, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 25);
      ctx.textAlign = 'left';
      drawTimecodeStamp();
    };

    img.src = proxyUrl;
  }, [video, timestamp, videoElement]);

  useEffect(() => {
    if (isOpen) {
      setTextItems([]);
      setEditingTextId(null);
      setTimeout(() => {
        initCanvas();
      }, 40);
    } else {
      setHistory([]);
      setTextItems([]);
      setEditingTextId(null);
    }
  }, [isOpen, initCanvas]);

  // Support pasting high-res screenshot from clipboard (Ctrl+V)
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

              ctx.fillStyle = '#0a0a0a';
              ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

              const canvasRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
              const pW = pasteImg.naturalWidth;
              const pH = pasteImg.naturalHeight;
              const pRatio = pW / pH;

              let dW = CANVAS_WIDTH;
              let dH = CANVAS_HEIGHT;
              let dX = 0;
              let dY = 0;
              if (pRatio > canvasRatio) {
                dH = CANVAS_WIDTH / pRatio;
                dY = (CANVAS_HEIGHT - dH) / 2;
              } else if (pRatio < canvasRatio) {
                dW = CANVAS_HEIGHT * pRatio;
                dX = (CANVAS_WIDTH - dW) / 2;
              }

              ctx.drawImage(pasteImg, dX, dY, dW, dH);

              // Stamp timecode
              ctx.save();
              ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
              ctx.beginPath();
              if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(24, 24, 280, 50, 10);
              } else {
                ctx.rect(24, 24, 280, 50);
              }
              ctx.fill();
              ctx.fillStyle = '#10B981';
              ctx.beginPath();
              ctx.arc(46, 49, 7, 0, Math.PI * 2);
              ctx.fill();
              ctx.font = 'bold 20px ui-monospace, SFMono-Regular, monospace';
              ctx.fillStyle = '#FFFFFF';
              ctx.fillText(`FRAME ${formatTime(timestamp)}`, 66, 56);
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

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

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
      // Place a new interactive text item and open inline editing immediately
      const newId = 'text_' + Date.now();
      const initialText = quickTextPreset.trim() || 'Click to edit text';
      const newItem: TextAnnotationItem = {
        id: newId,
        text: initialText,
        x: coords.x,
        y: coords.y,
        color: selectedColor,
      };
      setTextItems(prev => [...prev, newItem]);
      setEditingTextId(newId);
      setEditTextValue(initialText);
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
      ctx.putImageData(snapshotRef.current, 0, 0);

      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (activeTool === 'rect') {
        const w = coords.x - startPosRef.current.x;
        const h = coords.y - startPosRef.current.y;
        ctx.strokeRect(startPosRef.current.x, startPosRef.current.y, w, h);
      } else if (activeTool === 'circle') {
        const rx = Math.abs(coords.x - startPosRef.current.x) / 2;
        const ry = Math.abs(coords.y - startPosRef.current.y) / 2;
        const cx = Math.min(startPosRef.current.x, coords.x) + rx;
        const cy = Math.min(startPosRef.current.y, coords.y) + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
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

    const snapshot = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setHistory(prev => [...prev, snapshot]);
  };

  const handleTextDragStart = (e: React.MouseEvent, id: string) => {
    if (editingTextId === id) return;
    e.stopPropagation();
    const item = textItems.find(t => t.id === id);
    if (!item) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initItemX = item.x;
    const initItemY = item.y;

    const canvas = canvasRef.current;
    const rect = canvas ? canvas.getBoundingClientRect() : null;
    const scaleX = rect ? CANVAS_WIDTH / rect.width : 1;
    const scaleY = rect ? CANVAS_HEIGHT / rect.height : 1;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) * scaleX;
      const dy = (moveEvent.clientY - startY) * scaleY;
      const newX = Math.max(20, Math.min(CANVAS_WIDTH - 80, initItemX + dx));
      const newY = Math.max(30, Math.min(CANVAS_HEIGHT - 30, initItemY + dy));
      setTextItems(prev => prev.map(t => t.id === id ? { ...t, x: newX, y: newY } : t));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const canvasRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
        const imgRatio = (img.naturalWidth || CANVAS_WIDTH) / (img.naturalHeight || CANVAS_HEIGHT);
        let drawW = CANVAS_WIDTH;
        let drawH = CANVAS_HEIGHT;
        let drawX = 0;
        let drawY = 0;
        if (imgRatio > canvasRatio) {
          drawH = CANVAS_WIDTH / imgRatio;
          drawY = (CANVAS_HEIGHT - drawH) / 2;
        } else if (imgRatio < canvasRatio) {
          drawW = CANVAS_HEIGHT * imgRatio;
          drawX = (CANVAS_WIDTH - drawW) / 2;
        }
        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        const snapshot = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        setHistory(prev => [...prev, snapshot]);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveTextEdit = (id: string) => {
    const val = editTextValue.trim();
    if (!val) {
      // Remove text item if emptied
      setTextItems(prev => prev.filter(t => t.id !== id));
    } else {
      setTextItems(prev => prev.map(t => t.id === id ? { ...t, text: val } : t));
    }
    setEditingTextId(null);
  };

  const handleDeleteTextItem = (id: string) => {
    setTextItems(prev => prev.filter(t => t.id !== id));
    if (editingTextId === id) setEditingTextId(null);
  };

  const handleUndo = () => {
    // If text item was recently added, remove it first
    if (textItems.length > 0) {
      setTextItems(prev => prev.slice(0, prev.length - 1));
      return;
    }
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nextHistory = [...history];
    nextHistory.pop();
    const previous = nextHistory[nextHistory.length - 1];

    if (previous) {
      ctx.putImageData(previous, 0, 0);
      setHistory(nextHistory);
    }
  };

  const handleClear = () => {
    setTextItems([]);
    setEditingTextId(null);
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

  // Stamp all interactive text items directly onto the canvas before export/download
  const stampTextItemsToCanvas = (ctx: CanvasRenderingContext2D) => {
    textItems.forEach(item => {
      ctx.save();
      ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const textMetrics = ctx.measureText(item.text);
      const paddingX = 14;
      const paddingY = 8;
      const boxWidth = textMetrics.width + paddingX * 2;
      const boxHeight = 36 + paddingY;

      // Dark pill container
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(item.x, item.y - 28, boxWidth, boxHeight, 8);
      } else {
        ctx.rect(item.x, item.y - 28, boxWidth, boxHeight);
      }
      ctx.fill();

      // Border outline
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Text label
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.x + paddingX, item.y + 2);
      ctx.restore();
    });
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx && textItems.length > 0) {
      stampTextItemsToCanvas(ctx);
    }

    try {
      const dataUrl = canvas.toDataURL('image/png', 0.95);
      onSave(dataUrl);
      onClose();
    } catch (e) {
      console.error('Error exporting canvas:', e);
      alert('Could not export screenshot due to browser security. Please try taking a snip and pressing Ctrl+V.');
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx && textItems.length > 0) {
      stampTextItemsToCanvas(ctx);
    }

    const link = document.createElement('a');
    link.download = `scrubmark_frame_${Math.floor(timestamp)}.png`;
    link.href = canvas.toDataURL('image/png', 0.95);
    link.click();
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
                Draw arrows, shapes, or double-click to edit text callouts directly on the frame
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
              title="Upload custom frame screenshot"
            >
              <Upload size={13} />
              <span>Upload Frame</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            <button
              type="button"
              onClick={handleDownload}
              title="Download high-resolution image"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <Download size={13} />
              <span>Download</span>
            </button>
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
                title="Rectangle Box"
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
                title="Circle"
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
                title="Add & Edit Text Label"
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
                disabled={history.length <= 1 && textItems.length === 0}
                title="Undo"
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1 text-xs"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Undo</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={history.length <= 1 && textItems.length === 0}
                title="Clear all drawings"
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1 text-xs"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>

          {/* Text Tool Banner */}
          {activeTool === 'text' && (
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-2 mb-2 flex items-center justify-between text-xs text-indigo-300">
              <div className="flex items-center gap-2">
                <Type size={14} />
                <span>Text Preset:</span>
                <input
                  type="text"
                  value={quickTextPreset}
                  onChange={(e) => setQuickTextPreset(e.target.value)}
                  placeholder="Type note text..."
                  className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 w-56 sm:w-72"
                />
              </div>
              <span className="text-[11px] text-neutral-400 hidden sm:inline">
                Click anywhere to place text. <strong>Double-click any text</strong> to edit!
              </span>
            </div>
          )}

          {/* Interactive Canvas Viewport with Double-Click Editable Text Layer */}
          <div ref={containerRef} className="flex-1 relative flex items-center justify-center bg-black/85 rounded-xl overflow-hidden border border-neutral-800/80 shadow-inner select-none p-2 min-h-0">
            <div
              className="relative flex items-center justify-center shadow-2xl rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950"
              style={{
                width: displayDimensions.width > 0 ? `${displayDimensions.width}px` : '100%',
                height: displayDimensions.height > 0 ? `${displayDimensions.height}px` : 'auto',
                aspectRatio: '16 / 9',
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            >
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
                className="w-full h-full block cursor-crosshair touch-none select-none"
              />

              {/* Interactive Text Annotations Layer */}
              {textItems.map(item => {
                const isEditing = editingTextId === item.id;
                const leftPct = (item.x / CANVAS_WIDTH) * 100;
                const topPct = (item.y / CANVAS_HEIGHT) * 100;

                return (
                  <div
                    key={item.id}
                    style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                    className="absolute -translate-y-1/2 z-20 group"
                    onMouseDown={(e) => handleTextDragStart(e, item.id)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingTextId(item.id);
                      setEditTextValue(item.text);
                    }}
                  >
                    {isEditing ? (
                      <div
                        className="flex items-center gap-1.5 bg-neutral-950/95 p-1 rounded-lg border-2 shadow-2xl backdrop-blur-md"
                        style={{ borderColor: item.color }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          type="text"
                          value={editTextValue}
                          onChange={e => setEditTextValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveTextEdit(item.id);
                            if (e.key === 'Escape') setEditingTextId(null);
                          }}
                          onBlur={() => handleSaveTextEdit(item.id)}
                          className="bg-transparent text-xs sm:text-sm font-bold text-white outline-none px-2 py-0.5 min-w-[160px]"
                          style={{ color: item.color }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveTextEdit(item.id)}
                          className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-2 cursor-pointer transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/85 border-2 shadow-xl cursor-grab active:cursor-grabbing select-none transition-all hover:scale-102 hover:bg-black/95"
                        style={{ borderColor: item.color }}
                        title="Double-click to edit text, drag to move"
                      >
                        <Move size={11} className="text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="text-xs sm:text-sm font-bold whitespace-nowrap" style={{ color: item.color }}>
                          {item.text}
                        </span>
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity pl-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTextId(item.id);
                              setEditTextValue(item.text);
                            }}
                            className="p-0.5 text-neutral-400 hover:text-indigo-400 transition-colors cursor-pointer"
                            title="Edit text (or double-click)"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTextItem(item.id);
                            }}
                            className="p-0.5 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete text"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoadingBackdrop && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 text-neutral-400">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-mono">Freezing HD video frame at {formatTime(timestamp)}...</span>
                </div>
              )}
            </div>
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
