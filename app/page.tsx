'use client';

import { useState, useEffect, useRef } from 'react';
import { Shot, Rally } from '@/types/shot-data';
import { parseShotsCSV, getShotTypes, getPlayers } from '@/lib/parse-shots';
import { ShotFilter } from '@/lib/ollama-client';
import { extractRallies, findRallyForShot } from '@/lib/rally-analyzer';
import MinimalStatsView from '@/components/MinimalStatsView';
import NLPSearchBar from '@/components/NLPSearchBar';
import CourtHeatmap, { SHOT_TYPE_COLORS } from '@/components/CourtHeatmap';
import VideoTimelineScroller from '@/components/VideoTimelineScroller';
import RallyTimeline from '@/components/RallyTimeline';
import EnhancedFilters, { FilterState } from '@/components/EnhancedFilters';
import StatsDashboard from '@/components/StatsDashboard';
import ExportDialog from '@/components/ExportDialog';
import PlayerSelector from '@/components/PlayerSelector';
import { ChartBarIcon, ArrowDownTrayIcon, XMarkIcon, InformationCircleIcon, CpuChipIcon } from '@heroicons/react/24/outline';

export default function Home() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [filteredShots, setFilteredShots] = useState<Shot[]>([]);
  const [rallies, setRallies] = useState<Rally[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Player selection and renaming
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});

  // Video state
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [lockedShot, setLockedShot] = useState<Shot | null>(null); // Locked shot for isolated playback
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const shotListRef = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const shotListContainerRef = useRef<HTMLDivElement>(null);

  // UI state
  const [showStats, setShowStats] = useState(false);
  const [heatmapColorMode, setHeatmapColorMode] = useState<'type' | 'rating' | 'outcome'>('type');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [searchResponse, setSearchResponse] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<string>('');

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    shotTypes: [],
    players: [],
    zones: [],
    directions: [],
    courtSide: '',
    minRating: 0,
    maxRating: 13,
    winnerError: '',
    rallyLengthMin: 0,
    rallyLengthMax: 100,
  });

  // Trajectory matching state
  const [trajectoryMatchedShots, setTrajectoryMatchedShots] = useState<Shot[]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [drawnPath, setDrawnPath] = useState<{ x: number; y: number }[]>([]);

  // Available options
  const [shotTypes, setShotTypes] = useState<string[]>([]);
  const [players, setPlayers] = useState<string[]>([]);

  // Player rename function
  const handleRenamePlayer = (playerId: string, newName: string) => {
    setPlayerNames(prev => ({
      ...prev,
      [playerId]: newName
    }));
  };

  // Get display name for player
  const getPlayerDisplayName = (playerId: string) => {
    return playerNames[playerId] || playerId;
  };

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

        // Extract rallies
        const extractedRallies = extractRallies(parsedShots);
        setRallies(extractedRallies);

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
    let filtered = shots;

    // Selected player (highest priority)
    if (selectedPlayer) {
      filtered = filtered.filter((shot) => shot.player_id === selectedPlayer);
    }

    // Trajectory matching (second priority - if active, start with matched shots)
    if (trajectoryMatchedShots.length > 0) {
      filtered = trajectoryMatchedShots;
    }

    // Shot types
    if (filters.shotTypes.length > 0) {
      filtered = filtered.filter((shot) => filters.shotTypes.includes(shot.shot_label));
    }

    // Players (from advanced filters)
    if (filters.players.length > 0) {
      filtered = filtered.filter((shot) => filters.players.includes(shot.player_id));
    }

    // Zones
    if (filters.zones.length > 0) {
      filtered = filtered.filter((shot) => filters.zones.includes(shot.zone_shuttle));
    }

    // Directions
    if (filters.directions.length > 0) {
      filtered = filtered.filter((shot) => filters.directions.includes(shot.shot_direction));
    }

    // Court side
    if (filters.courtSide) {
      filtered = filtered.filter((shot) => shot.player_court_side === filters.courtSide);
    }

    // Rating
    filtered = filtered.filter(
      (shot) => shot.shot_rating >= filters.minRating && shot.shot_rating <= filters.maxRating
    );

    // Winner/Error
    if (filters.winnerError) {
      filtered = filtered.filter((shot) => shot.winner_error === filters.winnerError);
    }

    setFilteredShots(filtered);
  }, [shots, filters, trajectoryMatchedShots, selectedPlayer]);

  // No auto-scroll - let user manually scroll the shot list

  // Video time update
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      // If a shot is locked, check if we've reached the end of its segment
      if (lockedShot && lockedShot.endTime !== undefined) {
        if (video.currentTime >= lockedShot.endTime) {
          // Loop the shot by going back to start
          video.currentTime = lockedShot.startTime || 0;
        }
      } else if (isPlaying && filteredShots.length > 0) {
        // Normal playback: Find shot closest to current time
        let closestShot: Shot | null = null;
        let minDiff = Infinity;
        let currentShotIndex = -1;

        for (let i = 0; i < filteredShots.length; i++) {
          const shot = filteredShots[i];
          if (!shot.timestamp) continue;
          const timeDiff = Math.abs(shot.timestamp - video.currentTime);
          if (timeDiff < minDiff) {
            minDiff = timeDiff;
            closestShot = shot;
            currentShotIndex = i;
          }
        }

        // Update selected shot if changed
        if (closestShot && closestShot.index !== selectedShot?.index) {
          setSelectedShot(closestShot);
        }

        // Auto-skip to next filtered shot when current shot ends
        if (closestShot && closestShot.endTime !== undefined && currentShotIndex !== -1) {
          if (video.currentTime >= closestShot.endTime) {
            // Move to next shot in filtered list
            const nextShotIndex = currentShotIndex + 1;
            if (nextShotIndex < filteredShots.length) {
              const nextShot = filteredShots[nextShotIndex];
              if (nextShot.startTime !== undefined) {
                video.currentTime = nextShot.startTime;
                setSelectedShot(nextShot);
              }
            } else {
              // Reached end of filtered shots - loop back to first or pause
              video.pause();
            }
          }
        }
      }
    };

    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      // When play starts, if we have filtered shots and we're not already at a shot, jump to first filtered shot
      if (!lockedShot && filteredShots.length > 0 && video.currentTime < (filteredShots[0].startTime || 0)) {
        const firstShot = filteredShots[0];
        if (firstShot.startTime !== undefined) {
          video.currentTime = firstShot.startTime;
          setSelectedShot(firstShot);
        }
      }
    };
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [filteredShots, selectedShot, isPlaying, lockedShot]);

  // Handle search
  const handleSearch = (query: string, filter: ShotFilter, response?: string, analysis?: string) => {
    // Always apply filters if provided (even for analysis queries)
    const newFilters: FilterState = {
      shotTypes: filter.shotType || [],
      players: filter.player || [],
      zones: filter.zone || [],
      directions: filter.direction || [],
      courtSide: filter.courtSide || '',
      minRating: filter.minRating || 0,
      maxRating: filter.maxRating || 13,
      winnerError: filter.winnerError || '',
      rallyLengthMin: filter.rallyLength?.min || 0,
      rallyLengthMax: filter.rallyLength?.max || 100,
    };

    // Only apply filters if at least one filter is set
    const hasFilters = Object.values(newFilters).some(val =>
      (Array.isArray(val) && val.length > 0) ||
      (typeof val === 'string' && val !== '') ||
      (typeof val === 'number' && val !== 0 && val !== 13 && val !== 100)
    );

    if (hasFilters) {
      setFilters(newFilters);
    }

    setSearchResponse(response || '');

    if (analysis) {
      // Analysis query - show analysis
      setAnalysisResult(analysis);
    } else {
      // Filter-only query - clear analysis
      setAnalysisResult('');
    }
  };

  // Jump to shot in video
  const jumpToShot = (shot: Shot) => {
    // If clicking the same shot that's already locked, unlock it
    if (lockedShot && lockedShot.index === shot.index) {
      setLockedShot(null);
      setSelectedShot(null);
      if (videoRef.current) {
        videoRef.current.pause();
      }
      return;
    }

    // Lock the new shot and play only that shot's segment
    setLockedShot(shot);
    setSelectedShot(shot);
    if (videoRef.current && shot.startTime !== undefined) {
      videoRef.current.currentTime = shot.startTime;
      videoRef.current.play();
    }
  };

  // Seek video
  const seekVideo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  // Play filtered shots from the beginning
  const playFilteredFromStart = () => {
    if (videoRef.current && filteredShots.length > 0) {
      const firstShot = filteredShots[0];
      if (firstShot.startTime !== undefined) {
        videoRef.current.currentTime = firstShot.startTime;
        setSelectedShot(firstShot);
        setLockedShot(null); // Clear any locked shot
        videoRef.current.play();
      }
    }
  };

  // Handle trajectory matching
  const handleTrajectoryMatch = (matchingShots: Shot[]) => {
    setTrajectoryMatchedShots(matchingShots);
  };

  const toggleDrawMode = () => {
    setDrawMode(!drawMode);
    setDrawnPath([]);
    if (drawMode) {
      // Exiting draw mode - clear trajectory filter
      setTrajectoryMatchedShots([]);
    }
  };

  const clearPath = () => {
    setDrawnPath([]);
    setTrajectoryMatchedShots([]);
  };

  // Handle zone click on heatmap
  const handleZoneClick = (zone: string) => {
    setFilters((prev) => ({
      ...prev,
      zones: prev.zones.includes(zone)
        ? prev.zones.filter((z) => z !== zone)
        : [...prev.zones, zone],
    }));
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      shotTypes: [],
      players: [],
      zones: [],
      directions: [],
      courtSide: '',
      minRating: 0,
      maxRating: 13,
      winnerError: '',
      rallyLengthMin: 0,
      rallyLengthMax: 100,
    });
  };

  // Handle export
  const handleExport = async (selectedShots: Shot[], mode: 'separate' | 'concatenated') => {
    setShowExportDialog(false);
    alert('Export feature coming soon! 🚧');
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
            Loading shot data...
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Parsing CSV file and extracting rallies
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

  const currentRally = selectedShot ? findRallyForShot(selectedShot, rallies) : null;

  const scrollToDetailed = () => {
    const detailedSection = document.getElementById('detailed-view');
    detailedSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="h-screen overflow-y-scroll snap-y snap-mandatory">
      {/* Minimal Stats View - Full Viewport */}
      <section className="h-screen snap-start snap-always">
        <MinimalStatsView shots={shots} onExpand={scrollToDetailed} playerNames={playerNames} />
      </section>

      {/* Detailed Analysis View - Full Viewport */}
      <section id="detailed-view" className="min-h-screen snap-start bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 z-20">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                Shot Searcher
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {shots.length} total shots | {filteredShots.length} matching filters
              </p>
            </div>

            <div className="flex items-center gap-4">
              <PlayerSelector
                players={players}
                selectedPlayer={selectedPlayer}
                onSelectPlayer={setSelectedPlayer}
                playerNames={playerNames}
                onRenamePlayer={handleRenamePlayer}
              />
              <button
                onClick={() => setShowStats(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <ChartBarIcon className="h-5 w-5" />
                <span className="hidden sm:inline">Statistics</span>
              </button>
            </div>
          </div>

          {/* NLP Search Bar */}
          <div className="space-y-2">
            <NLPSearchBar
              onSearch={handleSearch}
              loading={loading}
              allShots={shots}
              selectedPlayer={selectedPlayer}
              playerDisplayName={selectedPlayer ? getPlayerDisplayName(selectedPlayer) : null}
            />

            {/* Search Response */}
            {searchResponse && (
              <div className="flex items-start gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg">
                <div className="flex-shrink-0 mt-0.5">
                  <InformationCircleIcon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                </div>
                <p className="text-sm text-zinc-900 dark:text-zinc-100 flex-1">
                  {searchResponse}
                </p>
                <button
                  onClick={() => setSearchResponse('')}
                  className="flex-shrink-0 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Analysis Result */}
            {analysisResult && (
              <div className="bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CpuChipIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      AI Performance Analysis
                    </h3>
                  </div>
                  <button
                    onClick={() => setAnalysisResult('')}
                    className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
                    {analysisResult}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Video + Heatmap */}
          <div className="lg:col-span-2 space-y-4">
            {/* Video Player and Court Heatmap */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Video Player */}
              <div className="md:col-span-3 bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden">
                <video
                  ref={videoRef}
                  src="/data/original-video.mp4"
                  controls
                  preload="metadata"
                  className="w-full bg-zinc-900"
                  poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080'%3E%3Crect width='1920' height='1080' fill='%2318181b'/%3E%3Ctext x='50%25' y='50%25' font-family='system-ui' font-size='48' fill='%2371717a' text-anchor='middle' dominant-baseline='middle'%3EClick to load video%3C/text%3E%3C/svg%3E"
                >
                  Your browser does not support the video tag.
                </video>
                {selectedShot && (
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-white">
                          {selectedShot.shot_label} by {selectedShot.player_id}
                        </h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                          Landing: {selectedShot.zone_shuttle} | {selectedShot.shot_direction}
                          {selectedShot.winner_error && (
                            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${
                              selectedShot.winner_error === 'winner'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            }`}>
                              {selectedShot.winner_error}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-zinc-900 dark:text-white">
                          {formatTime(selectedShot.timestamp || 0)}
                        </div>
                        {selectedShot.shot_rating > 0 && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            ⭐ {selectedShot.shot_rating.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Court Heatmap */}
              <div className="md:col-span-2 bg-white dark:bg-zinc-800 rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">
                      Court Heatmap
                    </h3>
                    {filters.zones.length > 0 && (
                      <button
                        onClick={() => setFilters((prev) => ({ ...prev, zones: [] }))}
                        className="text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                      >
                        Clear Zones ({filters.zones.length})
                      </button>
                    )}
                  </div>
                  <select
                    value={heatmapColorMode}
                    onChange={(e) => setHeatmapColorMode(e.target.value as any)}
                    className="text-xs px-2 py-1 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                  >
                    <option value="type">By Type</option>
                    <option value="rating">By Rating</option>
                    <option value="outcome">By Outcome</option>
                  </select>
                </div>
                <div className="flex items-start gap-3 h-[400px]">
                  <div className="flex-1 h-full">
                    <CourtHeatmap
                      shots={filteredShots}
                      highlightedShot={isPlaying ? selectedShot : null}
                      onZoneClick={handleZoneClick}
                      colorMode={heatmapColorMode}
                      selectedZones={filters.zones}
                      onTrajectoryMatch={handleTrajectoryMatch}
                      drawMode={drawMode}
                      drawnPath={drawnPath}
                      onPathChange={setDrawnPath}
                    />
                  </div>

                  {/* Legend beside the heatmap */}
                  <div className="flex-shrink-0 bg-zinc-50 dark:bg-zinc-900 rounded-md p-2 text-xs space-y-1 self-start w-24">
                    <div className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 text-[10px]">
                      {heatmapColorMode === 'type' && 'Types'}
                      {heatmapColorMode === 'rating' && 'Rating'}
                      {heatmapColorMode === 'outcome' && 'Result'}
                    </div>
                    {heatmapColorMode === 'type' && (
                      <>
                        {Object.entries(SHOT_TYPE_COLORS).map(([type, color]) => (
                          <div key={type} className="flex items-center gap-1.5">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-zinc-600 dark:text-zinc-400 capitalize text-[10px]">
                              {type}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                    {heatmapColorMode === 'rating' && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                          <span className="text-zinc-600 dark:text-zinc-400 text-[10px]">
                            &gt;10
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                          <span className="text-zinc-600 dark:text-zinc-400 text-[10px]">
                            7-10
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                          <span className="text-zinc-600 dark:text-zinc-400 text-[10px]">
                            4-7
                          </span>
                        </div>
                      </>
                    )}
                    {heatmapColorMode === 'outcome' && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                          <span className="text-zinc-600 dark:text-zinc-400 text-[10px]">Win</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                          <span className="text-zinc-600 dark:text-zinc-400 text-[10px]">Error</span>
                        </div>
                      </>
                    )}

                    {/* Draw Trajectory Buttons */}
                    <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 space-y-1.5">
                      <button
                        onClick={toggleDrawMode}
                        className={`w-full px-1.5 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${
                          drawMode
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-600'
                        }`}
                      >
                        {drawMode ? 'Exit' : 'Draw'}
                      </button>
                      <button
                        onClick={clearPath}
                        disabled={drawnPath.length === 0}
                        className={`w-full px-1.5 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${
                          drawnPath.length > 0
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600'
                        }`}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Video Timeline Scroller */}
            <VideoTimelineScroller
              shots={filteredShots}
              currentTime={currentTime}
              duration={videoDuration}
              onSeek={seekVideo}
              selectedShot={selectedShot}
            />

            {/* Rally Timeline */}
            {currentRally && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Current Rally
                </h3>
                <RallyTimeline
                  rally={currentRally}
                  onShotClick={(index) => {
                    const shot = shots.find((s) => s.index === index);
                    if (shot) jumpToShot(shot);
                  }}
                />
              </div>
            )}
          </div>

          {/* Right Column: Filters + Shot List */}
          <div className="space-y-4">
            {/* Enhanced Filters */}
            <EnhancedFilters
              filters={filters}
              onChange={setFilters}
              availableShotTypes={shotTypes}
              availablePlayers={players}
              onClear={clearFilters}
            />

            {/* Shot List */}
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden">
              <div className="sticky top-0 z-10 p-4 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-zinc-900 dark:text-white">
                    Shot List ({filteredShots.length})
                  </h2>
                  <button
                    onClick={() => setShowExportDialog(true)}
                    disabled={filteredShots.length === 0}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    Export
                  </button>
                </div>
                {filteredShots.length > 0 && (
                  <button
                    onClick={playFilteredFromStart}
                    className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                    Play Filtered Shots
                  </button>
                )}
              </div>
              <div
                ref={shotListContainerRef}
                className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-400 dark:scrollbar-thumb-zinc-600"
              >
                {filteredShots.map((shot) => (
                  <div
                    key={shot.index}
                    ref={(el) => { shotListRef.current[shot.index] = el; }}
                    onClick={() => jumpToShot(shot)}
                    className={`p-3 border-b border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors ${
                      lockedShot?.index === shot.index
                        ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-l-green-500'
                        : selectedShot?.index === shot.index
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
                            {shot.shot_label}
                          </span>
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">
                            {getPlayerDisplayName(shot.player_id)}
                          </span>
                          {lockedShot?.index === shot.index && (
                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs font-medium">
                              🔒 Locked
                            </span>
                          )}
                          {shot.winner_error && (
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                shot.winner_error === 'winner'
                                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                  : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                              }`}
                            >
                              {shot.winner_error}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">
                          {shot.zone_player} → {shot.zone_shuttle} | {shot.shot_direction}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-zinc-900 dark:text-white">
                          {formatTime(shot.timestamp || 0)}
                        </div>
                        {shot.shot_rating > 0 && (
                          <div className="text-xs text-amber-600 dark:text-amber-400">
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

      {/* Stats Dashboard Modal */}
      <StatsDashboard
        shots={filteredShots}
        isOpen={showStats}
        onClose={() => setShowStats(false)}
      />

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          shots={filteredShots}
          videoPath="/data/original-video.mp4"
          onClose={() => setShowExportDialog(false)}
          onExport={handleExport}
        />
      )}

      </section>
    </div>
  );
}
