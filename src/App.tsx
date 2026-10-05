import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { VideoReview } from './components/VideoReview';
import { DemoPage } from './components/DemoPage';
import type { User } from './types';
import { detectVideoSource } from './utils';

function checkIsDemoPath(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.toLowerCase();

  return (
    path === '/demo' ||
    path === '/tour' ||
    path === '/walkthrough' ||
    params.get('page') === 'demo' ||
    params.get('tour') === 'true' ||
    params.get('demo') === 'true' ||
    hash === '#demo' ||
    hash === '#tour'
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('v');
    }
    return null;
  });

  // Dedicated demo page route state
  const [isDemoPage, setIsDemoPage] = useState<boolean>(() => checkIsDemoPath());

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

  // Sync URL search params with activeVideoId and demo route on popstate (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveVideoId(params.get('v'));
      setIsDemoPage(checkIsDemoPath());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenDemo = () => {
    window.history.pushState(null, '', '/demo');
    setIsDemoPage(true);
  };

  const handleExitDemo = () => {
    if (activeVideoId) {
      window.history.pushState(null, '', `/?v=${activeVideoId}`);
    } else {
      window.history.pushState(null, '', '/');
    }
    setIsDemoPage(false);
  };

  const handleSelectVideo = (videoId: string | null) => {
    setActiveVideoId(videoId);
    if (videoId) {
      const newUrl = `/?v=${videoId}`;
      window.history.pushState(null, '', newUrl);
    } else {
      window.history.pushState(null, '', '/');
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

  const handleAutoAddVideo = async (projectName: string, videoUrl: string) => {
    let currentUser = user;
    if (!currentUser) {
      currentUser = {
        id: 'tester_' + crypto.randomUUID().slice(0, 8),
        name: 'Research Tester',
        email: 'tester@scrubmark.com'
      };
      handleLogin(currentUser);
    }

    const detected = detectVideoSource(videoUrl);
    if (!detected) return;

    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-user-name': currentUser.name
        },
        body: JSON.stringify({
          project_name: projectName,
          youtube_video_id: detected.id,
          source_type: detected.type
        })
      });

      if (res.ok) {
        const data = await res.json();
        return data.id;
      }
    } catch (e) {
      console.error('Failed to auto-add video:', e);
    }
  };

  // Dedicated Standalone Demo Page
  if (isDemoPage) {
    return (
      <DemoPage
        onExit={handleExitDemo}
        onAutoAddVideo={handleAutoAddVideo}
        onSelectVideo={(vidId) => {
          handleSelectVideo(vidId);
          setIsDemoPage(false);
        }}
      />
    );
  }

  return (
    <>
      {!user ? (
        <Auth 
          onLogin={handleLogin} 
          inviteVideoId={activeVideoId} 
          onOpenTour={handleOpenDemo}
        />
      ) : activeVideoId ? (
        <VideoReview 
          videoId={activeVideoId} 
          user={user} 
          onBack={() => handleSelectVideo(null)} 
          onOpenTour={handleOpenDemo}
        />
      ) : (
        <Dashboard 
          user={user} 
          onSelectVideo={handleSelectVideo} 
          onLogout={handleLogout} 
          onOpenTour={handleOpenDemo}
        />
      )}
    </>
  );
}


