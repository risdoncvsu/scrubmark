import React, { useState, useEffect, useRef } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import type { User, Video, Comment } from '../types';
import { formatTime, parseTimeString } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, MessageSquare, CheckCircle2, Play, Pause, ChevronRight, Share2, Copy, Check, X, Mail, Users, 
  RotateCcw, RotateCw, Cloud, Youtube, ExternalLink, Edit3, Timer, Camera, Maximize2, Download, Trash2 
} from 'lucide-react';
import clsx from 'clsx';
import { FrameAnnotationModal } from './FrameAnnotationModal';

interface VideoReviewProps {
  videoId: string;
  user: User;
  onBack: () => void;
}

export function VideoReview({ videoId, user, onBack }: VideoReviewProps) {
  const [video, setVideo] = useState<Video | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Visual annotation states
  const [isAnnotationModalOpen, setIsAnnotationModalOpen] = useState(false);
  const [attachedDrawing, setAttachedDrawing] = useState<string | null>(null);
  const [previewLightboxImage, setPreviewLightboxImage] = useState<string | null>(null);

  // Google Drive states
  const [isSyncTimerRunning, setIsSyncTimerRunning] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [timeInputStr, setTimeInputStr] = useState('0:00');
  const [jumpNotice, setJumpNotice] = useState<string | null>(null);

  const playerRef = useRef<any>(null);

  const isDrive = video ? (video.source_type === 'google_drive' || (video.youtube_video_id && video.youtube_video_id.length > 20)) : false;

  const fetchVideoData = async () => {
    try {
      const [vidRes, comRes] = await Promise.all([
        fetch(`/api/videos/${videoId}`, { headers: { 'x-user-id': user.id, 'x-user-name': user.name } }),
        fetch(`/api/videos/${videoId}/comments`, { headers: { 'x-user-id': user.id, 'x-user-name': user.name } })
      ]);
      setVideo(await vidRes.json());
      setComments(await comRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchVideoData();
  }, [videoId]);

  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
  };

  const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
    setIsPlaying(event.data === 1);
  };

  useEffect(() => {
    if (isDrive) return;
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        setCurrentTimestamp(playerRef.current.getCurrentTime());
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isDrive]);

  // Google Drive sync stopwatch tracker
  useEffect(() => {
    if (!isDrive || !isSyncTimerRunning) return;
    const interval = setInterval(() => {
      setCurrentTimestamp(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isDrive, isSyncTimerRunning]);

  const togglePlayPause = () => {
    if (isDrive) {
      setIsSyncTimerRunning(prev => !prev);
      return;
    }

    if (playerRef.current) {
      const state = typeof playerRef.current.getPlayerState === 'function' ? playerRef.current.getPlayerState() : -1;
      if (state === 1) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    }
  };

  const seekRelative = (deltaSeconds: number) => {
    if (isDrive) {
      setCurrentTimestamp(prev => Math.max(0, prev + deltaSeconds));
      return;
    }

    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      const cur = playerRef.current.getCurrentTime() || 0;
      const nextTime = Math.max(0, cur + deltaSeconds);
      playerRef.current.seekTo(nextTime, true);
      setCurrentTimestamp(nextTime);
    }
  };

  // Keyboard navigation hotkeys (Space for play/pause, Left/Right for -5s/+5s, J/L for -10s/+10s)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekRelative(5);
      } else if (e.key === 'j' || e.key === 'J') {
        seekRelative(-10);
      } else if (e.key === 'l' || e.key === 'L') {
        seekRelative(10);
      } else if (e.key === 'k' || e.key === 'K') {
        togglePlayPause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrive, isSyncTimerRunning]);

  const handleCommentFocus = () => {
    if (isDrive) {
      setIsSyncTimerRunning(false);
      return;
    }

    if (playerRef.current) {
      // Pause video and get exact timestamp
      playerRef.current.pauseVideo();
      setCurrentTimestamp(playerRef.current.getCurrentTime());
    }
  };

  const handleOpenAnnotationModal = () => {
    if (isDrive) {
      setIsSyncTimerRunning(false);
    } else if (playerRef.current) {
      if (typeof playerRef.current.pauseVideo === 'function') {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      }
      if (typeof playerRef.current.getCurrentTime === 'function') {
        const ct = playerRef.current.getCurrentTime();
        if (typeof ct === 'number') {
          setCurrentTimestamp(ct);
        }
      }
    }
    setIsAnnotationModalOpen(true);
  };

  const handleSaveAnnotation = (imageDataUrl: string) => {
    setAttachedDrawing(imageDataUrl);
    setIsAnnotationModalOpen(false);
    if (!newComment.trim()) {
      setNewComment(`See visual annotation at ${formatTime(currentTimestamp)}`);
    }
  };

  const handleTimeInputSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseTimeString(timeInputStr);
    if (parsed !== null) {
      setCurrentTimestamp(parsed);
      if (!isDrive && playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(parsed, true);
      }
    }
    setIsEditingTime(false);
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && !attachedDrawing) return;

    try {
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-name': user.name,
        },
        body: JSON.stringify({
          content: newComment.trim() || `Visual annotation at ${formatTime(currentTimestamp)}`,
          timestamp_seconds: currentTimestamp,
          drawing_data: attachedDrawing || undefined,
        })
      });
      
      const addedComment = await res.json();
      setComments(prev => [...prev, addedComment].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
      setNewComment('');
      setAttachedDrawing(null);
    } catch (e) {
      console.error(e);
    }
  };

  const resolveComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/comments/${commentId}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-name': user.name,
        }
      });
      
      if (res.ok) {
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_resolved: true } : c));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to resolve comment');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const jumpToTime = (seconds: number) => {
    setCurrentTimestamp(seconds);
    if (isDrive) {
      setJumpNotice(`📌 Note at ${formatTime(seconds)} — scrub Drive player timeline to ${formatTime(seconds)}`);
      setTimeout(() => setJumpNotice(null), 4000);
    } else if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(seconds, true);
      playerRef.current.playVideo();
    }
  };

  if (!video) return <div className="p-8 text-center text-neutral-500">Loading video workspace...</div>;

  const activeComments = comments.filter(c => !c.is_resolved);
  const resolvedComments = comments.filter(c => c.is_resolved);
  const isOwner = video.user_id === user.id;

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?v=${videoId}`
    : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-neutral-900 text-white overflow-hidden relative">
      <header className="h-13 sm:h-14 border-b border-neutral-800 px-3 sm:px-4 flex items-center justify-between shrink-0 bg-neutral-950">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <button onClick={onBack} className="p-1.5 -ml-1 text-neutral-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-neutral-800 shrink-0" title="Back to Projects">
            <ArrowLeft size={18} />
          </button>
          <div className="h-4 w-px bg-neutral-800 shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            {isDrive ? (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 shrink-0">
                <Cloud size={12} /> Google Drive
              </span>
            ) : (
              <span className="hidden sm:inline-flex text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 shrink-0">
                ScrubMark
              </span>
            )}
            <h1 className="font-medium text-neutral-200 text-sm sm:text-base truncate max-w-[130px] xs:max-w-[180px] sm:max-w-xs md:max-w-md">
              {video.project_name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isDrive && (
            <a
              href={`https://drive.google.com/file/d/${video.youtube_video_id}/view`}
              target="_blank"
              rel="noreferrer"
              title="Open directly in Google Drive"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium transition-colors"
            >
              <ExternalLink size={13} />
              <span>Drive Link</span>
            </a>
          )}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition-all shadow-sm shadow-indigo-600/30 cursor-pointer"
          >
            <Share2 size={14} />
            <span className="hidden xs:inline">Share</span>
          </button>
          <div className="h-4 w-px bg-neutral-800 hidden xs:block" />
          <div className="text-xs text-neutral-400 flex items-center gap-1.5">
            <span className={clsx("w-2 h-2 rounded-full shrink-0", isOwner ? "bg-indigo-500" : "bg-emerald-500")} />
            <span className="text-neutral-200 font-medium truncate max-w-[75px] sm:max-w-[120px]">{user.name}</span>
            <span className="hidden md:inline-flex text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/50">
              {isOwner ? 'Owner' : 'Client Reviewer'}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Main Video Area */}
        <div className="w-full md:flex-1 flex flex-col shrink-0 md:shrink relative bg-black">
          <div className="w-full aspect-video md:aspect-auto md:flex-1 relative bg-black max-h-[38vh] sm:max-h-[44vh] md:max-h-none">
            {isDrive ? (
              <iframe
                src={`https://drive.google.com/file/d/${video.youtube_video_id}/preview`}
                className="absolute inset-0 w-full h-full border-0"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                title={video.project_name}
              />
            ) : (
              <YouTube
                videoId={video.youtube_video_id}
                opts={{
                  width: '100%',
                  height: '100%',
                  playerVars: {
                    controls: 1, // Full native YouTube controls: scrubber timeline, volume/sound slider, quality settings gear, playback speed
                    rel: 0,
                    modestbranding: 1,
                    iv_load_policy: 3,
                    playsinline: 1, // Crucial for inline playback on iOS mobile browsers
                  },
                }}
                onReady={onPlayerReady}
                onStateChange={onPlayerStateChange}
                className="absolute inset-0 w-full h-full"
                iframeClassName="w-full h-full"
              />
            )}

            {/* Jump Notice Overlay for Google Drive */}
            {jumpNotice && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-neutral-900/95 text-indigo-300 border border-indigo-500/40 px-3.5 py-1.5 rounded-lg text-xs font-mono shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
                <span>{jumpNotice}</span>
              </div>
            )}
          </div>
          {/* Quick Reviewer Control Bar */}
          <div className="h-11 sm:h-12 bg-neutral-950/95 border-y md:border-b-0 md:border-t border-neutral-800 px-3 sm:px-4 flex items-center justify-between shrink-0 text-xs text-neutral-300">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {isDrive ? (
                <>
                  <button
                    type="button"
                    onClick={togglePlayPause}
                    title="Toggle Note Time Tracker"
                    className={clsx(
                      "px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium",
                      isSyncTimerRunning
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-neutral-800 hover:bg-neutral-700 text-white"
                    )}
                  >
                    <Timer size={14} />
                    <span>{isSyncTimerRunning ? 'Stop Tracker' : 'Start Tracker'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => seekRelative(-5)}
                    title="Rewind 5s"
                    className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-mono text-xs"
                  >
                    <RotateCcw size={13} />
                    <span>-5s</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => seekRelative(5)}
                    title="Forward 5s"
                    className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-mono text-xs"
                  >
                    <RotateCw size={13} />
                    <span>+5s</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={togglePlayPause}
                    title="Play / Pause (Space)"
                    className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => seekRelative(-5)}
                    title="Rewind 5s (← / J)"
                    className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-mono text-xs"
                  >
                    <RotateCcw size={13} />
                    <span>-5s</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => seekRelative(5)}
                    title="Forward 5s (→ / L)"
                    className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-mono text-xs"
                  >
                    <RotateCw size={13} />
                    <span>+5s</span>
                  </button>
                </>
              )}

              {/* Editable or clickable timestamp indicator */}
              {isEditingTime ? (
                <form onSubmit={handleTimeInputSubmit} className="flex items-center gap-1 ml-1">
                  <input
                    type="text"
                    autoFocus
                    value={timeInputStr}
                    onChange={(e) => setTimeInputStr(e.target.value)}
                    onBlur={() => handleTimeInputSubmit()}
                    placeholder="1:25"
                    className="w-16 px-1.5 py-0.5 rounded bg-neutral-800 border border-indigo-500 font-mono text-xs text-white outline-none"
                  />
                  <button type="submit" className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold px-1 cursor-pointer">Set</button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTimeInputStr(formatTime(currentTimestamp));
                    setIsEditingTime(true);
                  }}
                  title="Click to edit timestamp manually"
                  className="group flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-indigo-300 font-mono text-xs ml-1 font-medium cursor-pointer transition-colors"
                >
                  <span>{formatTime(currentTimestamp)}</span>
                  <Edit3 size={11} className="opacity-0 group-hover:opacity-75" />
                </button>
              )}

              <div className="h-4 w-px bg-neutral-800 mx-0.5 sm:mx-1" />

              {/* Freeze & Annotate Frame Button */}
              <button
                type="button"
                onClick={handleOpenAnnotationModal}
                title="Freeze frame and draw visual annotation"
                className="px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 hover:border-red-500/60 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Camera size={13} className="text-red-400" />
                <span>Annotate Frame</span>
              </button>
            </div>
            <div className="hidden md:flex items-center gap-3 text-neutral-500 text-[11px]">
              {isDrive ? (
                <span className="flex items-center gap-1 text-neutral-400">
                  <Cloud size={13} className="text-blue-400" />
                  Google Drive Player • Use native controls or tracker
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px] border border-neutral-700">Space</kbd> Play/Pause
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px] border border-neutral-700">←</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px] border border-neutral-700">→</kbd> Scrub 5s
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full md:w-96 bg-neutral-900 md:border-l border-neutral-800 flex flex-col flex-1 md:flex-initial min-h-0 overflow-hidden">
          <div className="px-4 py-2.5 sm:py-3 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between shrink-0">
            <h2 className="font-medium flex items-center gap-2 text-xs sm:text-sm">
              <MessageSquare size={15} />
              Review Notes
            </h2>
            <span className="text-xs font-mono text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
              {activeComments.length}
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
            <div>
              <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2.5 px-1">
                Active Notes ({activeComments.length})
              </h3>
              <div className="space-y-2">
                <AnimatePresence>
                  {activeComments.length === 0 && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs sm:text-sm text-neutral-500 italic px-1">No active notes.</motion.p>
                  )}
                  {activeComments.map(comment => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={comment.id}
                      onClick={() => jumpToTime(comment.timestamp_seconds)}
                      className="group bg-neutral-800/50 hover:bg-neutral-800 p-3 rounded-lg border border-neutral-700/50 cursor-pointer transition-colors active:bg-neutral-800"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs font-mono font-medium">
                            {formatTime(comment.timestamp_seconds)}
                          </span>
                          <span className="text-xs font-medium text-neutral-300">{comment.author_name}</span>
                        </div>
                        {isOwner && (
                          <button
                            onClick={(e) => { e.stopPropagation(); resolveComment(comment.id); }}
                            className="p-1 -m-1 text-neutral-500 hover:text-green-400 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                            title="Resolve Note"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-neutral-200">{comment.content}</p>
                      {comment.drawing_data && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewLightboxImage(comment.drawing_data!);
                          }}
                          className="mt-2 rounded-lg overflow-hidden border border-neutral-700/80 bg-black group/thumb cursor-zoom-in relative max-w-full transition-transform hover:border-red-500/50 shadow-sm"
                          title="Click to inspect frame annotation in high resolution"
                        >
                          <div className="aspect-video w-full relative">
                            <img 
                              src={comment.drawing_data} 
                              alt={`Annotation at ${formatTime(comment.timestamp_seconds)}`}
                              className="w-full h-full object-cover group-hover/thumb:scale-102 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between p-1.5">
                              <span className="text-[10px] font-mono text-red-300 font-semibold flex items-center gap-1 bg-black/70 px-1.5 py-0.5 rounded backdrop-blur-xs border border-red-500/30">
                                <Camera size={10} />
                                {formatTime(comment.timestamp_seconds)}
                              </span>
                              <span className="text-[10px] text-white font-medium flex items-center gap-1 bg-neutral-900/80 px-1.5 py-0.5 rounded backdrop-blur-xs border border-neutral-700">
                                <Maximize2 size={10} />
                                Inspect
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {resolvedComments.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-2.5 px-1 flex items-center gap-1.5">
                  <CheckCircle2 size={12} />
                  Resolved ({resolvedComments.length})
                </h3>
                <div className="space-y-2">
                  <AnimatePresence>
                    {resolvedComments.map(comment => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        key={comment.id}
                        onClick={() => jumpToTime(comment.timestamp_seconds)}
                        className="bg-neutral-900 p-3 rounded-lg border border-neutral-800 cursor-pointer opacity-50 hover:opacity-75 transition-opacity active:opacity-90"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-xs font-mono font-medium">
                            {formatTime(comment.timestamp_seconds)}
                          </span>
                          <span className="text-xs font-medium text-neutral-500 line-through">{comment.author_name}</span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-400 line-through">{comment.content}</p>
                        {comment.drawing_data && (
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewLightboxImage(comment.drawing_data!);
                            }}
                            className="mt-2 rounded-lg overflow-hidden border border-neutral-800 bg-black group/thumb cursor-zoom-in relative max-w-full opacity-70 hover:opacity-100 transition-opacity"
                            title="Click to inspect frame annotation in high resolution"
                          >
                            <div className="aspect-video w-full relative">
                              <img 
                                src={comment.drawing_data} 
                                alt={`Annotation at ${formatTime(comment.timestamp_seconds)}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 sm:p-4 border-t border-neutral-800 bg-neutral-950 shrink-0">
            <form onSubmit={submitComment} className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-neutral-500">At:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTimeInputStr(formatTime(currentTimestamp));
                        setIsEditingTime(true);
                      }}
                      title="Click to edit timestamp"
                      className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-xs font-mono font-medium hover:bg-indigo-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>{formatTime(currentTimestamp)}</span>
                      <Edit3 size={10} className="opacity-70" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAnnotationModal}
                    title="Freeze frame and draw visual feedback"
                    className="px-2 py-0.5 rounded bg-red-600/15 hover:bg-red-600/25 text-red-300 border border-red-500/30 text-xs flex items-center gap-1 font-medium transition-colors cursor-pointer"
                  >
                    <Camera size={11} className="text-red-400" />
                    <span>Draw on Frame</span>
                  </button>
                </div>
                <span className="text-[11px] text-neutral-500">
                  As: <strong className="text-neutral-300 font-medium">{user.name}</strong>
                </span>
              </div>

              {/* Attached Annotation Preview in Comment Box */}
              {attachedDrawing && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-900 border border-red-500/40 animate-in fade-in slide-in-from-bottom-1">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div 
                      onClick={() => setPreviewLightboxImage(attachedDrawing)}
                      className="w-14 h-9 rounded-md bg-black border border-neutral-700 overflow-hidden shrink-0 cursor-pointer relative group"
                      title="Click to preview annotation"
                    >
                      <img src={attachedDrawing} alt="Annotated frame" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Maximize2 size={12} className="text-white" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-red-400 flex items-center gap-1">
                          <Camera size={12} />
                          Frame Attached
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-[10px] font-mono text-neutral-300">
                          {formatTime(currentTimestamp)}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate">Visual drawing will be attached to note</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsAnnotationModalOpen(true)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttachedDrawing(null)}
                      className="p-1 text-neutral-400 hover:text-red-400 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="Remove attached frame"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onFocus={handleCommentFocus}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (newComment.trim() || attachedDrawing) {
                      submitComment(e);
                    }
                  }
                }}
                placeholder={isDrive ? "Type a note at this timestamp... (Enter to post)" : "Type a note... (pauses video, Enter to post)"}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 sm:p-3 text-base sm:text-sm text-white placeholder:text-neutral-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                rows={2}
              />
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[11px] text-neutral-500 hidden sm:inline">Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px] border border-neutral-700">Enter</kbd> to post</span>
                <span className="text-[11px] text-neutral-500 sm:hidden">Tap Post Note</span>
                <button
                  type="submit"
                  disabled={!newComment.trim() && !attachedDrawing}
                  className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer ml-auto"
                >
                  Post Note
                  <ChevronRight size={14} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Share Modal Dialog */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative"
            >
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Users size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Share Review Link</h2>
                  <p className="text-xs text-neutral-400">Send this link to clients or directors to collect feedback</p>
                </div>
              </div>

              <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 mb-5">
                <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Direct Client Review URL</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-3 py-2 text-xs text-neutral-200 select-all font-mono outline-none"
                  />
                  <button
                    onClick={copyLink}
                    className={clsx(
                      "shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-sm",
                      copied ? "bg-emerald-600 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
                    )}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 mb-6 text-xs text-neutral-300 bg-neutral-950/50 p-3.5 rounded-xl border border-neutral-800/60">
                <div className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <span><strong>Frictionless Client Review:</strong> When clients open this link, they can instantly watch the video, scrub the timeline, and leave timestamped comments without registering a password.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                  <span><strong>Resolution Control:</strong> Only you as the project owner can mark review comments as resolved.</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-neutral-800 text-xs">
                <a
                  href={`mailto:?subject=${encodeURIComponent(`Review Video: ${video.project_name}`)}&body=${encodeURIComponent(`Hi,\n\nPlease review the latest video cut for "${video.project_name}" and leave your timestamped notes here:\n\n${shareUrl}\n\nThanks!`)}`}
                  className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 hover:underline"
                >
                  <Mail size={14} />
                  <span>Send Invite via Email</span>
                </a>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Screenshot & Frame Annotation Modal */}
      <FrameAnnotationModal
        isOpen={isAnnotationModalOpen}
        onClose={() => setIsAnnotationModalOpen(false)}
        onSave={handleSaveAnnotation}
        timestamp={currentTimestamp}
        video={video}
      />

      {/* High-Resolution Frame Annotation Lightbox */}
      <AnimatePresence>
        {previewLightboxImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-5xl w-full flex flex-col shadow-2xl overflow-hidden relative max-h-[92vh]"
            >
              <div className="h-12 bg-neutral-950 border-b border-neutral-800 px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Camera size={15} className="text-red-400" />
                  <span className="text-sm font-semibold text-white">Annotated Frame Inspection</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewLightboxImage}
                    download={`scrubmark_frame_${Math.floor(Date.now() / 1000)}.png`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                    title="Download annotated image"
                  >
                    <Download size={13} />
                    <span className="hidden sm:inline">Download</span>
                  </a>
                  <button
                    onClick={() => setPreviewLightboxImage(null)}
                    className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="p-3 sm:p-5 flex-1 flex items-center justify-center bg-black/80 overflow-auto min-h-0">
                <img
                  src={previewLightboxImage}
                  alt="High-resolution annotated frame"
                  className="max-w-full max-h-[76vh] object-contain rounded-lg shadow-2xl border border-neutral-800"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
