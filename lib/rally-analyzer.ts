import { Shot, Rally } from '@/types/shot-data';

/**
 * Extracts rallies from a list of shots based on new_sequence markers and group numbers
 */
export function extractRallies(shots: Shot[]): Rally[] {
  const rallies: Rally[] = [];
  const rallyMap = new Map<number, Shot[]>();

  // Group shots by rally number (group field)
  shots.forEach((shot) => {
    if (shot.group && shot.group > 0) {
      if (!rallyMap.has(shot.group)) {
        rallyMap.set(shot.group, []);
      }
      rallyMap.get(shot.group)!.push(shot);
    }
  });

  // Convert map to Rally objects
  rallyMap.forEach((rallyShots, groupId) => {
    if (rallyShots.length === 0) return;

    // Sort shots by frame/timestamp
    rallyShots.sort((a, b) => a.frame - b.frame);

    const startShot = rallyShots[0];
    const endShot = rallyShots[rallyShots.length - 1];

    // Determine winner from the last shot
    let winner: string | undefined;
    if (endShot.winner_error === 'winner') {
      winner = endShot.player_id;
    } else if (endShot.winner_error === 'error') {
      // The player who made an error loses, so the winner is the other player
      const errorPlayer = endShot.player_id;
      const otherPlayers = rallyShots
        .map((s) => s.player_id)
        .filter((p) => p !== errorPlayer);
      winner = otherPlayers.length > 0 ? otherPlayers[0] : undefined;
    }

    rallies.push({
      id: `rally-${groupId}`,
      startTime: startShot.timestamp || 0,
      endTime: endShot.timestamp || 0,
      shots: rallyShots,
      winner,
      duration: (endShot.timestamp || 0) - (startShot.timestamp || 0),
    });
  });

  // Sort rallies by start time
  rallies.sort((a, b) => a.startTime - b.startTime);

  return rallies;
}

/**
 * Find the rally that contains a specific shot
 */
export function findRallyForShot(
  shot: Shot,
  rallies: Rally[]
): Rally | undefined {
  return rallies.find((rally) =>
    rally.shots.some((s) => s.index === shot.index)
  );
}

/**
 * Get rally statistics
 */
export interface RallyStats {
  totalRallies: number;
  averageShotsPerRally: number;
  averageDuration: number;
  longestRally: Rally | null;
  shortestRally: Rally | null;
}

export function calculateRallyStats(rallies: Rally[]): RallyStats {
  if (rallies.length === 0) {
    return {
      totalRallies: 0,
      averageShotsPerRally: 0,
      averageDuration: 0,
      longestRally: null,
      shortestRally: null,
    };
  }

  const totalShots = rallies.reduce((sum, rally) => sum + rally.shots.length, 0);
  const totalDuration = rallies.reduce(
    (sum, rally) => sum + (rally.duration || 0),
    0
  );

  const longestRally = rallies.reduce((longest, current) =>
    current.shots.length > longest.shots.length ? current : longest
  );

  const shortestRally = rallies.reduce((shortest, current) =>
    current.shots.length < shortest.shots.length ? current : shortest
  );

  return {
    totalRallies: rallies.length,
    averageShotsPerRally: totalShots / rallies.length,
    averageDuration: totalDuration / rallies.length,
    longestRally,
    shortestRally,
  };
}

/**
 * Filter rallies based on criteria
 */
export function filterRallies(
  rallies: Rally[],
  filters: {
    minShots?: number;
    maxShots?: number;
    minDuration?: number;
    maxDuration?: number;
    winner?: string;
  }
): Rally[] {
  return rallies.filter((rally) => {
    if (filters.minShots && rally.shots.length < filters.minShots) return false;
    if (filters.maxShots && rally.shots.length > filters.maxShots) return false;
    if (filters.minDuration && (rally.duration || 0) < filters.minDuration)
      return false;
    if (filters.maxDuration && (rally.duration || 0) > filters.maxDuration)
      return false;
    if (filters.winner && rally.winner !== filters.winner) return false;
    return true;
  });
}
