'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, XMarkIcon, ArrowRightIcon, PlayIcon, ChevronDownIcon, ChevronUpIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { Shot } from '@/types/shot-data';

interface TimeFilter {
  type: 'before' | 'after';
  minutes: number;
  seconds: number;
}

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
  rallyPosition: number; // 0 = any position, 1 = 1st shot, 2 = 2nd shot, etc.
  // Time filters (can have both before and after)
  timeBefore: TimeFilter | null;
  timeAfter: TimeFilter | null;
}

interface SequenceBuilderProps {
  shots: Shot[];
  onSequenceMatch: (matchingShots: Shot[], sequenceLength: number) => void;
  availablePlayers: string[];
  playerNames: Record<string, string>;
  availableShotTypes: string[];
  nlpSequence?: ShotBlock[]; // Sequence from NLP query
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
  availableShotTypes,
  nlpSequence
}: SequenceBuilderProps) {
  const [sequence, setSequence] = useState<ShotBlock[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set());
  const [draggedType, setDraggedType] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedTimeType, setDraggedTimeType] = useState<'before' | 'after' | null>(null);

  // Populate sequence from NLP query
  useEffect(() => {
    if (nlpSequence && nlpSequence.length > 0) {
      console.log('📥 NLP Sequence received:', nlpSequence);
      setSequence(nlpSequence);
      setIsExpanded(true); // Auto-expand when NLP populates
    }
  }, [nlpSequence]);

  const createBlock = (shotType: string): ShotBlock => ({
    id: Date.now().toString() + Math.random(),
    shotType,
    players: [],
    zones: [],
    directions: [],
    courtSide: '',
    minRating: 0,
    maxRating: 13,
    winnerError: '',
    rallyPosition: 0, // 0 = any position
    timeBefore: null,
    timeAfter: null
  });

  const handleDragStartFromPalette = (shotType: string) => {
    setDraggedType(shotType);
  };

  const handleDragStartTimeFilter = (type: 'before' | 'after') => {
    setDraggedTimeType(type);
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

  const handleDropTimeOnShot = (e: React.DragEvent, shotId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedTimeType) {
      const shot = sequence.find(s => s.id === shotId);
      if (!shot) return;

      if (draggedTimeType === 'before') {
        // Default to end of video (last shot's timestamp)
        const lastShot = shots[shots.length - 1];
        const videoLength = lastShot?.timestamp ?? 5999; // fallback to 99:59
        const minutes = Math.floor(videoLength / 60);
        const seconds = Math.floor(videoLength % 60);
        updateShot(shotId, { timeBefore: { type: 'before', minutes, seconds } });
      } else {
        updateShot(shotId, { timeAfter: { type: 'after', minutes: 0, seconds: 0 } });
      }
      setDraggedTimeType(null);
    }
  };

  const removeTimeFilter = (shotId: string, type: 'before' | 'after') => {
    if (type === 'before') {
      updateShot(shotId, { timeBefore: null });
    } else {
      updateShot(shotId, { timeAfter: null });
    }
  };

  const updateTimeFilter = (shotId: string, type: 'before' | 'after', minutes: number, seconds: number) => {
    if (type === 'before') {
      updateShot(shotId, { timeBefore: { type: 'before', minutes, seconds } });
    } else {
      updateShot(shotId, { timeAfter: { type: 'after', minutes, seconds } });
    }
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

  // Helper function to calculate rally position for a shot
  const getRallyPosition = (shot: Shot, shotIndex: number): number => {
    // Count backwards to find the start of the rally (new_sequence = true)
    let position = 1;
    for (let i = shotIndex - 1; i >= 0; i--) {
      if (shots[i].new_sequence) {
        break;
      }
      // Only count if same rally group
      if (shots[i].group === shot.group) {
        position++;
      } else {
        break;
      }
    }
    return position;
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
        const shotGlobalIndex = i + idx;

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

        // Check rally position
        if (block.rallyPosition > 0) {
          const actualPosition = getRallyPosition(shot, shotGlobalIndex);
          if (actualPosition !== block.rallyPosition) {
            return false;
          }
        }

        // Check time filters
        if (block.timeBefore && shot.timestamp !== undefined) {
          const filterTime = block.timeBefore.minutes * 60 + block.timeBefore.seconds;
          if (shot.timestamp >= filterTime) {
            return false;
          }
        }
        if (block.timeAfter && shot.timestamp !== undefined) {
          const filterTime = block.timeAfter.minutes * 60 + block.timeAfter.seconds;
          if (shot.timestamp <= filterTime) {
            return false;
          }
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
                <div className="space-y-1">
                  {sequence.map((block, idx) => (
                    <div key={block.id} className="flex flex-col gap-2 w-full">
                      <div className="flex items-center gap-1">
                        {/* Shot Block with Time Filters */}
                        <div
                          draggable
                          onDragStart={() => handleDragStartFromSequence(idx)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => {
                            if (draggedTimeType) {
                              handleDropTimeOnShot(e, block.id);
                            } else {
                              handleDropInSequence(e, idx);
                            }
                          }}
                          onClick={() => toggleFilters(block.id)}
                          className="relative cursor-pointer flex-1"
                        >
                          {/* Time After Badge */}
                          {block.timeAfter && (
                            <div className="absolute -top-2 left-2 bg-teal-500 text-white text-xs px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 z-10">
                              <span>After {block.timeAfter.minutes}:{block.timeAfter.seconds.toString().padStart(2, '0')}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeTimeFilter(block.id, 'after');
                                }}
                                className="hover:text-teal-200"
                              >
                                <XMarkIcon className="h-3 w-3" />
                              </button>
                            </div>
                          )}

                          {/* Time Before Badge */}
                          {block.timeBefore && (
                            <div className="absolute -bottom-2 left-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 z-10">
                              <span>Before {block.timeBefore.minutes}:{block.timeBefore.seconds.toString().padStart(2, '0')}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeTimeFilter(block.id, 'before');
                                }}
                                className="hover:text-orange-200"
                              >
                                <XMarkIcon className="h-3 w-3" />
                              </button>
                            </div>
                          )}

                          <div
                            className={`${SHOT_TYPE_COLORS[block.shotType]} text-white px-4 py-2 rounded-lg font-medium text-sm shadow-sm hover:shadow-md transition-all ${
                              hasAdvancedFilters(block) || block.timeBefore || block.timeAfter ? 'ring-2 ring-yellow-400 dark:ring-yellow-500' : ''
                            } ${expandedFilters.has(block.id) ? 'rounded-b-none' : ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span>#{idx + 1} {block.shotType}</span>
                                {(hasAdvancedFilters(block) || block.timeBefore || block.timeAfter) && (
                                  <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">filtered</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {expandedFilters.has(block.id) ? (
                                  <ChevronUpIcon className="h-4 w-4" />
                                ) : (
                                  <ChevronDownIcon className="h-4 w-4" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => removeShot(block.id)}
                          className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          title="Remove"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Time Filter Edit Panel */}
                      {(block.timeBefore || block.timeAfter) && expandedFilters.has(block.id) && (
                        <div className="w-full bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 space-y-2">
                          {block.timeBefore && (
                            <div>
                              <label className="block text-xs font-medium text-orange-700 dark:text-orange-400 mb-1">
                                Before Time
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  value={block.timeBefore.minutes}
                                  onChange={(e) => updateTimeFilter(block.id, 'before', Number(e.target.value), block.timeBefore!.seconds)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-16 px-2 py-1 text-xs bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded"
                                />
                                <span className="text-xs">min</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  value={block.timeBefore.seconds}
                                  onChange={(e) => updateTimeFilter(block.id, 'before', block.timeBefore!.minutes, Number(e.target.value))}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-16 px-2 py-1 text-xs bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded"
                                />
                                <span className="text-xs">sec</span>
                              </div>
                            </div>
                          )}
                          {block.timeAfter && (
                            <div>
                              <label className="block text-xs font-medium text-teal-700 dark:text-teal-400 mb-1">
                                After Time
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  value={block.timeAfter.minutes}
                                  onChange={(e) => updateTimeFilter(block.id, 'after', Number(e.target.value), block.timeAfter!.seconds)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-16 px-2 py-1 text-xs bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded"
                                />
                                <span className="text-xs">min</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  value={block.timeAfter.seconds}
                                  onChange={(e) => updateTimeFilter(block.id, 'after', block.timeAfter!.minutes, Number(e.target.value))}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-16 px-2 py-1 text-xs bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded"
                                />
                                <span className="text-xs">sec</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Advanced Filters Panel */}
                      {expandedFilters.has(block.id) && (
                        <div className={`w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-b-lg shadow-lg p-4 space-y-3 ${SHOT_TYPE_COLORS[block.shotType].replace('bg-', 'border-t-4 border-t-')}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                              Shot #{idx + 1} Filters
                            </h4>
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

                            {/* Rally Position */}
                            <div>
                              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                Rally Position
                              </label>
                              <select
                                value={block.rallyPosition}
                                onChange={(e) => updateShot(block.id, { rallyPosition: Number(e.target.value) })}
                                className="w-full px-2 py-1 text-xs bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded"
                              >
                                <option value="0">Any Position</option>
                                <option value="1">1st shot of rally</option>
                                <option value="2">2nd shot of rally</option>
                                <option value="3">3rd shot of rally</option>
                                <option value="4">4th shot of rally</option>
                                <option value="5">5th shot of rally</option>
                                <option value="6">6th+ shot of rally</option>
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

                      {/* Down arrow to next shot */}
                      {idx < sequence.length - 1 && (
                        <div className="flex justify-center py-1">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-zinc-400 dark:text-zinc-500">
                            <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
                          </svg>
                        </div>
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

          {/* Time Filter Elements */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Drag time filters onto shots
            </label>
            <div className="flex flex-wrap gap-2">
              <div
                draggable
                onDragStart={() => handleDragStartTimeFilter('before')}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium text-sm cursor-move hover:shadow-lg transition-all hover:scale-105"
              >
                Before Time
              </div>
              <div
                draggable
                onDragStart={() => handleDragStartTimeFilter('after')}
                className="bg-teal-500 text-white px-4 py-2 rounded-lg font-medium text-sm cursor-move hover:shadow-lg transition-all hover:scale-105"
              >
                After Time
              </div>
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
