import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple JSON Database since native SQLite bindings are not available in this container
const DB_FILE = 'data.json';

interface Database {
  users: any[];
  videos: any[];
  comments: any[];
}

let db: Database = { users: [], videos: [], comments: [] };

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    if (!db.users) db.users = [];
    if (!db.videos) db.videos = [];
    if (!db.comments) db.comments = [];
  } catch (e) {}
}

// Helper to hash and verify passwords using Node crypto
function hashPassword(password: string, salt?: string) {
  const userSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, userSalt, 1000, 64, 'sha512').toString('hex');
  return { salt: userSalt, hash };
}

function verifyPassword(password: string, salt: string, hash: string) {
  const calculated = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return calculated === hash;
}

// Seed default demo user if no users exist
if (db.users.length === 0) {
  const demoSaltHash = hashPassword('password123');
  db.users.push({
    id: 'demo-user-1',
    name: 'Demo Creator',
    email: 'demo@scrubmark.com',
    salt: demoSaltHash.salt,
    hash: demoSaltHash.hash,
    created_at: new Date().toISOString()
  });
}

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userName?: string;
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Basic authentication header middleware
  app.use((req, res, next) => {
    req.userId = req.headers['x-user-id'] as string;
    req.userName = req.headers['x-user-name'] as string;
    next();
  });

  // POST /api/auth/register - Create account
  app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = db.users.find(u => u.email === cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const { salt, hash } = hashPassword(password);
    const newUser = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: cleanEmail,
      salt,
      hash,
      created_at: new Date().toISOString()
    };

    db.users.push(newUser);
    saveDb();

    res.status(201).json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email
    });
  });

  // POST /api/auth/login - Log in with email & password
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.users.find(u => u.email === cleanEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = verifyPassword(password, user.salt, user.hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email
    });
  });

  // GET /api/auth/me - Verify current user session
  app.get('/api/auth/me', (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });
    const user = db.users.find(u => u.id === req.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({
      id: user.id,
      name: user.name,
      email: user.email
    });
  });

  // POST /api/videos - Ingest a new video
  app.post('/api/videos', (req, res) => {
    const { youtube_video_id, project_name } = req.body;
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const newVideo = {
      id: crypto.randomUUID(),
      youtube_video_id,
      project_name,
      user_id: req.userId,
      owner_name: req.userName,
      created_at: new Date().toISOString()
    };
    
    db.videos.push(newVideo);
    saveDb();
      
    res.json({ id: newVideo.id });
  });

  // GET /api/videos - List videos
  app.get('/api/videos', (req, res) => {
    const sorted = [...db.videos].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(sorted);
  });

  // GET /api/videos/:id - Show a single video
  app.get('/api/videos/:id', (req, res) => {
    const video = db.videos.find(v => v.id === req.params.id);
    if (!video) return res.status(404).json({ error: 'Not found' });
    res.json(video);
  });

  // GET /api/videos/:id/comments - Get timestamped comments for a video
  app.get('/api/videos/:id/comments', (req, res) => {
    const comments = db.comments
      .filter(c => c.video_id === req.params.id)
      .sort((a, b) => {
        if (a.timestamp_seconds !== b.timestamp_seconds) {
          return a.timestamp_seconds - b.timestamp_seconds;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    res.json(comments);
  });

  // POST /api/videos/:id/comments - Add a new comment at a timestamp
  app.post('/api/videos/:id/comments', (req, res) => {
    const { content, timestamp_seconds, author_name } = req.body;
    const author = req.userName || author_name || 'Client Reviewer';
    const uid = req.userId || 'reviewer_' + crypto.randomUUID().slice(0, 8);

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    const newComment = {
      id: crypto.randomUUID(),
      video_id: req.params.id,
      user_id: uid,
      author_name: author,
      content: content.trim(),
      timestamp_seconds: Number(timestamp_seconds) || 0,
      is_resolved: false,
      created_at: new Date().toISOString()
    };
    
    db.comments.push(newComment);
    saveDb();
      
    res.json(newComment);
  });

  // PATCH /api/comments/:id/resolve - Mark a comment as resolved
  app.patch('/api/comments/:id/resolve', (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const comment = db.comments.find(c => c.id === req.params.id);
    if (!comment) return res.status(404).json({ error: 'Not found' });

    const video = db.videos.find(v => v.id === comment.video_id);
    
    // Ensure only video owner can resolve comments
    if (video.user_id !== req.userId) {
      return res.status(403).json({ error: 'Only the video owner can resolve comments' });
    }

    comment.is_resolved = true;
    saveDb();
    
    res.json({ success: true });
  });

  // Vite middleware for development / Static file serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
