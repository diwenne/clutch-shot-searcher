'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, FunnelIcon } from '@heroicons/react/24/outline';

export interface FilterState {
  shotTypes: string[];
  players: string[];
  zones: string[];
  directions: string[];
  courtSide: string;
  minRating: number;
  maxRating: number;
  winnerError: string;
  rallyLengthMin: number;
  rallyLengthMax: number;
}

interface EnhancedFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  availableShotTypes: string[];
  availablePlayers: string[];
  onClear: () => void;
}

const ZONES = ['zone-0', 'zone-1', 'zone-2', 'zone-3', 'zone-4', 'zone-5'];
const DIRECTIONS = ['cross/left', 'cross/right', 'straight'];
const COURT_SIDES = ['', 'top', 'bot'];
const WINNER_ERROR_OPTIONS = ['', 'winner', 'error'];

export default function EnhancedFilters({
  filters,
  onChange,
  availableShotTypes,
  availablePlayers,
  onClear,
}: EnhancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof FilterState, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key: 'shotTypes' | 'players' | 'zones' | 'directions', value: string) => {
    const currentArray = filters[key];
    const newArray = currentArray.includes(value)
      ? currentArray.filter((v) => v !== value)
      : [...currentArray, value];
    updateFilter(key, newArray);
  };

  const hasActiveFilters = () => {
    return (
      filters.shotTypes.length > 0 ||
      filters.players.length > 0 ||
      filters.zones.length > 0 ||
      filters.directions.length > 0 ||
      filters.courtSide !== '' ||
      filters.minRating > 0 ||
      filters.maxRating < 13 ||
      filters.winnerError !== '' ||
      filters.rallyLengthMin > 0 ||
      filters.rallyLengthMax < 100
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
          <span className="font-semibold text-zinc-900 dark:text-white">
            Advanced Filters
          </span>
          {hasActiveFilters() && (
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
              Active
            </span>
          )}
        </div>
        <div className="text-zinc-400">
          {isExpanded ? (
            <ChevronUpIcon className="h-5 w-5" />
          ) : (
            <ChevronDownIcon className="h-5 w-5" />
          )}
        </div>
      </button>

      {/* Filter Panel */}
      {isExpanded && (
        <div className="px-4 py-4 border-t border-zinc-200 dark:border-zinc-700 space-y-4">
          {/* Shot Types */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Shot Types
            </label>
            <div className="flex flex-wrap gap-2">
              {availableShotTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleArrayFilter('shotTypes', type)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    filters.shotTypes.includes(type)
                      ? 'bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:border-blue-400'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Players */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Players
            </label>
            <div className="flex flex-wrap gap-2">
              {availablePlayers.map((player) => (
                <button
                  key={player}
                  onClick={() => toggleArrayFilter('players', player)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    filters.players.includes(player)
                      ? 'bg-green-100 dark:bg-green-900 border-green-500 text-green-700 dark:text-green-300'
                      : 'bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:border-green-400'
                  }`}
                >
                  {player}
                </button>
              ))}
            </div>
          </div>

          {/* Zones */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Landing Zones
            </label>
            {/* Full court layout with 4 rows */}
            <div className="grid grid-cols-3 gap-2 max-w-xs">
              {/* Row 1: 5, 4, 3 */}
              {['zone-5', 'zone-4', 'zone-3'].map((zone) => (
                <button
                  key={`row1-${zone}`}
                  onClick={() => toggleArrayFilter('zones', zone)}
                  className={`aspect-square flex items-center justify-center text-sm rounded-md border transition-colors ${
                    filters.zones.includes(zone)
                      ? 'bg-purple-100 dark:bg-purple-900 border-purple-500 text-purple-700 dark:text-purple-300'
                      : 'bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:border-purple-400'
                  }`}
                >
                  {zone.split('-')[1]}
                </button>
              ))}
              {/* Row 2: 2, 1, 0 */}
              {['zone-2', 'zone-1', 'zone-0'].map((zone) => (
                <button
                  key={`row2-${zone}`}
                  onClick={() => toggleArrayFilter('zones', zone)}
                  className={`aspect-square flex items-center justify-center text-sm rounded-md border transition-colors ${
                    filters.zones.includes(zone)
                      ? 'bg-purple-100 dark:bg-purple-900 border-purple-500 text-purple-700 dark:text-purple-300'
                      : 'bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:border-purple-400'
                  }`}
                >
                  {zone.split('-')[1]}
                </button>
              ))}
              {/* Row 3: 0, 1, 2 */}
              {['zone-0', 'zone-1', 'zone-2'].map((zone) => (
                <button
                  key={`row3-${zone}`}
                  onClick={() => toggleArrayFilter('zones', zone)}
                  className={`aspect-square flex items-center justify-center text-sm rounded-md border transition-colors ${
                    filters.zones.includes(zone)
                      ? 'bg-purple-100 dark:bg-purple-900 border-purple-500 text-purple-700 dark:text-purple-300'
                      : 'bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:border-purple-400'
                  }`}
                >
                  {zone.split('-')[1]}
                </button>
              ))}
              {/* Row 4: 3, 4, 5 */}
              {['zone-3', 'zone-4', 'zone-5'].map((zone) => (
                <button
                  key={`row4-${zone}`}
                  onClick={() => toggleArrayFilter('zones', zone)}
                  className={`aspect-square flex items-center justify-center text-sm rounded-md border transition-colors ${
                    filters.zones.includes(zone)
                      ? 'bg-purple-100 dark:bg-purple-900 border-purple-500 text-purple-700 dark:text-purple-300'
                      : 'bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:border-purple-400'
                  }`}
                >
                  {zone.split('-')[1]}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Full court: 4 rows, net in middle (between rows 2 & 3)
            </p>
          </div>

          {/* Direction */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Shot Direction
            </label>
            <div className="flex flex-wrap gap-2">
              {DIRECTIONS.map((direction) => (
                <button
                  key={direction}
                  onClick={() => toggleArrayFilter('directions', direction)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    filters.directions.includes(direction)
                      ? 'bg-amber-100 dark:bg-amber-900 border-amber-500 text-amber-700 dark:text-amber-300'
                      : 'bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:border-amber-400'
                  }`}
                >
                  {direction}
                </button>
              ))}
            </div>
          </div>

          {/* Court Side */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Court Side
            </label>
            <div className="flex gap-2">
              {COURT_SIDES.map((side) => (
                <button
                  key={side || 'all'}
                  onClick={() => updateFilter('courtSide', side)}
                  className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                    filters.courtSide === side
                      ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                      : 'bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:border-indigo-400'
                  }`}
                >
                  {side || 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Shot Rating Range */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Shot Rating: {filters.minRating.toFixed(1)} - {filters.maxRating.toFixed(1)}
            </label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max="13"
                  step="0.5"
                  value={filters.minRating}
                  onChange={(e) => updateFilter('minRating', parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Min</div>
              </div>
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max="13"
                  step="0.5"
                  value={filters.maxRating}
                  onChange={(e) => updateFilter('maxRating', parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Max</div>
              </div>
            </div>
          </div>

          {/* Winner/Error */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Shot Outcome
            </label>
            <div className="flex gap-2">
              {WINNER_ERROR_OPTIONS.map((outcome) => (
                <button
                  key={outcome || 'all'}
                  onClick={() => updateFilter('winnerError', outcome)}
                  className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                    filters.winnerError === outcome
                      ? 'bg-emerald-100 dark:bg-emerald-900 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                      : 'bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:border-emerald-400'
                  }`}
                >
                  {outcome || 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Filters Button */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <button
              onClick={onClear}
              disabled={!hasActiveFilters()}
              className="w-full px-4 py-2 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
