export function extractYouTubeID(url: string): string | null {
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

export function extractDriveFileId(url: string): string | null {
  const clean = url.trim();
  // Standard /file/d/{id} or /d/{id}
  const matchD = clean.match(/(?:drive|docs)\.google\.com\/(?:file\/d\/|d\/|uc\?id=|open\?id=)([a-zA-Z0-9_-]{20,})/i);
  if (matchD) return matchD[1];

  // Query param id={id}
  const matchQuery = clean.match(/[?&]id=([a-zA-Z0-9_-]{20,})/i);
  if (matchQuery && (clean.includes('drive.google.com') || clean.includes('docs.google.com'))) {
    return matchQuery[1];
  }

  // Fallback for short form or shared links
  const matchGeneral = clean.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (matchGeneral) return matchGeneral[1];

  return null;
}

export type DetectedVideoSource = {
  type: 'youtube' | 'google_drive' | 'direct';
  id: string;
  label: string;
};

export function detectVideoSource(url: string): DetectedVideoSource | null {
  const ytId = extractYouTubeID(url);
  if (ytId) {
    return { type: 'youtube', id: ytId, label: 'YouTube' };
  }

  const driveId = extractDriveFileId(url);
  if (driveId) {
    return { type: 'google_drive', id: driveId, label: 'Google Drive' };
  }

  // Direct MP4 / WebM / Video URL
  const trimmed = url.trim();
  if (/^https?:\/\/.*?\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(trimmed)) {
    return { type: 'direct', id: trimmed, label: 'Direct Video' };
  }

  return null;
}

export function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function parseTimeString(timeStr: string): number | null {
  const clean = timeStr.trim();
  if (!clean) return null;

  // Single number of seconds
  if (/^\d+(\.\d+)?$/.test(clean)) {
    return parseFloat(clean);
  }

  // MM:SS or HH:MM:SS
  const parts = clean.split(':').map(Number);
  if (parts.some(isNaN)) return null;

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return null;
}
