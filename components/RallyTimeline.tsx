'use client';

import { Rally } from '@/types/shot-data';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

interface RallyTimelineProps {
  rally: Rally;
  onShotClick?: (shotIndex: number) => void;
}

export default function RallyTimeline({ rally, onShotClick }: RallyTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getShotTypeColor = (shotType: string) => {
    switch (shotType) {
      case 'serve':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'drive':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'volley':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'lob':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'overhead':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200';
    }
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-800">
      {/* Rally Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-zinc-900 dark:text-white">
            Rally {rally.id.split('-')[1]}
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <span>{rally.shots.length} shots</span>
            <span>•</span>
            <span>{rally.duration?.toFixed(1)}s</span>
            {rally.winner && (
              <>
                <span>•</span>
                <span className="text-green-600 dark:text-green-400 font-medium">
                  Winner: {rally.winner}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="text-zinc-400">
          {isExpanded ? (
            <ChevronUpIcon className="h-5 w-5" />
          ) : (
            <ChevronDownIcon className="h-5 w-5" />
          )}
        </div>
      </button>

      {/* Rally Details (Expandable) */}
      {isExpanded && (
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-700 space-y-3">
          {/* Shot sequence visualization */}
          <div className="relative">
            <div className="flex items-center overflow-x-auto pb-2 space-x-2">
              {rally.shots.map((shot, index) => (
                <div key={shot.index} className="flex items-center">
                  {/* Shot card */}
                  <button
                    onClick={() => onShotClick?.(shot.index)}
                    className="flex-shrink-0 p-2 rounded-lg border border-zinc-200 dark:border-zinc-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer group"
                  >
                    <div className="flex flex-col items-center gap-1 min-w-[80px]">
                      {/* Shot number */}
                      <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                        #{index + 1}
                      </div>

                      {/* Shot type badge */}
                      <div
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getShotTypeColor(
                          shot.shot_label
                        )}`}
                      >
                        {shot.shot_label}
                      </div>

                      {/* Player */}
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        {shot.player_id.split('-')[1]}
                      </div>

                      {/* Zone info */}
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-500 font-mono">
                        {shot.zone_player} → {shot.zone_shuttle}
                      </div>

                      {/* Rating */}
                      {shot.shot_rating > 0 && (
                        <div className="flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                          <span>★</span>
                          <span>{shot.shot_rating.toFixed(1)}</span>
                        </div>
                      )}

                      {/* Winner/Error indicator */}
                      {shot.winner_error && (
                        <div
                          className={`text-[10px] font-medium ${
                            shot.winner_error === 'winner'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {shot.winner_error}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Arrow between shots */}
                  {index < rally.shots.length - 1 && (
                    <div className="flex-shrink-0 text-zinc-400 dark:text-zinc-600 mx-1">
                      →
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rally stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <div className="text-center">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Start</div>
              <div className="text-sm font-medium text-zinc-900 dark:text-white">
                {formatTime(rally.startTime)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">End</div>
              <div className="text-sm font-medium text-zinc-900 dark:text-white">
                {formatTime(rally.endTime)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Duration</div>
              <div className="text-sm font-medium text-zinc-900 dark:text-white">
                {rally.duration?.toFixed(1)}s
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Avg Rating</div>
              <div className="text-sm font-medium text-zinc-900 dark:text-white">
                {(
                  rally.shots.reduce((sum, shot) => sum + (shot.shot_rating || 0), 0) /
                  rally.shots.length
                ).toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
