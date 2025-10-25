import { MatchData, VideoClip, TrackingData } from '@/types/match-data';

const VIDEO_ID = '7CDF4E19-AFC0-438A-9CFD-AEFEBBC09E10';

// Toggle between local files and S3
const USE_LOCAL_FILES = true; // Set to true once files are downloaded

// Helper function to create video clip
const createClip = (
  id: string,
  title: string,
  filename: string,
  format: 'autopan' | 'landscape',
  quality?: 'longest' | 'highest-rated' | 'highlight',
  variant?: number,
  description?: string
): VideoClip => {
  if (USE_LOCAL_FILES) {
    // Load from public/data folder
    return {
      id,
      title,
      description,
      thumbnailKey: `/data/${format}/${filename}.jpg`,
      videoKey: `/data/${format}/${filename}.mp4`,
      format,
      quality,
      variant,
    };
  } else {
    // Load from S3 with presigned URLs
    return {
      id,
      title,
      description,
      thumbnailKey: `shot-search-test-data/${format}/${VIDEO_ID}/${filename}.jpg`,
      videoKey: `shot-search-test-data/${format}/${VIDEO_ID}/${filename}.mp4`,
      format,
      quality,
      variant,
    };
  }
};

// Generate highlights
const generateHighlights = (): VideoClip[] => {
  const highlights: VideoClip[] = [];

  const highlightTypes = [
    { file: 'audio_energy_highlights', title: 'Audio Energy Analysis' },
    { file: 'pose_based_highlights', title: 'Pose-Based Analysis' },
    { file: 'highlights', title: 'Clutch Moments' },
  ];

  highlightTypes.forEach((h) => {
    // Autopan version
    highlights.push(createClip(
      `autopan-${h.file}`,
      h.title,
      h.file,
      'autopan',
      'highlight',
      undefined,
      'Auto-panned portrait format'
    ));

    // Landscape version
    highlights.push(createClip(
      `landscape-${h.file}`,
      h.title,
      h.file,
      'landscape',
      'highlight',
      undefined,
      'Wide landscape format'
    ));
  });

  return highlights;
};

// Generate rallies (5 longest)
const generateRallies = (): VideoClip[] => {
  const rallies: VideoClip[] = [];

  for (let i = 1; i <= 5; i++) {
    // Autopan version
    rallies.push(createClip(
      `autopan-rally-${i}`,
      `Rally #${i}`,
      `5_longest_rally_clips_${i}`,
      'autopan',
      'longest',
      i,
      'Auto-panned portrait format'
    ));

    // Landscape version
    rallies.push(createClip(
      `landscape-rally-${i}`,
      `Rally #${i}`,
      `5_longest_rally_clips_${i}`,
      'landscape',
      'longest',
      i,
      'Wide landscape format'
    ));
  }

  return rallies;
};

// Generate rated clips (4 top rated)
const generateRatedClips = (): VideoClip[] => {
  const ratedClips: VideoClip[] = [];

  for (let i = 1; i <= 4; i++) {
    // Autopan version
    ratedClips.push(createClip(
      `autopan-rated-${i}`,
      `Top Clip #${i}`,
      `4_rating_clips_${i}`,
      'autopan',
      'highest-rated',
      i,
      'Auto-panned portrait format'
    ));

    // Landscape version
    ratedClips.push(createClip(
      `landscape-rated-${i}`,
      `Top Clip #${i}`,
      `4_rating_clips_${i}`,
      'landscape',
      'highest-rated',
      i,
      'Wide landscape format'
    ));
  }

  return ratedClips;
};

// Generate full match videos
const generateFullMatch = (): VideoClip[] => {
  return [
    createClip(
      'landscape-full-match',
      'Full Match (No Breaks)',
      'match_without_breaks',
      'landscape',
      undefined,
      undefined,
      'Complete match with breaks removed'
    ),
  ];
};

// Generate tracking data references
const generateTrackingData = (): TrackingData[] => {
  return [
    {
      id: 'court-keypoints',
      type: 'court-keypoints',
      fileUrl: `${S3_BASE_URL}/court_keypoints/${VIDEO_ID}.yaml`,
      description: 'Court coordinate landmarks for spatial analysis',
    },
    {
      id: 'params',
      type: 'params',
      fileUrl: `${S3_BASE_URL}/output/${VIDEO_ID}/params.yaml`,
      description: 'Processing configuration parameters',
    },
    {
      id: 'ball-tracker',
      type: 'ball-tracker',
      fileUrl: `${S3_BASE_URL}/output/${VIDEO_ID}/ball_tracker_state/`,
      description: '900+ pickle files tracking ball position across frames',
    },
  ];
};

export const matchData: MatchData = {
  videoId: VIDEO_ID,
  videos: {
    highlights: generateHighlights(),
    rallies: generateRallies(),
    ratedClips: generateRatedClips(),
    fullMatch: generateFullMatch(),
  },
  shots: [], // TODO: Will populate with actual shot data
  tracking: generateTrackingData(),
};

export { S3_BASE_URL, VIDEO_ID };
