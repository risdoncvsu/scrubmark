export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Video {
  id: string;
  youtube_video_id: string;
  source_type?: 'youtube' | 'google_drive' | 'direct';
  project_name: string;
  user_id: string;
  owner_name: string;
  created_at: string;
}

export interface Comment {
  id: string;
  video_id: string;
  user_id: string;
  author_name: string;
  content: string;
  timestamp_seconds: number;
  is_resolved: boolean;
  created_at: string;
}
