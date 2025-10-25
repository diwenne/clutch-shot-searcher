import Papa from 'papaparse';
import { Shot } from '@/types/shot-data';

const FPS = 30; // Assuming 30 FPS for the video

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

          return {
            index,
            shot_label: row.shot_label || '',
            frame: row.frame || 0,
            player_id: row.player_id || '',
            loc_2d,
            loc_3d,
            player_shooting: row.player_shooting || '',
            pred_conf: row.pred_conf || -1,
            zone_shuttle: row.zone_shuttle || '',
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
