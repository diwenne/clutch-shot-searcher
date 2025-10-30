import Papa from 'papaparse';
import { Shot } from '@/types/shot-data';

const FPS = 30; // Assuming 30 FPS for the video

// Calculate visual zone from normalized coordinates
// Matches the visual zone layout in CourtHeatmap component (FULL COURT with 4 rows)
function getVisualZone(x: number, y: number): string {
  // x: 0-1 (left to right)
  // y: 0-1 (top to bottom)

  // Determine column (left, middle, right)
  let col: number;
  if (x < 0.333) col = 0; // left
  else if (x < 0.667) col = 1; // middle
  else col = 2; // right

  // Determine row (4 EQUAL rows of 25% each)
  if (y < 0.25) {
    // Row 1 (top back court): zones 5, 4, 3 (left to right)
    return `zone-${5 - col}`;
  } else if (y < 0.5) {
    // Row 2 (top front court): zones 2, 1, 0 (left to right)
    return `zone-${2 - col}`;
  } else if (y < 0.75) {
    // Row 3 (bottom front court): zones 0, 1, 2 (left to right)
    return `zone-${col}`;
  } else {
    // Row 4 (bottom back court): zones 3, 4, 5 (left to right)
    return `zone-${3 + col}`;
  }
}

export async function parseShotsCSV(csvPath: string): Promise<Shot[]> {
  const response = await fetch(csvPath);
  const csvText = await response.text();

  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const shots: Shot[] = results.data.map((row: any, index: number) => {
          // Parse array fields
          const loc_2d = parseArrayField(row.loc_2d);
          const loc_3d = parseArrayField(row.loc_3d);
          const normalized_coordinates = parseArrayField(row.normalized_coordinates);

          // Calculate timestamp from frame number
          const timestamp = row.frame / FPS;

          // Calculate visual zone from coordinates (overrides CSV zone)
          const [x, y] = normalized_coordinates;
          const visualZone = getVisualZone(x, y);

          return {
            index,
            shot_label: row.shot_label || '',
            frame: row.frame || 0,
            player_id: row.player_id || '',
            loc_2d,
            loc_3d,
            player_shooting: row.player_shooting || '',
            pred_conf: row.pred_conf || -1,
            zone_shuttle: visualZone, // Use calculated zone based on coordinates
            zone_player: row.zone_player || '',
            shot_direction: row.shot_direction || '',
            frame_diff: row.frame_diff || 0,
            player_id_original: row.player_id_original || '',
            serving_side: row.serving_side || '',
            new_sequence: row.new_sequence === 'TRUE' || row.new_sequence === true,
            group: row.group || 0,
            n_serve: row.n_serve || '',
            normalized_coordinates,
            player_court_side: row.player_court_side || '',
            winner_error: row.winner_error || '',
            shot_rating: row.shot_rating || 0,
            timestamp,
          };
        });

        // Calculate start/end times for each shot based on consecutive shots
        for (let i = 0; i < shots.length; i++) {
          const prevShot = shots[i - 1];
          const currentShot = shots[i];
          const nextShot = shots[i + 1];

          if (prevShot && currentShot.timestamp) {
            // Start time is halfway between previous shot and current shot
            currentShot.startTime = (prevShot.timestamp! + currentShot.timestamp) / 2;
          } else if (currentShot.timestamp) {
            // First shot: start 0.5 seconds before
            currentShot.startTime = Math.max(0, currentShot.timestamp - 0.5);
          }

          if (nextShot && currentShot.timestamp) {
            // End time is halfway between current shot and next shot
            currentShot.endTime = (currentShot.timestamp + nextShot.timestamp!) / 2;
          } else if (currentShot.timestamp) {
            // Last shot: end 0.5 seconds after
            currentShot.endTime = currentShot.timestamp + 0.5;
          }

          // Calculate duration
          if (currentShot.startTime && currentShot.endTime) {
            currentShot.duration = currentShot.endTime - currentShot.startTime;
          }
        }

        resolve(shots);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

function parseArrayField(field: string | any): [number, number] {
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      return [parsed[0] || 0, parsed[1] || 0];
    } catch {
      return [0, 0];
    }
  }
  if (Array.isArray(field)) {
    return [field[0] || 0, field[1] || 0];
  }
  return [0, 0];
}

export function getShotTypes(shots: Shot[]): string[] {
  const types = new Set(shots.map(s => s.shot_label).filter(Boolean));
  return Array.from(types).sort();
}

export function getPlayers(shots: Shot[]): string[] {
  const players = new Set(shots.map(s => s.player_id).filter(Boolean));
  return Array.from(players).sort();
}

export function filterShots(
  shots: Shot[],
  filters: {
    shotType?: string;
    player?: string;
    minRating?: number;
    winnerError?: string;
  }
): Shot[] {
  return shots.filter(shot => {
    if (filters.shotType && shot.shot_label !== filters.shotType) return false;
    if (filters.player && shot.player_id !== filters.player) return false;
    if (filters.minRating && shot.shot_rating < filters.minRating) return false;
    if (filters.winnerError && shot.winner_error !== filters.winnerError) return false;
    return true;
  });
}
