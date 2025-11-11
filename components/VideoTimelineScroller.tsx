'use client';

import { Shot } from '@/types/shot-data';
import { useMemo } from 'react';

interface VideoTimelineScrollerProps {
  shots: Shot[];
  allShots: Shot[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  selectedShot?: Shot | null;
  lockedShot?: Shot | null;
}

export default function VideoTimelineScroller({
  shots,
  allShots,
  currentTime,
  duration,
  onSeek,
  selectedShot,
  lockedShot,
}: VideoTimelineScrollerProps) {
  // Group shots into time segments (every 10 seconds)
  const timelineSegments = useMemo(() => {
    const segmentDuration = 10; // 10 seconds per segment
    const segmentCount = Math.ceil(duration / segmentDuration);
    const segments: { start: number; end: number; shots: Shot[] }[] = [];

    for (let i = 0; i < segmentCount; i++) {
      const start = i * segmentDuration;
      const end = Math.min((i + 1) * segmentDuration, duration);
      const segmentShots = shots.filter(
        (shot) =>
          shot.timestamp &&
          shot.timestamp >= start &&
          shot.timestamp < end
      );
      segments.push({ start, end, shots: segmentShots });
    }

    return segments;
  }, [shots, duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getShotColor = (shot: Shot) => {
    if (shot.winner_error === 'winner') return 'bg-green-500';
    if (shot.winner_error === 'error') return 'bg-red-500';
    if (shot.shot_label === 'serve') return 'bg-blue-500';
    if (shot.shot_label === 'overhead') return 'bg-purple-500';
    return 'bg-zinc-400';
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * duration;
    onSeek(time);
  };

  return (
    <div className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
        <span className="font-medium">Timeline</span>
        <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>

      {/* Timeline */}
      <div
        className="relative w-full h-16 bg-zinc-100 dark:bg-zinc-900 rounded-md cursor-pointer overflow-hidden"
        onClick={handleTimelineClick}
      >
        {/* Filtered shot overlay background */}
        {shots.length < allShots.length && (
          <div className="absolute inset-0">
            {shots.map((shot) => {
              const startPercent = ((shot.startTime || 0) / duration) * 100;
              const endPercent = ((shot.endTime || 0) / duration) * 100;
              const width = endPercent - startPercent;
              const isLocked = lockedShot?.index === shot.index;
              const isSelected = selectedShot?.index === shot.index;

              return (
                <div
                  key={`bg-${shot.index}`}
                  className={`absolute top-0 bottom-0 ${
                    isLocked
                      ? 'bg-green-400 dark:bg-green-600'
                      : isSelected
                      ? 'bg-blue-400 dark:bg-blue-600'
                      : 'bg-blue-300 dark:bg-blue-700'
                  }`}
                  style={{
                    left: `${startPercent}%`,
                    width: `${Math.max(width, 0.3)}%`,
                    opacity: isLocked ? 0.7 : isSelected ? 0.6 : 0.5,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Time segments */}
        <div className="absolute inset-0 flex">
          {timelineSegments.map((segment, index) => (
            <div
              key={index}
              className="flex-1 border-r border-zinc-200 dark:border-zinc-700 relative"
              style={{
                minWidth: `${(100 / timelineSegments.length)}%`,
              }}
            >
              {/* Segment label */}
              <div className="absolute top-0 left-1 text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">
                {formatTime(segment.start)}
              </div>

              {/* Shot markers in this segment */}
              <div className="absolute bottom-0 left-0 right-0 h-10 flex items-end justify-start gap-px px-0.5">
                {segment.shots.map((shot) => {
                  const isSelected = selectedShot?.index === shot.index;
                  const isLocked = lockedShot?.index === shot.index;
                  const heightPercent = shot.shot_rating
                    ? Math.min((shot.shot_rating / 13) * 100, 100)
                    : 30;

                  return (
                    <div
                      key={shot.index}
                      className={`flex-shrink-0 rounded-t-sm transition-all ${getShotColor(
                        shot
                      )} ${
                        isLocked
                          ? 'opacity-100 w-1.5 ring-2 ring-green-500'
                          : isSelected
                          ? 'opacity-100 w-1'
                          : 'opacity-70 hover:opacity-100 w-0.5'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                      title={`${shot.shot_label} - ${formatTime(shot.timestamp || 0)}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Current time indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-blue-600 dark:bg-blue-400 z-10"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full" />
        </div>

        {/* Hover indicator */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="w-full h-full hover:bg-blue-500/5 transition-colors" />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs flex-wrap">
        {shots.length < allShots.length && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-2 rounded bg-blue-300 dark:bg-blue-700 opacity-50" />
            <span className="text-zinc-600 dark:text-zinc-400 font-medium">Filtered shots</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded bg-green-500" />
          <span className="text-zinc-600 dark:text-zinc-400">Winner</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded bg-red-500" />
          <span className="text-zinc-600 dark:text-zinc-400">Error</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded bg-blue-500" />
          <span className="text-zinc-600 dark:text-zinc-400">Serve</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded bg-purple-500" />
          <span className="text-zinc-600 dark:text-zinc-400">Overhead</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-px h-3 bg-zinc-400" />
          <span className="text-zinc-500 dark:text-zinc-500 italic">Height = Rating</span>
        </div>
      </div>
    </div>
  );
}
