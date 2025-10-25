'use client';

import { useState, useEffect, useRef } from 'react';
import { Shot } from '@/types/shot-data';
import { parseShotsCSV, getShotTypes, getPlayers, filterShots } from '@/lib/parse-shots';

export default function Home() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [filteredShots, setFilteredShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedShotType, setSelectedShotType] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [minRating, setMinRating] = useState<number>(0);
  const [winnerError, setWinnerError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Video player
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Available filter options
  const [shotTypes, setShotTypes] = useState<string[]>([]);
  const [players, setPlayers] = useState<string[]>([]);

  // Load CSV on mount
  useEffect(() => {
    async function loadShots() {
      try {
        setLoading(true);
        const parsedShots = await parseShotsCSV('/data/detected_shots_v2.csv');
        setShots(parsedShots);
        setFilteredShots(parsedShots);
        setShotTypes(getShotTypes(parsedShots));
        setPlayers(getPlayers(parsedShots));
        setLoading(false);
      } catch (err) {
        console.error('Error loading shots:', err);
        setError('Failed to load shot data');
        setLoading(false);
      }
    }
    loadShots();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = filterShots(shots, {
      shotType: selectedShotType || undefined,
      player: selectedPlayer || undefined,
      minRating: minRating || undefined,
      winnerError: winnerError || undefined,
    });

    // Text search
    if (searchQuery) {
      filtered = filtered.filter(shot =>
        shot.shot_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shot.player_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shot.zone_shuttle.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredShots(filtered);
  }, [shots, selectedShotType, selectedPlayer, minRating, winnerError, searchQuery]);

  // Jump to shot in video
  const jumpToShot = (shot: Shot) => {
    setSelectedShot(shot);
    if (videoRef.current && shot.timestamp) {
      videoRef.current.currentTime = shot.timestamp;
      videoRef.current.play();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
            Loading shot data...
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Parsing CSV file
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
            Error: {error}
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Make sure detected_shots_v2.csv is in public/data/
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Shot Searcher
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {shots.length} total shots | {filteredShots.length} matching filters
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Filters & Search */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4 space-y-4">
              <h2 className="font-semibold text-zinc-900 dark:text-white">Filters</h2>

              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Search shots..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm"
                />
              </div>

              {/* Shot Type */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Shot Type
                </label>
                <select
                  value={selectedShotType}
                  onChange={(e) => setSelectedShotType(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm"
                >
                  <option value="">All Types</option>
                  {shotTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Player */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Player
                </label>
                <select
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm"
                >
                  <option value="">All Players</option>
                  {players.map(player => (
                    <option key={player} value={player}>{player}</option>
                  ))}
                </select>
              </div>

              {/* Min Rating */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Min Rating: {minRating}
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={minRating}
                  onChange={(e) => setMinRating(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Winner/Error */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Result
                </label>
                <select
                  value={winnerError}
                  onChange={(e) => setWinnerError(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm"
                >
                  <option value="">All</option>
                  <option value="winner">Winners</option>
                  <option value="error">Errors</option>
                </select>
              </div>

              <button
                onClick={() => {
                  setSelectedShotType('');
                  setSelectedPlayer('');
                  setMinRating(0);
                  setWinnerError('');
                  setSearchQuery('');
                }}
                className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 text-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Right: Shot List & Video */}
          <div className="lg:col-span-2 space-y-4">
            {/* Video Player */}
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden">
              <video
                ref={videoRef}
                src="/data/original-video.mp4"
                controls
                className="w-full"
              >
                Your browser does not support the video tag.
              </video>
              {selectedShot && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900">
                  <h3 className="font-semibold text-zinc-900 dark:text-white">
                    {selectedShot.shot_label} by {selectedShot.player_id}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Time: {formatTime(selectedShot.timestamp || 0)} | Rating: {selectedShot.shot_rating || 'N/A'}
                  </p>
                </div>
              )}
            </div>

            {/* Shot List */}
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
                <h2 className="font-semibold text-zinc-900 dark:text-white">
                  Shot List ({filteredShots.length})
                </h2>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {filteredShots.map((shot) => (
                  <div
                    key={shot.index}
                    onClick={() => jumpToShot(shot)}
                    className="p-4 border-b border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
                            {shot.shot_label}
                          </span>
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {shot.player_id}
                          </span>
                          {shot.winner_error && (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              shot.winner_error === 'winner'
                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            }`}>
                              {shot.winner_error}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">
                          {shot.zone_player} → {shot.zone_shuttle} | {shot.shot_direction}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-zinc-900 dark:text-white">
                          {formatTime(shot.timestamp || 0)}
                        </div>
                        {shot.shot_rating > 0 && (
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">
                            ⭐ {shot.shot_rating.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
