import { Shot } from '@/types/shot-data';

export interface PlayerStats {
  playerId: string;
  totalShots: number;
  winners: number;
  errors: number;
  winnerRate: number;
  errorRate: number;
  avgShotRating: number;
  shotTypeDistribution: Record<string, number>;
  zoneDistribution: Record<string, number>;
  directionDistribution: Record<string, number>;
}

export interface ShotTypeStats {
  shotType: string;
  count: number;
  winners: number;
  errors: number;
  successRate: number;
  avgRating: number;
}

export interface ZoneStats {
  zone: string;
  count: number;
  winners: number;
  errors: number;
  successRate: number;
  avgRating: number;
}

export interface OverallStats {
  totalShots: number;
  totalWinners: number;
  totalErrors: number;
  avgShotRating: number;
  shotTypeStats: ShotTypeStats[];
  zoneStats: ZoneStats[];
}

/**
 * Calculate statistics for a specific player
 */
export function calculatePlayerStats(
  shots: Shot[],
  playerId: string
): PlayerStats {
  const playerShots = shots.filter((shot) => shot.player_id === playerId);

  if (playerShots.length === 0) {
    return {
      playerId,
      totalShots: 0,
      winners: 0,
      errors: 0,
      winnerRate: 0,
      errorRate: 0,
      avgShotRating: 0,
      shotTypeDistribution: {},
      zoneDistribution: {},
      directionDistribution: {},
    };
  }

  const winners = playerShots.filter(
    (shot) => shot.winner_error === 'winner'
  ).length;
  const errors = playerShots.filter(
    (shot) => shot.winner_error === 'error'
  ).length;

  const totalRating = playerShots.reduce(
    (sum, shot) => sum + (shot.shot_rating || 0),
    0
  );

  // Shot type distribution
  const shotTypeDistribution: Record<string, number> = {};
  playerShots.forEach((shot) => {
    shotTypeDistribution[shot.shot_label] =
      (shotTypeDistribution[shot.shot_label] || 0) + 1;
  });

  // Zone distribution
  const zoneDistribution: Record<string, number> = {};
  playerShots.forEach((shot) => {
    zoneDistribution[shot.zone_shuttle] =
      (zoneDistribution[shot.zone_shuttle] || 0) + 1;
  });

  // Direction distribution
  const directionDistribution: Record<string, number> = {};
  playerShots.forEach((shot) => {
    if (shot.shot_direction) {
      directionDistribution[shot.shot_direction] =
        (directionDistribution[shot.shot_direction] || 0) + 1;
    }
  });

  return {
    playerId,
    totalShots: playerShots.length,
    winners,
    errors,
    winnerRate: winners / playerShots.length,
    errorRate: errors / playerShots.length,
    avgShotRating: totalRating / playerShots.length,
    shotTypeDistribution,
    zoneDistribution,
    directionDistribution,
  };
}

/**
 * Calculate statistics for all players
 */
export function calculateAllPlayerStats(shots: Shot[]): PlayerStats[] {
  const playerIds = Array.from(new Set(shots.map((shot) => shot.player_id)));
  return playerIds
    .map((playerId) => calculatePlayerStats(shots, playerId))
    .filter((stats) => stats.totalShots > 0)
    .sort((a, b) => b.totalShots - a.totalShots);
}

/**
 * Calculate statistics by shot type
 */
export function calculateShotTypeStats(shots: Shot[]): ShotTypeStats[] {
  const shotTypes = Array.from(new Set(shots.map((shot) => shot.shot_label)));

  return shotTypes
    .map((shotType) => {
      const typeShots = shots.filter((shot) => shot.shot_label === shotType);
      const winners = typeShots.filter(
        (shot) => shot.winner_error === 'winner'
      ).length;
      const errors = typeShots.filter(
        (shot) => shot.winner_error === 'error'
      ).length;
      const totalRating = typeShots.reduce(
        (sum, shot) => sum + (shot.shot_rating || 0),
        0
      );

      return {
        shotType,
        count: typeShots.length,
        winners,
        errors,
        successRate: winners / (winners + errors || 1),
        avgRating: totalRating / typeShots.length,
      };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculate statistics by zone
 */
export function calculateZoneStats(shots: Shot[]): ZoneStats[] {
  const zones = Array.from(new Set(shots.map((shot) => shot.zone_shuttle)));

  return zones
    .map((zone) => {
      const zoneShots = shots.filter((shot) => shot.zone_shuttle === zone);
      const winners = zoneShots.filter(
        (shot) => shot.winner_error === 'winner'
      ).length;
      const errors = zoneShots.filter(
        (shot) => shot.winner_error === 'error'
      ).length;
      const totalRating = zoneShots.reduce(
        (sum, shot) => sum + (shot.shot_rating || 0),
        0
      );

      return {
        zone,
        count: zoneShots.length,
        winners,
        errors,
        successRate: winners / (winners + errors || 1),
        avgRating: totalRating / zoneShots.length,
      };
    })
    .sort((a, b) => {
      const zoneNumA = parseInt(a.zone.split('-')[1]) || 0;
      const zoneNumB = parseInt(b.zone.split('-')[1]) || 0;
      return zoneNumA - zoneNumB;
    });
}

/**
 * Calculate overall statistics
 */
export function calculateOverallStats(shots: Shot[]): OverallStats {
  const totalWinners = shots.filter(
    (shot) => shot.winner_error === 'winner'
  ).length;
  const totalErrors = shots.filter(
    (shot) => shot.winner_error === 'error'
  ).length;
  const totalRating = shots.reduce(
    (sum, shot) => sum + (shot.shot_rating || 0),
    0
  );

  return {
    totalShots: shots.length,
    totalWinners,
    totalErrors,
    avgShotRating: totalRating / shots.length,
    shotTypeStats: calculateShotTypeStats(shots),
    zoneStats: calculateZoneStats(shots),
  };
}

/**
 * Get top shots by rating
 */
export function getTopShots(shots: Shot[], limit: number = 10): Shot[] {
  return [...shots]
    .filter((shot) => shot.shot_rating > 0)
    .sort((a, b) => b.shot_rating - a.shot_rating)
    .slice(0, limit);
}
