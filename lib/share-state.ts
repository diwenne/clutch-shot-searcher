import { FilterState } from '@/components/EnhancedFilters';
import { Shot } from '@/types/shot-data';

export interface ShareableState {
  v: number;                          // Version for compatibility
  f?: FilterState;                    // Filters (optional)
  p?: string;                         // Selected player
  seq?: {                             // Sequence data
    blocks: any[];                    // Sequence pattern blocks (TODO)
    len: number;                      // Sequence length
    notes: Record<string, string>;    // Sequence notes
    shotIndices?: number[];           // Matched shot indices (for reconstruction)
  };
  rm?: number[];                      // Removed shots
  rmSeq?: number[];                   // Removed sequences
  pn?: Record<string, string>;        // Player name mappings
}

interface AppState {
  filters: FilterState;
  selectedPlayer: string | null;
  sequenceLength: number;
  sequenceNotes: Map<string, string>;
  manuallyRemovedShots: Set<number>;
  manuallyRemovedSequences: Set<number>;
  playerNames: Record<string, string>;
  isSequenceMode: boolean;
  sequenceBlocks?: any[];             // Optional: from SequenceBuilder
  filteredShots?: Shot[];             // Filtered shots array (for sequence mode)
}

/**
 * Serializes the current application state into a base64-encoded string
 * suitable for URL sharing.
 */
export function serializeShareableState(appState: AppState): string {
  const state: ShareableState = {
    v: 1,
  };

  // Only include non-default filters
  const hasFilters = Object.values(appState.filters).some(v => {
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'number') return v !== 0 && (
      // Check if it's not the default max rating
      !(appState.filters.maxRating === 13 && v === 13)
    );
    return v !== '';
  });

  if (hasFilters) {
    state.f = appState.filters;
  }

  // Selected player
  if (appState.selectedPlayer) {
    state.p = appState.selectedPlayer;
  }

  // Sequence data
  if (appState.isSequenceMode && appState.sequenceLength > 0) {
    state.seq = {
      blocks: appState.sequenceBlocks || [],
      len: appState.sequenceLength,
      notes: Object.fromEntries(appState.sequenceNotes),
      // Save the matched shot indices so we can reconstruct exact filteredShots
      shotIndices: appState.filteredShots?.map(s => s.index) || [],
    };
  }

  // Removed shots/sequences (only if they exist)
  if (appState.manuallyRemovedShots.size > 0) {
    state.rm = Array.from(appState.manuallyRemovedShots);
  }
  if (appState.manuallyRemovedSequences.size > 0) {
    state.rmSeq = Array.from(appState.manuallyRemovedSequences);
  }

  // Player name mappings (only if customized)
  if (Object.keys(appState.playerNames).length > 0) {
    state.pn = appState.playerNames;
  }

  // Serialize to JSON and base64 encode
  const json = JSON.stringify(state);

  // Debug: log what we're serializing
  console.log('📦 Serializing state:', {
    hasFilters: !!state.f,
    hasPlayer: !!state.p,
    hasSequence: !!state.seq,
    sequenceLength: state.seq?.len,
    matchedShots: state.seq?.shotIndices?.length || 0,
    notesCount: state.seq ? Object.keys(state.seq.notes).length : 0,
    removedShots: state.rm?.length || 0,
    filters: state.f,
  });

  // Use btoa with URI encoding to handle special characters
  const encoded = btoa(encodeURIComponent(json));

  return encoded;
}

/**
 * Generates a shareable URL with the encoded state.
 */
export function generateShareURL(encodedState: string): string {
  if (typeof window === 'undefined') return '';

  const url = new URL(window.location.href);

  // Clear any existing share parameter
  url.searchParams.delete('share');

  // Add the new share parameter
  url.searchParams.set('share', encodedState);

  return url.toString();
}

/**
 * Deserializes a base64-encoded state string back into a ShareableState object.
 */
export function deserializeShareableState(encodedState: string): ShareableState | null {
  try {
    // Decode from base64 and URI decode
    const json = decodeURIComponent(atob(encodedState));
    const state: ShareableState = JSON.parse(json);

    // Validate version
    if (!state.v || typeof state.v !== 'number') {
      console.warn('Invalid share state: missing or invalid version');
      return null;
    }

    if (state.v !== 1) {
      console.warn('Unsupported share state version:', state.v);
      return null;
    }

    return state;
  } catch (error) {
    console.error('Failed to deserialize share state:', error);
    return null;
  }
}

/**
 * Validates that the shared state references valid shot indices.
 */
export function validateSharedState(
  state: ShareableState,
  availableShots: Shot[]
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!availableShots || availableShots.length === 0) {
    warnings.push('No shots available to validate against');
    return { valid: false, warnings };
  }

  const shotIndices = new Set(availableShots.map(s => s.index));
  const maxIndex = Math.max(...availableShots.map(s => s.index));
  const minIndex = Math.min(...availableShots.map(s => s.index));

  // Check removed shot indices
  if (state.rm) {
    const invalidIndices = state.rm.filter(idx => !shotIndices.has(idx));
    if (invalidIndices.length > 0) {
      warnings.push(`Invalid removed shot indices: ${invalidIndices.join(', ')}`);
    }
  }

  // Check removed sequence indices
  if (state.rmSeq) {
    const invalidSeqIndices = state.rmSeq.filter(idx => idx < 0);
    if (invalidSeqIndices.length > 0) {
      warnings.push(`Invalid removed sequence indices: ${invalidSeqIndices.join(', ')}`);
    }
  }

  // Check player references
  if (state.p) {
    const availablePlayers = new Set(availableShots.map(s => s.player_id));
    if (!availablePlayers.has(state.p)) {
      warnings.push(`Selected player "${state.p}" not found in dataset`);
    }
  }

  // Check filter player references
  if (state.f?.players) {
    const availablePlayers = new Set(availableShots.map(s => s.player_id));
    const invalidPlayers = state.f.players.filter(p => !availablePlayers.has(p));
    if (invalidPlayers.length > 0) {
      warnings.push(`Filter players not found: ${invalidPlayers.join(', ')}`);
    }
  }

  // Warnings don't necessarily mean invalid, just notify the user
  return {
    valid: warnings.length === 0,
    warnings
  };
}

/**
 * Extracts the share parameter from the current URL.
 */
export function getShareParamFromURL(): string | null {
  if (typeof window === 'undefined') return null;

  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('share');
}

/**
 * Removes the share parameter from the URL without page reload.
 */
export function clearShareParamFromURL(): void {
  if (typeof window === 'undefined') return;

  window.history.replaceState({}, '', window.location.pathname);
}
