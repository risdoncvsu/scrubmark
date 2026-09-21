import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { VideoReview } from './components/VideoReview';
import type { User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

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

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('scrubmark_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    setActiveVideoId(null);
    localStorage.removeItem('scrubmark_user');
    localStorage.removeItem('frameio_user');
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  if (activeVideoId) {
    return (
      <VideoReview 
        videoId={activeVideoId} 
        user={user} 
        onBack={() => setActiveVideoId(null)} 
      />
    );
  }

  return (
    <Dashboard 
      user={user} 
      onSelectVideo={setActiveVideoId} 
      onLogout={handleLogout} 
    />
  );
}
