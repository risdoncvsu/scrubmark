import React, { useState, useEffect, useRef } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import type { User, Video, Comment } from '../types';
import { formatTime } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, MessageSquare, CheckCircle2, Play, Pause, ChevronRight, Share2, Copy, Check, X, Mail, Users, RotateCcw, RotateCw } from 'lucide-react';
import clsx from 'clsx';

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
  
  const playerRef = useRef<any>(null);

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
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        setCurrentTimestamp(playerRef.current.getCurrentTime());
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const togglePlayPause = () => {
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
  }, []);

  const handleCommentFocus = () => {
    if (playerRef.current) {
      // Pause video and get exact timestamp
      playerRef.current.pauseVideo();
      setCurrentTimestamp(playerRef.current.getCurrentTime());
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-name': user.name,
        },
        body: JSON.stringify({
          content: newComment,
          timestamp_seconds: currentTimestamp,
        })
      });
      
      const addedComment = await res.json();
      setComments(prev => [...prev, addedComment].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
      setNewComment('');
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
    if (playerRef.current) {
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
    <div className="h-screen flex flex-col bg-neutral-900 text-white overflow-hidden relative">
      <header className="h-14 border-b border-neutral-800 px-4 flex items-center justify-between shrink-0 bg-neutral-950">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-neutral-400 hover:text-white transition-colors cursor-pointer" title="Back to Projects">
            <ArrowLeft size={20} />
          </button>
          <div className="h-4 w-px bg-neutral-800" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">ScrubMark</span>
            <h1 className="font-medium text-neutral-200">{video.project_name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition-all shadow-sm shadow-indigo-600/30 cursor-pointer"
          >
            <Share2 size={14} />
            <span>Share Link</span>
          </button>
          <div className="h-4 w-px bg-neutral-800" />
          <div className="text-xs text-neutral-400 flex items-center gap-1.5">
            <span className={clsx("w-2 h-2 rounded-full", isOwner ? "bg-indigo-500" : "bg-emerald-500")} />
            <span className="text-neutral-200 font-medium">{user.name}</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/50">
              {isOwner ? 'Owner' : 'Client Reviewer'}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Video Area */}
        <div className="flex-1 flex flex-col relative bg-black">
          <div className="flex-1 relative">
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
                },
              }}
              onReady={onPlayerReady}
              onStateChange={onPlayerStateChange}
              className="absolute inset-0 w-full h-full"
              iframeClassName="w-full h-full"
            />
          </div>
          {/* Quick Reviewer Control Bar */}
          <div className="h-12 bg-neutral-950/95 border-t border-neutral-800 px-4 flex items-center justify-between shrink-0 text-xs text-neutral-300">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlayPause}
                title="Play / Pause (Space)"
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>
              <button
                type="button"
                onClick={() => seekRelative(-5)}
                title="Rewind 5s (← / J)"
                className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-mono"
              >
                <RotateCcw size={13} />
                <span>-5s</span>
              </button>
              <button
                type="button"
                onClick={() => seekRelative(5)}
                title="Forward 5s (→ / L)"
                className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-mono"
              >
                <RotateCw size={13} />
                <span>+5s</span>
              </button>
              <span className="text-neutral-400 font-mono text-xs ml-2">
                {formatTime(currentTimestamp)}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-neutral-500 text-[11px]">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px] border border-neutral-700">Space</kbd> Play/Pause
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px] border border-neutral-700">←</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px] border border-neutral-700">→</kbd> Scrub 5s
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-96 bg-neutral-900 border-l border-neutral-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-neutral-800 bg-neutral-950">
            <h2 className="font-medium flex items-center gap-2">
              <MessageSquare size={16} />
              Review Notes
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 px-1">Active Notes ({activeComments.length})</h3>
              <div className="space-y-2">
                <AnimatePresence>
                  {activeComments.length === 0 && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-neutral-500 italic px-1">No active notes.</motion.p>
                  )}
                  {activeComments.map(comment => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={comment.id}
                      onClick={() => jumpToTime(comment.timestamp_seconds)}
                      className="group bg-neutral-800/50 hover:bg-neutral-800 p-3 rounded-lg border border-neutral-700/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs font-mono font-medium">
                            {formatTime(comment.timestamp_seconds)}
                          </span>
                          <span className="text-xs font-medium text-neutral-300">{comment.author_name}</span>
                        </div>
                        {isOwner && (
                          <button
                            onClick={(e) => { e.stopPropagation(); resolveComment(comment.id); }}
                            className="text-neutral-500 hover:text-green-400 opacity-0 group-hover:opacity-100 transition-all"
                            title="Resolve Note"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-neutral-200">{comment.content}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {resolvedComments.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
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
                        className="bg-neutral-900 p-3 rounded-lg border border-neutral-800 cursor-pointer opacity-50 hover:opacity-75 transition-opacity"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-xs font-mono font-medium">
                            {formatTime(comment.timestamp_seconds)}
                          </span>
                          <span className="text-xs font-medium text-neutral-500 line-through">{comment.author_name}</span>
                        </div>
                        <p className="text-sm text-neutral-400 line-through">{comment.content}</p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-neutral-800 bg-neutral-950">
            <form onSubmit={submitComment} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-neutral-500">Leaving note at:</span>
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-xs font-mono font-medium">
                  {formatTime(currentTimestamp)}
                </span>
              </div>
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onFocus={handleCommentFocus}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (newComment.trim()) {
                      submitComment(e);
                    }
                  }
                }}
                placeholder="Type a note... (pauses video, Enter to post)"
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                rows={3}
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="self-end bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Post Note
                <ChevronRight size={16} />
              </button>
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
    </div>
  );
}
