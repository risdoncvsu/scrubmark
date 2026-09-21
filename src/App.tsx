import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { VideoReview } from './components/VideoReview';
import type { User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('v');
    }
    return null;
  });

  // Hydrate user from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('scrubmark_user') || localStorage.getItem('frameio_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem('scrubmark_user');
      }
    }
  }, []);

  // Sync URL search params with activeVideoId and handle popstate (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveVideoId(params.get('v'));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectVideo = (videoId: string | null) => {
    setActiveVideoId(videoId);
    if (videoId) {
      const newUrl = `${window.location.pathname}?v=${videoId}`;
      window.history.pushState(null, '', newUrl);
    } else {
      window.history.pushState(null, '', window.location.pathname);
    }
  };

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('scrubmark_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    handleSelectVideo(null);
    localStorage.removeItem('scrubmark_user');
    localStorage.removeItem('frameio_user');
  };

  if (!user) {
    return <Auth onLogin={handleLogin} inviteVideoId={activeVideoId} />;
  }

  if (activeVideoId) {
    return (
      <VideoReview 
        videoId={activeVideoId} 
        user={user} 
        onBack={() => handleSelectVideo(null)} 
      />
    );
  }

  return (
    <Dashboard 
      user={user} 
      onSelectVideo={handleSelectVideo} 
      onLogout={handleLogout} 
    />
  );
}
