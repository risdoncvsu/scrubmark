import React, { useState, useEffect } from 'react';
import type { User, Video } from '../types';
import { extractYouTubeID } from '../utils';
import { Plus, Video as VideoIcon, Clock, ChevronRight, User as UserIcon } from 'lucide-react';

interface DashboardProps {
  user: User;
  onSelectVideo: (videoId: string) => void;
  onLogout: () => void;
}

export function Dashboard({ user, onSelectVideo, onLogout }: DashboardProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos', {
        headers: {
          'x-user-id': user.id,
          'x-user-name': user.name,
        }
      });
      const data = await res.json();
      setVideos(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const youtubeId = extractYouTubeID(youtubeUrl);
    if (!youtubeId) {
      setError('Invalid YouTube URL');
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
          project_name: projectName,
          youtube_video_id: youtubeId,
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setIsAdding(false);
        setProjectName('');
        setYoutubeUrl('');
        fetchVideos();
        onSelectVideo(data.id);
      }
    } catch (e) {
      setError('Failed to add video');
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
          <div className="flex items-center gap-4 text-sm text-neutral-600">
            <span>Signed in as <strong>{user.name}</strong></span>
            <button onClick={onLogout} className="hover:text-neutral-900 underline">Logout</button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-neutral-900">Your Videos</h1>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={18} />
            Add Video
          </button>
        </div>

        {isAdding && (
          <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm mb-8 animate-in fade-in slide-in-from-top-4">
            <h2 className="text-lg font-bold mb-4">Add new YouTube Video</h2>
            <form onSubmit={handleAddVideo} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Project Name</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. Q3 Marketing Promo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">YouTube URL</label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="https://youtube.com/watch?v=..."
                  />
                </div>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 font-medium"
                >
                  Save & Start Review
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-neutral-500">Loading projects...</div>
        ) : videos.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-neutral-200 border-dashed">
            <VideoIcon size={48} className="mx-auto text-neutral-300 mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-1">No videos yet</h3>
            <p className="text-neutral-500">Add a YouTube video to start collaborating.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map(video => (
              <div
                key={video.id}
                onClick={() => onSelectVideo(video.id)}
                className="bg-white border border-neutral-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer group flex flex-col"
              >
                <div className="aspect-video bg-neutral-100 relative">
                  <img
                    src={`https://img.youtube.com/vi/${video.youtube_video_id}/mqdefault.jpg`}
                    alt={video.project_name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-neutral-900 mb-1">{video.project_name}</h3>
                  <div className="flex items-center text-xs text-neutral-500 mt-auto pt-4 gap-4">
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
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
