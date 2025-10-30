'use client';

import { Shot } from '@/types/shot-data';
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ShareIcon } from '@heroicons/react/24/outline';

interface MinimalStatsViewProps {
  shots: Shot[];
  onExpand: () => void;
}

interface PlayerStats {
  playerId: string;
  totalShots: number;
  winners: number;
  errors: number;
  winRate: number;
  errorRate: number;
}

export default function MinimalStatsView({ shots, onExpand }: MinimalStatsViewProps) {
  const [currentScreen, setCurrentScreen] = useState(0); // 0 = match, 1-4 = players
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({}); // Map of original ID -> custom name
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [gameDate, setGameDate] = useState<string>(() => {
    const today = new Date();
    return `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
  });
  const [editingDate, setEditingDate] = useState(false);
  const touchStartX = useRef<number>(0);
  const lastScrollTime = useRef<number>(0);

  const stats = useMemo(() => {
    const totalShots = shots.length;
    const totalWinners = shots.filter((s) => s.winner_error === 'winner').length;
    const totalErrors = shots.filter((s) => s.winner_error === 'error').length;

    // Calculate per-player stats
    const playerMap = new Map<string, PlayerStats>();

    shots.forEach((shot) => {
      if (!shot.player_id) return;

      if (!playerMap.has(shot.player_id)) {
        playerMap.set(shot.player_id, {
          playerId: shot.player_id,
          totalShots: 0,
          winners: 0,
          errors: 0,
          winRate: 0,
          errorRate: 0,
        });
      }

      const player = playerMap.get(shot.player_id)!;
      player.totalShots++;
      if (shot.winner_error === 'winner') player.winners++;
      if (shot.winner_error === 'error') player.errors++;
    });

    // Calculate percentages
    playerMap.forEach((player) => {
      player.winRate = (player.winners / player.totalShots) * 100;
      player.errorRate = (player.errors / player.totalShots) * 100;
    });

    return {
      totalShots,
      totalWinners,
      totalErrors,
      winRate: (totalWinners / totalShots) * 100,
      errorRate: (totalErrors / totalShots) * 100,
      players: Array.from(playerMap.values()).sort((a, b) => b.totalShots - a.totalShots),
    };
  }, [shots]);

  const totalScreens = 1 + stats.players.length; // 1 match screen + player screens

  const nextScreen = useCallback(() => {
    setCurrentScreen((prev) => (prev + 1) % totalScreens);
  }, [totalScreens]);

  const prevScreen = useCallback(() => {
    setCurrentScreen((prev) => (prev - 1 + totalScreens) % totalScreens);
  }, [totalScreens]);

  const getPlayerName = (playerId: string) => {
    return playerNames[playerId] || playerId;
  };

  const handleNameChange = (playerId: string, newName: string) => {
    setPlayerNames((prev) => ({
      ...prev,
      [playerId]: newName,
    }));
  };

  // Handle horizontal scroll and swipe
  useEffect(() => {
    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!startX || !startY) return;

      const diffX = startX - e.touches[0].clientX;
      const diffY = startY - e.touches[0].clientY;

      // If horizontal swipe is dominant, prevent default to stop navigation
      if (Math.abs(diffX) > Math.abs(diffY)) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!startX || !startY) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;

      const diffX = startX - endX;
      const diffY = startY - endY;

      // Only trigger if horizontal swipe is dominant and significant
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        e.preventDefault();

        if (diffX > 0) {
          // Swiped left -> next screen
          nextScreen();
        } else {
          // Swiped right -> prev screen
          prevScreen();
        }
      }

      startX = 0;
      startY = 0;
    };

    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastScrollTime.current < 300) return;

      // Check for horizontal scroll (trackpad swipe)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 5) {
        e.preventDefault();
        e.stopPropagation();
        lastScrollTime.current = now;

        if (e.deltaX > 0) {
          nextScreen();
        } else {
          prevScreen();
        }
      }
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [nextScreen, prevScreen]);

  // Render match overview or player screen
  const renderScreen = () => {
    if (currentScreen === 0) {
      // Match Overview Screen
      return (
        <div key="match">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-light text-zinc-900 dark:text-white mb-3 tracking-tight">
              Match Analysis
            </h1>
            <p className="text-sm text-zinc-400 dark:text-zinc-600 font-light">
              {stats.totalShots} shots analyzed
            </p>
          </div>

          <div className="flex items-center justify-center gap-20 mb-8">
            <div className="text-center">
              <div className="text-6xl font-light text-emerald-600 dark:text-emerald-400 mb-3">
                {stats.totalWinners}
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600 font-light">
                Total Winners
              </div>
            </div>

            <div className="w-px h-20 bg-zinc-200 dark:bg-zinc-800"></div>

            <div className="text-center">
              <div className="text-6xl font-light text-red-600 dark:text-red-400 mb-3">
                {stats.totalErrors}
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600 font-light">
                Total Errors
              </div>
            </div>

            <div className="w-px h-20 bg-zinc-200 dark:bg-zinc-800"></div>

            <div className="text-center">
              <div className="text-6xl font-light text-zinc-900 dark:text-white mb-3">
                {((stats.totalWinners / stats.totalErrors) || 0).toFixed(2)}
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600 font-light">
                W/E Ratio
              </div>
            </div>
          </div>

          {/* Watermark */}
          <div className="text-center mt-12">
            <div className="text-xs text-zinc-400 dark:text-zinc-600 font-light">
              generated by <span className="font-medium">clutchapp.io</span> on{' '}
              {editingDate ? (
                <input
                  type="text"
                  defaultValue={gameDate}
                  autoFocus
                  onBlur={(e) => {
                    setGameDate(e.target.value);
                    setEditingDate(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setGameDate(e.currentTarget.value);
                      setEditingDate(false);
                    }
                  }}
                  className="inline-block bg-transparent border-b border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-white outline-none text-center px-1 w-24"
                />
              ) : (
                <span
                  onDoubleClick={() => setEditingDate(true)}
                  className="cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-500"
                >
                  {gameDate}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    } else {
      // Player Screen
      const player = stats.players[currentScreen - 1];
      const isEditing = editingPlayer === player.playerId;
      const displayName = getPlayerName(player.playerId);

      return (
        <div key={`player-${currentScreen}`}>
          <div className="text-center mb-12">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-600 mb-4 font-light">
              Player {currentScreen} of {stats.players.length}
            </div>
            {isEditing ? (
              <input
                type="text"
                defaultValue={displayName}
                autoFocus
                onBlur={(e) => {
                  handleNameChange(player.playerId, e.target.value);
                  setEditingPlayer(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleNameChange(player.playerId, e.currentTarget.value);
                    setEditingPlayer(null);
                  }
                }}
                className="text-6xl font-light text-zinc-900 dark:text-white mb-8 tracking-tight bg-transparent border-b-2 border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-white outline-none text-center px-4"
              />
            ) : (
              <h1
                onDoubleClick={() => setEditingPlayer(player.playerId)}
                className="text-6xl font-light text-zinc-900 dark:text-white mb-8 tracking-tight"
              >
                {displayName}
              </h1>
            )}
          </div>

          <div className="flex items-center justify-center gap-20 mb-12">
            <div className="text-center">
              <div className="text-6xl font-light text-zinc-900 dark:text-white mb-3">
                {player.totalShots}
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600 font-light">
                Shots
              </div>
            </div>

            <div className="text-center">
              <div className="text-6xl font-light text-emerald-600 dark:text-emerald-400 mb-3">
                {player.winners}
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600 font-light">
                Winners
              </div>
            </div>

            <div className="text-center">
              <div className="text-6xl font-light text-red-600 dark:text-red-400 mb-3">
                {player.errors}
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600 font-light">
                Errors
              </div>
            </div>
          </div>

          <div className="max-w-lg mx-auto mb-8">
            <div className="flex justify-between items-center mb-3">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600 font-light">
                Success Rate
              </div>
              <div className="text-2xl font-light text-zinc-900 dark:text-white">
                {player.winRate.toFixed(1)}%
              </div>
            </div>
            <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${player.winRate}%` }}
              ></div>
            </div>
          </div>

          {/* Watermark */}
          <div className="text-center mt-12">
            <div className="text-xs text-zinc-400 dark:text-zinc-600 font-light">
              generated by <span className="font-medium">clutchapp.io</span> on{' '}
              {editingDate ? (
                <input
                  type="text"
                  defaultValue={gameDate}
                  autoFocus
                  onBlur={(e) => {
                    setGameDate(e.target.value);
                    setEditingDate(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setGameDate(e.currentTarget.value);
                      setEditingDate(false);
                    }
                  }}
                  className="inline-block bg-transparent border-b border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-white outline-none text-center px-1 w-24"
                />
              ) : (
                <span
                  onDoubleClick={() => setEditingDate(true)}
                  className="cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-500"
                >
                  {gameDate}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div
      className="relative h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900 flex flex-col items-center justify-center px-16 overflow-hidden"
    >
      {/* Share Button */}
      <button
        className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center hover:scale-110 transition-all group"
      >
        <ShareIcon className="h-6 w-6 text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
      </button>

      {/* Screen Indicator */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-2">
        {Array.from({ length: totalScreens }).map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentScreen(idx)}
            className={`w-2 h-2 rounded-full transition-all ${
              idx === currentScreen
                ? 'bg-zinc-900 dark:bg-white w-8'
                : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl w-full">
        {renderScreen()}
      </div>

      {/* Navigation Arrows */}
      <>
        <button
          onClick={prevScreen}
          className="absolute left-8 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center hover:scale-110 transition-all group"
        >
          <ChevronLeftIcon className="h-8 w-8 text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
        </button>
        <button
          onClick={nextScreen}
          className="absolute right-8 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center hover:scale-110 transition-all group"
        >
          <ChevronRightIcon className="h-8 w-8 text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
        </button>
      </>

      {/* Scroll Indicator */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer group" onClick={onExpand}>
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-600 font-light">
          Explore
        </div>
        <ChevronDownIcon className="h-5 w-5 text-zinc-400 dark:text-zinc-600 animate-bounce group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
      </div>
    </div>
  );
}
