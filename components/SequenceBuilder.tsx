'use client';

import { useState } from 'react';
import { PlusIcon, XMarkIcon, ArrowRightIcon, PlayIcon, ChevronDownIcon, ChevronUpIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { Shot } from '@/types/shot-data';

interface ShotBlock {
  id: string;
  shotType: string; // 'serve', 'drive', 'volley', 'lob', 'overhead', 'any'
  // Advanced filters (optional)
  players: string[];
  zones: string[];
  directions: string[];
  courtSide: string;
  minRating: number;
  maxRating: number;
  winnerError: string;
}

interface SequenceBuilderProps {
  shots: Shot[];
  onSequenceMatch: (matchingShots: Shot[], sequenceLength: number) => void;
  availablePlayers: string[];
  playerNames: Record<string, string>;
  availableShotTypes: string[];
}

const ZONES = ['zone-0', 'zone-1', 'zone-2', 'zone-3', 'zone-4', 'zone-5'];
const DIRECTIONS = ['cross/left', 'cross/right', 'straight'];

const SHOT_TYPE_COLORS: Record<string, string> = {
  'any': 'bg-zinc-400 dark:bg-zinc-500',
  'serve': 'bg-blue-500 dark:bg-blue-600',
  'drive': 'bg-purple-500 dark:bg-purple-600',
  'volley': 'bg-green-500 dark:bg-green-600',
  'lob': 'bg-yellow-500 dark:bg-yellow-600',
  'overhead': 'bg-red-500 dark:bg-red-600',
};

export default function SequenceBuilder({
  shots,
  onSequenceMatch,
  availablePlayers,
  playerNames,
  availableShotTypes
}: SequenceBuilderProps) {
  const [sequence, setSequence] = useState<ShotBlock[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set());
  const [draggedType, setDraggedType] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const createBlock = (shotType: string): ShotBlock => ({
    id: Date.now().toString() + Math.random(),
    shotType,
    players: [],
    zones: [],
    directions: [],
    courtSide: '',
    minRating: 0,
    maxRating: 13,
    winnerError: ''
  });

  const handleDragStartFromPalette = (shotType: string) => {
    setDraggedType(shotType);
  };

  const handleDragStartFromSequence = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropInSequence = (e: React.DragEvent, dropIndex?: number) => {
    e.preventDefault();

    // Dropping from palette
    if (draggedType) {
      const newBlock = createBlock(draggedType);
      if (dropIndex !== undefined) {
        const newSequence = [...sequence];
        newSequence.splice(dropIndex, 0, newBlock);
        setSequence(newSequence);
      } else {
        setSequence([...sequence, newBlock]);
      }
      setDraggedType(null);
    }
    // Reordering within sequence
    else if (draggedIndex !== null && dropIndex !== undefined && draggedIndex !== dropIndex) {
      const newSequence = [...sequence];
      const [draggedItem] = newSequence.splice(draggedIndex, 1);
      newSequence.splice(dropIndex, 0, draggedItem);
      setSequence(newSequence);
      setDraggedIndex(null);
    }
  };

  const removeShot = (id: string) => {
    setSequence(sequence.filter(s => s.id !== id));
    setExpandedFilters(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const updateShot = (id: string, updates: Partial<ShotBlock>) => {
    setSequence(sequence.map(s => (s.id === id ? { ...s, ...updates } : s)));
  };

  const toggleArrayFilter = (shotId: string, key: keyof Pick<ShotBlock, 'players' | 'zones' | 'directions'>, value: string) => {
    const shot = sequence.find(s => s.id === shotId);
    if (!shot) return;

    const currentArray = shot[key] as string[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(v => v !== value)
      : [...currentArray, value];

    updateShot(shotId, { [key]: newArray });
  };

  const toggleFilters = (id: string) => {
    setExpandedFilters(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const hasAdvancedFilters = (block: ShotBlock) => {
    return (
      block.players.length > 0 ||
      block.zones.length > 0 ||
      block.directions.length > 0 ||
      block.courtSide !== '' ||
      block.minRating > 0 ||
      block.maxRating < 13 ||
      block.winnerError !== ''
    );
  };

  const findMatchingSequences = () => {
    if (sequence.length === 0) {
      onSequenceMatch([], 0);
      return;
    }

    const results: Shot[] = [];

    // Iterate through shots and check if sequence matches
    for (let i = 0; i <= shots.length - sequence.length; i++) {
      const potentialMatch = shots.slice(i, i + sequence.length);

      // Check if this slice matches our sequence pattern
      const matches = sequence.every((block, idx) => {
        const shot = potentialMatch[idx];

        // Check shot type
        if (block.shotType !== 'any' && shot.shot_label !== block.shotType) {
          return false;
        }

        // Check players
        if (block.players.length > 0 && !block.players.includes(shot.player_id)) {
          return false;
        }

        // Check zones
        if (block.zones.length > 0 && !block.zones.includes(shot.zone_shuttle)) {
          return false;
        }

        // Check directions
        if (block.directions.length > 0 && !block.directions.includes(shot.shot_direction)) {
          return false;
        }

        // Check court side
        if (block.courtSide && shot.player_court_side !== block.courtSide) {
          return false;
        }

        // Check outcome
        if (block.winnerError && shot.winner_error !== block.winnerError) {
          return false;
        }

        // Check rating
        if (shot.shot_rating < block.minRating || shot.shot_rating > block.maxRating) {
          return false;
        }

        // Check if consecutive (indices differ by 1)
        if (idx > 0 && shot.index !== potentialMatch[idx - 1].index + 1) {
          return false;
        }

        return true;
      });

      if (matches) {
        results.push(...potentialMatch);
      }
    }

    onSequenceMatch(results, sequence.length);
  };

  const clearSequence = () => {
    setSequence([]);
    setExpandedFilters(new Set());
    onSequenceMatch([], 0);
  };

  const allShotTypes = ['any', ...availableShotTypes];

  return (
    <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ArrowRightIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold text-zinc-900 dark:text-white">
            Sequence Builder
          </span>
          {sequence.length > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
              {sequence.length} shot{sequence.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="text-zinc-400">
          {isExpanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
        </div>
      </button>

      {/* Builder Panel */}
      {isExpanded && (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 space-y-4">
          {/* Sequence Drop Zone */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Sequence (drag shot types from below)
            </label>
            <div
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropInSequence(e)}
              className={`min-h-[80px] p-2 border-2 border-dashed rounded-lg transition-colors ${
                sequence.length === 0
                  ? 'border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900'
                  : 'border-blue-300 dark:border-blue-600 bg-blue-50/30 dark:bg-blue-900/10'
              }`}
            >
              {sequence.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
                  Drag shot types here to build a sequence
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sequence.map((block, idx) => (
                    <div key={block.id} className="flex items-center gap-1">
                      {/* Shot Block */}
                      <div
                        draggable
                        onDragStart={() => handleDragStartFromSequence(idx)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropInSequence(e, idx)}
                        className={`relative group cursor-move`}
                      >
                        <div
                          className={`${SHOT_TYPE_COLORS[block.shotType]} text-white px-4 py-2 rounded-lg font-medium text-sm shadow-sm hover:shadow-md transition-all ${
                            hasAdvancedFilters(block) ? 'ring-2 ring-yellow-400 dark:ring-yellow-500' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{block.shotType}</span>
                            {hasAdvancedFilters(block) && (
                              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">filtered</span>
                            )}
                          </div>
                        </div>

                        {/* Hover controls */}
                        <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button
                            onClick={() => toggleFilters(block.id)}
                            className="p-1 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700"
                            title="Advanced filters"
                          >
                            <AdjustmentsHorizontalIcon className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => removeShot(block.id)}
                            className="p-1 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700"
                            title="Remove"
                          >
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Advanced Filters Panel */}
                        {expandedFilters.has(block.id) && (
                          <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 p-4 space-y-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                                Advanced Filters: {block.shotType}
                              </h4>
                              <button
                                onClick={() => toggleFilters(block.id)}
                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </div>

                            {/* Players */}
                            <div>
                              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                Player
                              </label>
                              <div className="flex flex-wrap gap-1">
                                {availablePlayers.map(player => (
                                  <button
                                    key={player}
                                    onClick={() => toggleArrayFilter(block.id, 'players', player)}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                      block.players.includes(player)
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                                    }`}
                                  >
                                    {playerNames[player] || player}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Zones */}
                            <div>
                              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                Zone
                              </label>
                              <div className="flex flex-wrap gap-1">
                                {ZONES.map(zone => (
                                  <button
                                    key={zone}
                                    onClick={() => toggleArrayFilter(block.id, 'zones', zone)}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                      block.zones.includes(zone)
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                                    }`}
                                  >
                                    {zone}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Directions */}
                            <div>
                              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                Direction
                              </label>
                              <div className="flex flex-wrap gap-1">
                                {DIRECTIONS.map(dir => (
                                  <button
                                    key={dir}
                                    onClick={() => toggleArrayFilter(block.id, 'directions', dir)}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                      block.directions.includes(dir)
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                                    }`}
                                  >
                                    {dir}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Outcome */}
                            <div>
                              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                Outcome
                              </label>
                              <select
                                value={block.winnerError}
                                onChange={(e) => updateShot(block.id, { winnerError: e.target.value })}
                                className="w-full px-2 py-1 text-xs bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded"
                              >
                                <option value="">Any</option>
                                <option value="winner">Winner</option>
                                <option value="error">Error</option>
                              </select>
                            </div>

                            {/* Court Side */}
                            <div>
                              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                Court Side
                              </label>
                              <select
                                value={block.courtSide}
                                onChange={(e) => updateShot(block.id, { courtSide: e.target.value })}
                                className="w-full px-2 py-1 text-xs bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded"
                              >
                                <option value="">Any</option>
                                <option value="top">Top</option>
                                <option value="bot">Bottom</option>
                              </select>
                            </div>

                            {/* Rating */}
                            <div>
                              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                Rating: {block.minRating} - {block.maxRating}
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="range"
                                  min="0"
                                  max="13"
                                  value={block.minRating}
                                  onChange={(e) => updateShot(block.id, { minRating: Number(e.target.value) })}
                                  className="flex-1"
                                />
                                <input
                                  type="range"
                                  min="0"
                                  max="13"
                                  value={block.maxRating}
                                  onChange={(e) => updateShot(block.id, { maxRating: Number(e.target.value) })}
                                  className="flex-1"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Arrow */}
                      {idx < sequence.length - 1 && (
                        <ArrowRightIcon className="h-4 w-4 text-zinc-400" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Shot Type Palette */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Drag to add shots
            </label>
            <div className="flex flex-wrap gap-2">
              {allShotTypes.map(shotType => (
                <div
                  key={shotType}
                  draggable
                  onDragStart={() => handleDragStartFromPalette(shotType)}
                  className={`${SHOT_TYPE_COLORS[shotType]} text-white px-4 py-2 rounded-lg font-medium text-sm cursor-move hover:shadow-lg transition-all hover:scale-105`}
                >
                  {shotType}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <button
              onClick={findMatchingSequences}
              disabled={sequence.length === 0}
              className={`flex items-center gap-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                sequence.length === 0
                  ? 'bg-zinc-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <PlayIcon className="h-4 w-4" />
              Find Sequences
            </button>

            <button
              onClick={clearSequence}
              disabled={sequence.length === 0}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                sequence.length === 0
                  ? 'text-zinc-400 cursor-not-allowed'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
