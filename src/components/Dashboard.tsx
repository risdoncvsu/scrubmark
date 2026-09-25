import React, { useState, useEffect } from 'react';
import type { User, Video } from '../types';
import { detectVideoSource } from '../utils';
import { Plus, Video as VideoIcon, Clock, ChevronRight, User as UserIcon, Share2, Check, Cloud, Youtube, Trash2, AlertTriangle } from 'lucide-react';

interface DashboardProps {
  user: User;
  onSelectVideo: (videoId: string) => void;
  onLogout: () => void;
}

export function Dashboard({ user, onSelectVideo, onLogout }: DashboardProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const detectedSource = videoUrl.trim() ? detectVideoSource(videoUrl) : null;

  const handleCopyShare = (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?v=${videoId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(videoId);
      setTimeout(() => setCopiedId(null), 2500);
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedId(videoId);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos', {
        headers: {
          'x-user-id': user.id,
          'x-user-name': user.name,
        }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setVideos(data);
      } else {
        setVideos([]);
      }
    } catch (e) {
      console.error(e);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideo = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    setDeletingId(videoId);
    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': user.id,
          'x-user-name': user.name,
        }
      });
      if (res.ok) {
        setVideos(prev => prev.filter(v => v.id !== videoId));
      }
    } catch (err) {
      console.error('Failed to delete video:', err);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const detected = detectVideoSource(videoUrl);
    if (!detected) {
      setError('Please provide a valid YouTube URL or Google Drive video link.');
      return;
    }

    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-name': user.name,
        },
        body: JSON.stringify({
          project_name: projectName.trim(),
          youtube_video_id: detected.id,
          source_type: detected.type
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setIsAdding(false);
        setProjectName('');
        setVideoUrl('');
        fetchVideos();
        onSelectVideo(data.id);
      } else {
        setError(data.error || 'Failed to add video');
      }
    } catch (e) {
      setError('Failed to add video. Please check your connection.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <VideoIcon size={18} />
            </div>
            <span className="font-bold text-neutral-900 text-lg">ScrubMark</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-neutral-600">
            <span className="truncate max-w-[130px] sm:max-w-none">Signed in as <strong>{user.name}</strong></span>
            <button onClick={onLogout} className="hover:text-neutral-900 underline shrink-0 cursor-pointer">Logout</button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">Your Videos</h1>
            <p className="text-xs sm:text-sm text-neutral-500">Review YouTube or Google Drive videos frame-by-frame with synchronized notes.</p>
          </div>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="self-start sm:self-auto flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={18} />
            Add Video
          </button>
        </div>

        {isAdding && (
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-neutral-200 shadow-sm mb-6 sm:mb-8 animate-in fade-in slide-in-from-top-4">
            <h2 className="text-base sm:text-lg font-bold mb-4 text-neutral-900">Add Video for Review</h2>
            <form onSubmit={handleAddVideo} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">Project Name</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-base sm:text-sm text-neutral-900"
                    placeholder="e.g. Q3 Promo v2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">Video URL (YouTube or Google Drive)</label>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => {
                      setVideoUrl(e.target.value);
                      if (error) setError('');
                    }}
                    required
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-base sm:text-sm text-neutral-900"
                    placeholder="https://youtube.com/watch?v=... or https://drive.google.com/file/d/..."
                  />

                  {/* Auto-detected source indicator */}
                  {detectedSource && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs">
                      {detectedSource.type === 'youtube' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                          <Youtube size={12} className="text-rose-600" />
                          YouTube video detected
                        </span>
                      )}
                      {detectedSource.type === 'google_drive' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                          <Cloud size={12} className="text-blue-600" />
                          Google Drive video detected
                        </span>
                      )}
                      {detectedSource.type === 'direct' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                          <VideoIcon size={12} className="text-purple-600" />
                          Direct video stream detected
                        </span>
                      )}
                    </div>
                  )}

                  <p className="mt-1.5 text-[11px] text-neutral-400">
                    For Google Drive files: ensure file sharing is set to <strong>"Anyone with the link can view"</strong>.
                  </p>
                </div>
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setError('');
                  }}
                  className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-md text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-md font-medium text-sm cursor-pointer transition-colors shadow-sm"
                >
                  Save & Start Review
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-neutral-500 text-sm">Loading projects...</div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12 sm:py-16 bg-white rounded-xl border border-neutral-200 border-dashed px-4">
            <VideoIcon size={44} className="mx-auto text-neutral-300 mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-neutral-900 mb-1">No videos yet</h3>
            <p className="text-neutral-500 text-sm">Add a YouTube or Google Drive video to start collaborating.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {videos.map(video => {
              const isDrive = video.source_type === 'google_drive' || (video.youtube_video_id && video.youtube_video_id.length > 20);

              return (
                <div
                  key={video.id}
                  onClick={() => onSelectVideo(video.id)}
                  className="bg-white border border-neutral-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer group flex flex-col"
                >
                  <div className="aspect-video bg-neutral-900 relative overflow-hidden flex items-center justify-center">
                    {isDrive ? (
                      <>
                        <img
                          src={`https://drive.google.com/thumbnail?id=${video.youtube_video_id}&sz=w640`}
                          alt={video.project_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-neutral-900 flex flex-col items-center justify-center p-4 text-center pointer-events-none -z-10">
                          <Cloud size={32} className="text-blue-400 mb-2" />
                          <span className="text-xs font-medium text-neutral-300">Google Drive Video</span>
                        </div>
                        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600/90 text-white text-[10px] font-semibold tracking-wider uppercase shadow-sm">
                          <Cloud size={10} />
                          Drive
                        </div>
                      </>
                    ) : (
                      <>
                        <img
                          src={`https://img.youtube.com/vi/${video.youtube_video_id}/mqdefault.jpg`}
                          alt={video.project_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600/90 text-white text-[10px] font-semibold tracking-wider uppercase shadow-sm">
                          <Youtube size={10} />
                          YouTube
                        </div>
                      </>
                    )}
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-neutral-900 text-base line-clamp-1">{video.project_name}</h3>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleCopyShare(e, video.id)}
                          title="Copy Client Share Link"
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-1 text-xs font-medium cursor-pointer"
                        >
                          {copiedId === video.id ? (
                            <>
                              <Check size={14} className="text-emerald-600" />
                              <span className="text-emerald-600 font-semibold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Share2 size={14} />
                              <span>Share</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(confirmDeleteId === video.id ? null : video.id);
                          }}
                          title="Delete project"
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {confirmDeleteId === video.id && (
                      <div 
                        onClick={(e) => e.stopPropagation()} 
                        className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs animate-in fade-in"
                      >
                        <p className="font-medium text-rose-900 mb-2 flex items-center gap-1">
                          <AlertTriangle size={13} className="text-rose-600 shrink-0" />
                          Delete this project and notes?
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={deletingId === video.id}
                            onClick={(e) => handleDeleteVideo(e, video.id)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium cursor-pointer transition-colors text-[11px]"
                          >
                            {deletingId === video.id ? 'Deleting...' : 'Yes, Delete'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 rounded cursor-pointer text-[11px]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center text-xs text-neutral-500 mt-auto pt-3 border-t border-neutral-100 gap-4">
                      <span className="flex items-center gap-1">
                        <UserIcon size={14} className="opacity-50" />
                        {video.owner_name}
                      </span>
                      <span className="flex items-center gap-1 ml-auto">
                        <Clock size={14} className="opacity-50" />
                        {new Date(video.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
