export interface VideoClip {
  id: string;
  title: string;
  description?: string;
  thumbnailKey: string; // S3 key for thumbnail
  videoKey: string; // S3 key for video
  format: 'autopan' | 'landscape';
  quality?: 'longest' | 'highest-rated' | 'highlight';
  variant?: number; // For numbered variants like rally-1, rally-2
}

export interface Shot {
  id: string;
  frameNumber: number;
  timestamp: number;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface TrackingData {
  id: string;
  type: 'ball-tracker' | 'court-keypoints' | 'params';
  fileUrl: string;
  description: string;
}

export interface MatchData {
  videoId: string;
  videos: {
    highlights: VideoClip[];
    rallies: VideoClip[];
    ratedClips: VideoClip[];
    fullMatch: VideoClip[];
  };
  shots: Shot[];
  tracking: TrackingData[];
}
