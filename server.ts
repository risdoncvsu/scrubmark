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

  app.use(express.json({ limit: '10mb' }));

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
    const { youtube_video_id, project_name, source_type } = req.body;
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!youtube_video_id || !project_name) {
      return res.status(400).json({ error: 'Video ID and project name are required' });
    }
    
    // Auto-detect source_type if not provided
    const resolvedSourceType = source_type || 
      (youtube_video_id.length > 20 ? 'google_drive' : 'youtube');

    const newVideo = {
      id: crypto.randomUUID(),
      youtube_video_id,
      source_type: resolvedSourceType,
      project_name: project_name.trim(),
      user_id: req.userId,
      owner_name: req.userName,
      created_at: new Date().toISOString()
    };
    
    db.videos.push(newVideo);
    saveDb();
      
    res.json({ id: newVideo.id });
  });

  // GET /api/videos - List videos belonging exclusively to the authenticated user
  app.get('/api/videos', (req, res) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized: User authentication required' });
    }
    const userVideos = db.videos
      .filter(v => v.user_id === req.userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(userVideos);
  });

  // DELETE /api/videos/:id - Delete a video project (owner only)
  app.delete('/api/videos/:id', (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    const index = db.videos.findIndex(v => v.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Video not found' });
    
    // Ensure only the owner can delete the video
    if (db.videos[index].user_id !== req.userId) {
      return res.status(403).json({ error: 'Only the video owner can delete this project' });
    }

    db.videos.splice(index, 1);
    db.comments = db.comments.filter(c => c.video_id !== req.params.id);
    saveDb();

    res.json({ success: true });
  });

  // GET /api/videos/:id - Show a single video
  app.get('/api/videos/:id', (req, res) => {
    const video = db.videos.find(v => v.id === req.params.id);
    if (!video) return res.status(404).json({ error: 'Not found' });
    res.json(video);
  });

  // GET /api/proxy-thumbnail - Safe CORS proxy for high-resolution video frame backdrop snapshots
  app.get('/api/proxy-thumbnail', async (req, res) => {
    const { id, type } = req.query as { id?: string; type?: string };
    if (!id) return res.status(400).send('Missing id parameter');

    try {
      if (type === 'google_drive') {
        const driveUrls = [
          `https://drive.google.com/thumbnail?id=${id}&sz=w1920`,
          `https://lh3.googleusercontent.com/d/${id}=w1920`,
          `https://lh3.googleusercontent.com/d/${id}=s1920`
        ];

        for (const targetUrl of driveUrls) {
          try {
            const response = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              },
              redirect: 'follow'
            });
            if (response.ok) {
              const contentType = response.headers.get('content-type') || '';
              if (!contentType.includes('text/html')) {
                const buffer = await response.arrayBuffer();
                if (buffer.byteLength > 1000) {
                  res.set('Content-Type', contentType || 'image/jpeg');
                  res.set('Cache-Control', 'public, max-age=86400');
                  res.set('Access-Control-Allow-Origin', '*');
                  return res.send(Buffer.from(buffer));
                }
              }
            }
          } catch {}
        }
      }

      // For YouTube, prioritize true 16:9 Full HD maxresdefault -> sddefault -> hqdefault
      const ytCandidates = [
        `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
        `https://img.youtube.com/vi/${id}/sddefault.jpg`,
        `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      ];

      for (const targetUrl of ytCandidates) {
        try {
          const response = await fetch(targetUrl, { redirect: 'follow' });
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            // Filter out 120x90 404 placeholder gifs YouTube sometimes returns (under 1500 bytes)
            if (buffer.byteLength > 1500 || targetUrl.includes('hqdefault')) {
              res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
              res.set('Cache-Control', 'public, max-age=86400');
              res.set('Access-Control-Allow-Origin', '*');
              return res.send(Buffer.from(buffer));
            }
          }
        } catch {
          // try next candidate
        }
      }

      res.status(404).send('Failed to fetch thumbnail');
    } catch (e) {
      console.error('Thumbnail proxy error:', e);
      res.status(500).send('Failed to proxy thumbnail');
    }
  });

  // GET /api/drive-stream/:id - Stream Google Drive video files with HTTP byte-range support for HTML5 video player
  app.get('/api/drive-stream/:id', async (req, res) => {
    const fileId = req.params.id;
    if (!fileId) return res.status(400).send('Missing file id');

    try {
      const candidates = [
        `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
        `https://drive.google.com/uc?id=${fileId}&export=download`,
      ];

      for (const candidate of candidates) {
        try {
          const fetchHeaders: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          };
          if (req.headers.range) {
            fetchHeaders['Range'] = req.headers.range;
          }

          let response = await fetch(candidate, {
            headers: fetchHeaders,
            redirect: 'follow',
          });

          let contentType = response.headers.get('content-type') || '';

          // If Google Drive returns HTML, it is likely the virus scan warning for files >25MB
          if (response.ok && contentType.includes('text/html')) {
            const htmlText = await response.text();
            // Look for confirm token or download link in Google's warning page
            const confirmMatch = htmlText.match(/name="confirm"\s+value="([^"]+)"/) || htmlText.match(/confirm=([a-zA-Z0-9_-]+)/);
            const uuidMatch = htmlText.match(/name="uuid"\s+value="([^"]+)"/) || htmlText.match(/uuid=([a-zA-Z0-9_-]+)/);
            
            const cookies = response.headers.get('set-cookie');
            if (cookies) {
              fetchHeaders['Cookie'] = cookies.split(';')[0];
            }

            const confirmToken = confirmMatch ? confirmMatch[1] : 't';
            const uuidParam = uuidMatch ? `&uuid=${encodeURIComponent(uuidMatch[1])}` : '';
            const confirmedUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${encodeURIComponent(confirmToken)}${uuidParam}`;

            response = await fetch(confirmedUrl, {
              headers: fetchHeaders,
              redirect: 'follow',
            });
            contentType = response.headers.get('content-type') || '';
          }

          if (response.ok && !contentType.includes('text/html')) {
            res.status(response.status);
            res.set('Content-Type', contentType.startsWith('video/') ? contentType : 'video/mp4');
            res.set('Accept-Ranges', 'bytes');
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
            
            const contentRange = response.headers.get('content-range');
            if (contentRange) res.set('Content-Range', contentRange);
            const contentLength = response.headers.get('content-length');
            if (contentLength) res.set('Content-Length', contentLength);

            if (response.body) {
              const { Readable } = await import('stream');
              // @ts-ignore
              Readable.fromWeb(response.body).pipe(res);
              return;
            }
          }
        } catch (streamErr) {
          console.warn('Candidate stream attempt failed:', streamErr);
        }
      }

      res.status(404).send('Cannot stream Drive video directly');
    } catch (e) {
      console.error('Drive stream error:', e);
      res.status(500).send('Stream proxy failure');
    }
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
    const { content, timestamp_seconds, author_name, drawing_data } = req.body;
    const author = req.userName || author_name || 'Client Reviewer';
    const uid = req.userId || 'reviewer_' + crypto.randomUUID().slice(0, 8);

    const textContent = content ? content.trim() : (drawing_data ? 'Visual frame annotation' : '');
    if (!textContent && !drawing_data) {
      return res.status(400).json({ error: 'Comment content or visual annotation is required' });
    }
    
    const newComment = {
      id: crypto.randomUUID(),
      video_id: req.params.id,
      user_id: uid,
      author_name: author,
      content: textContent,
      timestamp_seconds: Number(timestamp_seconds) || 0,
      drawing_data: drawing_data || null,
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
    if (!video || video.user_id !== req.userId) {
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
