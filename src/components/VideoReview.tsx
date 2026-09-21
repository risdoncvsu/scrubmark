import React, { useState, useEffect, useRef } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import type { User, Video, Comment } from '../types';
import { formatTime } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, MessageSquare, CheckCircle2, Play, Pause, ChevronRight } from 'lucide-react';
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

  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        setCurrentTimestamp(playerRef.current.getCurrentTime());
      }
    }, 100);
    return () => clearInterval(interval);
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

  return (
    <div className="h-screen flex flex-col bg-neutral-900 text-white overflow-hidden">
      <header className="h-14 border-b border-neutral-800 px-4 flex items-center justify-between shrink-0 bg-neutral-950">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-neutral-400 hover:text-white transition-colors" title="Back to Projects">
            <ArrowLeft size={20} />
          </button>
          <div className="h-4 w-px bg-neutral-800" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">ScrubMark</span>
            <h1 className="font-medium text-neutral-200">{video.project_name}</h1>
          </div>
        </div>
        <div className="text-sm text-neutral-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {user.name}
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
                  controls: 0, // Hide native controls
                  rel: 0,
                  modestbranding: 1,
                  iv_load_policy: 3,
                },
              }}
              onReady={onPlayerReady}
              className="absolute inset-0 w-full h-full"
              iframeClassName="w-full h-full"
            />
          </div>
          {/* Custom Minimal Controls overlay could go here, but omitted for brevity, user uses clicks/keyboard or we can add play/pause buttons */}
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
                placeholder="Type a note... (pauses video)"
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
    </div>
  );
}
