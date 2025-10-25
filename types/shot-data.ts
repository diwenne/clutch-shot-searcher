export interface Shot {
  index: number;
  shot_label: string; // e.g., 'serve', 'smash', 'drive', 'drop', 'clear'
  frame: number;
  player_id: string;
  loc_2d: [number, number]; // 2D court position
  loc_3d: [number, number]; // 3D position (often [-1, -1])
  player_shooting: string;
  pred_conf: number;
  zone_shuttle: string; // e.g., 'zone-4'
  zone_player: string;
  shot_direction: string; // e.g., 'cross/left', 'cross/right'
  frame_diff: number;
  player_id_original: string;
  serving_side: string;
  new_sequence: boolean; // TRUE marks start of rally
  group: number; // Rally/sequence number
  n_serve: string;
  normalized_coordinates: [number, number]; // [0-1, 0-1] normalized court position
  player_court_side: string; // 'top' or 'bot'
  winner_error: string; // 'winner' or 'error' or empty
  shot_rating: number; // Quality rating (higher is better)
  timestamp?: number; // Calculated from frame (assuming 30 fps)
}

export interface Rally {
  id: string;
  startTime: number;
  endTime: number;
  shots: Shot[];
  winner?: string;
  duration?: number;
}

export interface MatchData {
  videoId: string;
  videoPath: string;
  shotsCSVPath: string;
  shots: Shot[];
  rallies: Rally[];
}

export interface SearchFilters {
  shotType?: string[];
  player?: string[];
  rallyId?: string;
  timeRange?: { start: number; end: number };
  courtPattern?: { points: { x: number; y: number }[] };
}
