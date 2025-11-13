import { Shot } from '@/types/shot-data';

export interface TimeFilter {
  type: 'before' | 'after';
  minutes: number;
  seconds: number;
}

export interface ShotFilter {
  shotType?: string[];
  player?: string[];
  zone?: string[];
  direction?: string[];
  courtSide?: 'top' | 'bot';
  minRating?: number;
  maxRating?: number;
  winnerError?: 'winner' | 'error';
  rallyLength?: { min?: number; max?: number };
  rallyPosition?: number; // 0 = any, 1 = 1st shot, 2 = 2nd shot, etc.
  // Time-based filters
  timeBefore?: TimeFilter;
  timeAfter?: TimeFilter;
  // Sequence support (array of filters for consecutive shots)
  sequence?: ShotFilter[];
}

export interface QueryResponse {
  type: 'filter' | 'analysis';
  filter?: ShotFilter;
  analysis?: string;
  explanation?: string;
}

export function calculatePlayerStats(query: string, shots: Shot[]) {
  // Extract player ID from query if mentioned
  const playerMatch = query.match(/player[- ]?(\d+)/i);
  const playerId = playerMatch ? `player-${playerMatch[1]}` : null;

  // Filter shots for the specific player if mentioned
  const playerShots = playerId
    ? shots.filter(s => s.player_id === playerId)
    : shots;

  if (playerShots.length === 0) {
    return null;
  }

  // Calculate statistics
  const totalShots = playerShots.length;
  const errors = playerShots.filter(s => s.winner_error === 'error');
  const winners = playerShots.filter(s => s.winner_error === 'winner');
  const errorRate = (errors.length / totalShots * 100).toFixed(1);
  const winnerRate = (winners.length / totalShots * 100).toFixed(1);

  // Shot type breakdown
  const shotTypeStats: Record<string, { total: number; errors: number }> = {};
  playerShots.forEach(shot => {
    if (!shotTypeStats[shot.shot_label]) {
      shotTypeStats[shot.shot_label] = { total: 0, errors: 0 };
    }
    shotTypeStats[shot.shot_label].total++;
    if (shot.winner_error === 'error') {
      shotTypeStats[shot.shot_label].errors++;
    }
  });

  // Zone analysis (where points are lost)
  const errorZones: Record<string, number> = {};
  errors.forEach(shot => {
    errorZones[shot.zone_shuttle] = (errorZones[shot.zone_shuttle] || 0) + 1;
  });

  const mostErrorZone = Object.entries(errorZones).sort((a, b) => b[1] - a[1])[0];

  // Direction analysis
  const directionStats: Record<string, { total: number; errors: number }> = {};
  playerShots.forEach(shot => {
    if (!directionStats[shot.shot_direction]) {
      directionStats[shot.shot_direction] = { total: 0, errors: 0 };
    }
    directionStats[shot.shot_direction].total++;
    if (shot.winner_error === 'error') {
      directionStats[shot.shot_direction].errors++;
    }
  });

  // Average rating
  const avgRating = (playerShots.reduce((sum, s) => sum + s.shot_rating, 0) / totalShots).toFixed(1);

  return {
    playerId: playerId || 'All players',
    totalShots,
    errorRate,
    winnerRate,
    avgRating,
    shotTypeStats,
    directionStats,
    mostErrorZone: mostErrorZone ? `${mostErrorZone[0]} (${mostErrorZone[1]} errors)` : 'N/A'
  };
}

export function generateExplanation(query: string, filter: ShotFilter): string {
  const parts: string[] = [];

  if (filter.shotType && Array.isArray(filter.shotType) && filter.shotType.length > 0) {
    parts.push(`${filter.shotType.join(', ')} shots`);
  }

  if (filter.player && Array.isArray(filter.player) && filter.player.length > 0) {
    parts.push(`by ${filter.player.join(' or ')}`);
  }

  if (filter.winnerError) {
    parts.push(`that were ${filter.winnerError}s`);
  }

  if (filter.direction && Array.isArray(filter.direction) && filter.direction.length > 0) {
    parts.push(`going ${filter.direction.join(' or ')}`);
  }

  if (filter.zone && Array.isArray(filter.zone) && filter.zone.length > 0) {
    parts.push(`landing in ${filter.zone.join(', ')}`);
  }

  if (filter.courtSide) {
    parts.push(`from ${filter.courtSide} player`);
  }

  if (filter.minRating !== undefined || filter.maxRating !== undefined) {
    if (filter.minRating !== undefined && filter.maxRating !== undefined) {
      parts.push(`with rating ${filter.minRating}-${filter.maxRating}`);
    } else if (filter.minRating !== undefined) {
      parts.push(`with rating above ${filter.minRating}`);
    } else if (filter.maxRating !== undefined) {
      parts.push(`with rating below ${filter.maxRating}`);
    }
  }

  if (filter.rallyLength) {
    if (filter.rallyLength.min !== undefined && filter.rallyLength.max !== undefined) {
      parts.push(`in rallies with ${filter.rallyLength.min}-${filter.rallyLength.max} shots`);
    } else if (filter.rallyLength.min !== undefined) {
      parts.push(`in rallies with at least ${filter.rallyLength.min} shots`);
    } else if (filter.rallyLength.max !== undefined) {
      parts.push(`in rallies with at most ${filter.rallyLength.max} shots`);
    }
  }

  if (filter.timeAfter) {
    const time = `${filter.timeAfter.minutes}:${filter.timeAfter.seconds.toString().padStart(2, '0')}`;
    parts.push(`occurring after ${time} in the video`);
  }

  if (filter.timeBefore) {
    const time = `${filter.timeBefore.minutes}:${filter.timeBefore.seconds.toString().padStart(2, '0')}`;
    parts.push(`occurring before ${time} in the video`);
  }

  if (filter.sequence && filter.sequence.length > 0) {
    const sequenceDesc = filter.sequence.map((s, i) => {
      const shotType = s.shotType?.[0] || 'any shot';
      return `${i + 1}. ${shotType}`;
    }).join(' → ');
    return `Finding sequence: ${sequenceDesc}`;
  }

  if (parts.length === 0) {
    return 'Showing all shots. Try adding filters like "winning smashes" or "player-113".';
  }

  return `Searching for ${parts.join(', ')}.`;
}
