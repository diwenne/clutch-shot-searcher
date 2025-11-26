'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import ShareDialog from '@/components/ShareDialog';
import PlayerSelector from '@/components/PlayerSelector';
import SequenceBuilder from '@/components/SequenceBuilder';
import { ChartBarIcon, ArrowDownTrayIcon, XMarkIcon, InformationCircleIcon, CpuChipIcon, ShareIcon } from '@heroicons/react/24/outline';
import { serializeShareableState, generateShareURL, deserializeShareableState, validateSharedState, getShareParamFromURL } from '@/lib/share-state';

export default function Home() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [filteredShots, setFilteredShots] = useState<Shot[]>([]);
  const [baseFilteredShots, setBaseFilteredShots] = useState<Shot[]>([]); // Shots after filters, before sequence
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
  const [showReplayOverlay, setShowReplayOverlay] = useState(false);
  const [replayLabel, setReplayLabel] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const shotListRef = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const shotListContainerRef = useRef<HTMLDivElement>(null);

  // UI state
  const [showStats, setShowStats] = useState(false);
  const [heatmapColorMode, setHeatmapColorMode] = useState<'type' | 'rating' | 'outcome'>('type');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareURL, setShareURL] = useState('');
  const [searchResponse, setSearchResponse] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [exportProgress, setExportProgress] = useState<{ percent: number; status: string } | null>(null);

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

  // Sequence state
  const [sequenceLength, setSequenceLength] = useState<number>(0);
  const [isSequenceMode, setIsSequenceMode] = useState(false);
  const [nlpSequence, setNlpSequence] = useState<any[]>([]); // Sequence from NLP
  const [sequenceBlocks, setSequenceBlocks] = useState<any[]>([]); // Sequence blocks from SequenceBuilder
  const [autoExecuteSequence, setAutoExecuteSequence] = useState(false); // Trigger auto-execute from shared link
  const addSequenceBlockRef = useRef<((block: Partial<any>) => void) | null>(null); // Ref to addBlock function

  // Manually removed shots/sequences (temporary - resets when filters change)
  const [manuallyRemovedShots, setManuallyRemovedShots] = useState<Set<number>>(new Set());
  const [manuallyRemovedSequences, setManuallyRemovedSequences] = useState<Set<number>>(new Set());

  // Sequence notes (Map of sequence key to note text)
  // Key format: "shotIndex1-shotIndex2-..." for all shots in sequence
  const [sequenceNotes, setSequenceNotes] = useState<Map<string, string>>(() => {
    // Load notes from localStorage on mount
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sequenceNotes');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return new Map(Object.entries(parsed));
        } catch (e) {
          console.error('Failed to load sequence notes:', e);
        }
      }
    }
    return new Map();
  });

  // Track which sequence notes are expanded (Set of sequence keys)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

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

  // Manually remove a shot from the filtered list
  const removeShotFromList = (shotIndex: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent jumping to the shot
    if (confirm('Remove this shot from the list? (This is temporary - the shot will return if you regenerate the list)')) {
      setManuallyRemovedShots(prev => new Set(prev).add(shotIndex));
    }
  };

  // Manually remove a sequence from the filtered list
  const removeSequenceFromList = (sequenceIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Remove this sequence from the list? (This is temporary - the sequence will return if you regenerate the list)')) {
      setManuallyRemovedSequences(prev => new Set(prev).add(sequenceIndex));
    }
  };

  // Generate a unique key for a sequence based on shot indices
  const getSequenceKey = (sequence: Shot[]): string => {
    return sequence.map(s => s.index).join('-');
  };

  // Update sequence note
  const updateSequenceNote = (sequence: Shot[], note: string) => {
    const key = getSequenceKey(sequence);
    setSequenceNotes(prev => {
      const updated = new Map(prev);
      if (note.trim() === '') {
        updated.delete(key);
      } else {
        updated.set(key, note);
      }
      return updated;
    });
  };

  // Toggle note expansion for a sequence
  const toggleNoteExpansion = (sequenceKey: string) => {
    setExpandedNotes(prev => {
      const updated = new Set(prev);
      if (updated.has(sequenceKey)) {
        updated.delete(sequenceKey);
      } else {
        updated.add(sequenceKey);
      }
      return updated;
    });
  };

  // Helper function to calculate rally position for a shot
  const getRallyPosition = (shot: Shot): number => {
    // Find the shot's index in the full shots array
    const shotIndex = shots.findIndex(s => s.index === shot.index);
    if (shotIndex === -1) return 1;

    // Count backwards to find the start of the rally
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

  // Save sequence notes to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && sequenceNotes.size > 0) {
      const notesObject = Object.fromEntries(sequenceNotes);
      localStorage.setItem('sequenceNotes', JSON.stringify(notesObject));
    }
  }, [sequenceNotes]);

  // Load CSV on mount
  useEffect(() => {
    async function loadShots() {
      try {
        setLoading(true);
        const parsedShots = await parseShotsCSV('/data/detected_shots_v2.csv');
        setShots(parsedShots);
        setFilteredShots(parsedShots);
        setBaseFilteredShots(parsedShots);
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

  // Load shared state from URL parameter
  useEffect(() => {
    // Wait for data to load first
    if (shots.length === 0) return;

    const shareParam = getShareParamFromURL();
    if (!shareParam) return;

    console.log('🔗 Loading shared state from URL...');

    const sharedState = deserializeShareableState(shareParam);
    if (!sharedState) {
      console.error('❌ Invalid share link');
      alert('This share link is invalid or corrupted. Please check the URL and try again.');
      return;
    }

    // Validate the shared state
    const validation = validateSharedState(sharedState, shots);
    if (!validation.valid) {
      console.warn('⚠️ Share state validation warnings:', validation.warnings);
      if (validation.warnings.length > 0) {
        alert(`Warning: Some shared data may not match the current dataset:\n${validation.warnings.join('\n')}`);
      }
    }

    // Apply shared state
    console.log('✅ Applying shared state:', sharedState);

    // Apply player names first (before filters that might reference them)
    if (sharedState.pn) {
      setPlayerNames(sharedState.pn);
      console.log('  Applied player names');
    }

    if (sharedState.rm) {
      setManuallyRemovedShots(new Set(sharedState.rm));
      console.log('  Applied removed shots:', sharedState.rm.length);
    }

    if (sharedState.rmSeq) {
      setManuallyRemovedSequences(new Set(sharedState.rmSeq));
      console.log('  Applied removed sequences:', sharedState.rmSeq.length);
    }

    // Apply sequence state
    if (sharedState.seq && sharedState.seq.len > 0) {
      setSequenceLength(sharedState.seq.len);
      setSequenceNotes(new Map(Object.entries(sharedState.seq.notes)));
      setIsSequenceMode(true);
      console.log('  Applied sequence mode with length:', sharedState.seq.len);
      console.log('  Applied sequence notes:', Object.keys(sharedState.seq.notes).length);

      // Reconstruct filteredShots from saved shot indices
      if (sharedState.seq.shotIndices && sharedState.seq.shotIndices.length > 0) {
        const shotIndexSet = new Set(sharedState.seq.shotIndices);
        const reconstructed = shots.filter(shot => shotIndexSet.has(shot.index));

        // Preserve order from shared state
        const indexToShot = new Map(reconstructed.map(s => [s.index, s]));
        const orderedShots = sharedState.seq.shotIndices
          .map(idx => indexToShot.get(idx))
          .filter(s => s !== undefined) as Shot[];

        console.log('  ✅ Reconstructed filtered shots from indices:', orderedShots.length, 'shots');
        console.log('  First 5 reconstructed indices:', orderedShots.slice(0, 5).map(s => s.index));
        setFilteredShots(orderedShots);
        console.log('  ✅ setFilteredShots called with', orderedShots.length, 'shots');
      } else {
        console.warn('  ⚠️ No shot indices in shared sequence - falling back to filter application');
        // Fallback: apply filters manually (old behavior)
        let filtered = shots;

        if (sharedState.p) {
          filtered = filtered.filter((shot) => shot.player_id === sharedState.p);
        }
        if (sharedState.f) {
          const f = sharedState.f;
          if (f.shotTypes?.length > 0) filtered = filtered.filter((shot) => f.shotTypes.includes(shot.shot_label));
          if (f.players?.length > 0) filtered = filtered.filter((shot) => f.players.includes(shot.player_id));
          if (f.zones?.length > 0) filtered = filtered.filter((shot) => f.zones.includes(shot.zone_shuttle));
          if (f.directions?.length > 0) filtered = filtered.filter((shot) => f.directions.includes(shot.shot_direction));
          if (f.courtSide) filtered = filtered.filter((shot) => shot.player_court_side === f.courtSide);
          if (f.minRating !== undefined && f.maxRating !== undefined) {
            filtered = filtered.filter((shot) => shot.shot_rating >= f.minRating && shot.shot_rating <= f.maxRating);
          }
          if (f.winnerError) filtered = filtered.filter((shot) => shot.winner_error === f.winnerError);
        }
        setFilteredShots(filtered);
        console.log('  Applied filtered shots (fallback):', filtered.length);
      }

      // Also set the filters/player so UI shows them
      if (sharedState.f) setFilters(sharedState.f);
      if (sharedState.p) setSelectedPlayer(sharedState.p);

      // Apply sequence blocks to SequenceBuilder
      if (sharedState.seq.blocks && sharedState.seq.blocks.length > 0) {
        setSequenceBlocks(sharedState.seq.blocks);
        setNlpSequence(sharedState.seq.blocks); // This will populate the SequenceBuilder UI
        setAutoExecuteSequence(true); // Trigger auto-execute
        console.log('  Applied sequence blocks:', sharedState.seq.blocks.length);
      }
    } else {
      // NOT in sequence mode - apply filters normally
      // Apply these AFTER sequence state to ensure filter useEffect triggers
      if (sharedState.f) {
        setFilters(sharedState.f);
        console.log('  Applied filters (normal mode)');
      }

      if (sharedState.p) {
        setSelectedPlayer(sharedState.p);
        console.log('  Applied selected player (normal mode):', sharedState.p);
      }
    }

    console.log('✅ Shared state loaded successfully!');
  }, [shots]); // Only run when shots are loaded

  // Monitor filteredShots changes
  useEffect(() => {
    console.log('📊 FILTERED SHOTS CHANGED:', filteredShots.length, 'shots');
    console.log('   Stack trace:', new Error().stack?.split('\n').slice(2, 5).join('\n'));
  }, [filteredShots]);

  // Apply filters
  useEffect(() => {
    console.log('🔍 FILTER USEEFFECT TRIGGERED');
    console.log('📊 Current filters:', filters);
    console.log('📊 Total shots:', shots.length);
    console.log('📊 isSequenceMode:', isSequenceMode);

    let filtered = shots;
    console.log('Step 0 - Initial:', filtered.length);

    // Selected player (highest priority)
    if (selectedPlayer) {
      filtered = filtered.filter((shot) => shot.player_id === selectedPlayer);
      console.log('Step 1 - After player filter:', filtered.length, 'selectedPlayer:', selectedPlayer);
    }

    // Trajectory matching (second priority - if active, start with matched shots)
    if (trajectoryMatchedShots.length > 0) {
      filtered = trajectoryMatchedShots;
      console.log('Step 2 - After trajectory filter:', filtered.length);
    }

    // Shot types
    if (filters.shotTypes.length > 0) {
      filtered = filtered.filter((shot) => filters.shotTypes.includes(shot.shot_label));
      console.log('Step 3 - After shot type filter:', filtered.length, 'shotTypes:', filters.shotTypes);
    }

    // Players (from advanced filters)
    if (filters.players.length > 0) {
      filtered = filtered.filter((shot) => filters.players.includes(shot.player_id));
      console.log('Step 4 - After players filter:', filtered.length, 'players:', filters.players);
    }

    // Zones
    if (filters.zones.length > 0) {
      filtered = filtered.filter((shot) => filters.zones.includes(shot.zone_shuttle));
      console.log('Step 5 - After zones filter:', filtered.length, 'zones:', filters.zones);
    }

    // Directions
    if (filters.directions.length > 0) {
      console.log('🎯 DIRECTION FILTER ACTIVE');
      console.log('Filter directions:', filters.directions);
      console.log('Sample shot directions from data:', shots.slice(0, 10).map(s => s.shot_direction));
      const beforeDirectionFilter = filtered.length;
      filtered = filtered.filter((shot) => filters.directions.includes(shot.shot_direction));
      console.log('Step 6 - After direction filter:', filtered.length, 'from', beforeDirectionFilter);
      if (filtered.length === 0 && beforeDirectionFilter > 0) {
        console.log('⚠️ WARNING: Direction filter eliminated ALL shots!');
        console.log('All unique directions in remaining shots:', [...new Set(shots.map(s => s.shot_direction))]);
      }
    }

    // Court side
    if (filters.courtSide) {
      filtered = filtered.filter((shot) => shot.player_court_side === filters.courtSide);
      console.log('Step 7 - After court side filter:', filtered.length, 'courtSide:', filters.courtSide);
    }

    // Rating (only apply if not default range)
    const beforeRating = filtered.length;
    if (filters.minRating > 0 || filters.maxRating < 13) {
      filtered = filtered.filter(
        (shot) => shot.shot_rating >= filters.minRating && shot.shot_rating <= filters.maxRating
      );
      console.log('Step 8 - After rating filter:', filtered.length, 'from', beforeRating, `(${filters.minRating}-${filters.maxRating})`);
    } else {
      console.log('Step 8 - Skipping rating filter (default range 0-13)');
    }

    // Winner/Error
    if (filters.winnerError) {
      filtered = filtered.filter((shot) => shot.winner_error === filters.winnerError);
      console.log('Step 9 - After winner/error filter:', filtered.length, 'winnerError:', filters.winnerError);
    }

    // Exclude manually removed shots
    filtered = filtered.filter(shot => !manuallyRemovedShots.has(shot.index));
    console.log('Step 10 - After manual removal:', filtered.length);

    console.log('✅ FINAL FILTERED SHOTS:', filtered.length);

    // Always update baseFilteredShots (for SequenceBuilder input)
    setBaseFilteredShots(filtered);

    // Only update filteredShots if NOT in sequence mode
    // (in sequence mode, SequenceBuilder controls filteredShots)
    if (!isSequenceMode) {
      setFilteredShots(filtered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots.length, filters, trajectoryMatchedShots.length, selectedPlayer, manuallyRemovedShots.size, isSequenceMode]);

  // No auto-scroll - let user manually scroll the shot list

  // Video time update
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      // Update selected shot based on current time (for sequence playback)
      if (isSequenceMode && filteredShots.length > 0) {
        const currentShot = filteredShots.find(
          shot =>
            shot.startTime !== undefined &&
            shot.endTime !== undefined &&
            video.currentTime >= shot.startTime &&
            video.currentTime <= shot.endTime
        );
        if (currentShot) {
          setSelectedShot(prev => {
            // Only update if actually different to avoid unnecessary re-renders
            if (prev?.index !== currentShot.index) {
              return currentShot;
            }
            return prev;
          });
        }
      }

      // If a shot is locked, check if we've reached the end of its segment
      if (lockedShot && lockedShot.endTime !== undefined) {
        if (video.currentTime >= lockedShot.endTime) {
          // Check if this is a sequence lock (index -3) and we should jump to next sequence
          if (lockedShot.index === -3 && isSequenceMode && sequenceLength > 0) {
            // Find which sequence just finished
            let currentSeqIndex = -1;
            for (let i = 0; i < filteredShots.length; i += sequenceLength) {
              const seq = filteredShots.slice(i, i + sequenceLength);
              if (seq.length > 0 && seq[0].startTime === lockedShot.startTime) {
                currentSeqIndex = i / sequenceLength;
                break;
              }
            }

            // Jump to next sequence
            const nextSeqStart = (currentSeqIndex + 1) * sequenceLength;
            if (nextSeqStart < filteredShots.length) {
              const nextSequence = filteredShots.slice(nextSeqStart, nextSeqStart + sequenceLength);
              const firstShot = nextSequence[0];
              const lastShot = nextSequence[nextSequence.length - 1];

              if (firstShot.startTime !== undefined && lastShot.endTime !== undefined) {
                const seqLock: Shot = {
                  ...firstShot,
                  index: -3,
                  startTime: firstShot.startTime,
                  endTime: lastShot.endTime,
                };
                setLockedShot(seqLock);
                setSelectedShot(firstShot);
                video.currentTime = firstShot.startTime;
                // Keep playing
              } else {
                // No more sequences - pause
                video.pause();
                setShowReplayOverlay(true);
                setLockedShot(null);
              }
            } else {
              // No more sequences - pause
              video.pause();
              setShowReplayOverlay(true);
              setLockedShot(null);
            }
          } else {
            // Regular shot lock - show replay overlay
            video.pause();
            setShowReplayOverlay(true);
          }
        }
      } else if (isPlaying && filteredShots.length > 0) {
        // Normal playback: Find shot that's currently playing (within its time range)
        let activeShotIndex = -1;
        const HIGHLIGHT_GRACE = 1.5; // 1.5 second grace period for highlighting (both before and after)
        const START_GRACE = 2; // 2 second grace at beginning

        for (let i = 0; i < filteredShots.length; i++) {
          const shot = filteredShots[i];
          if (!shot.startTime || !shot.endTime) continue;

          // Check if current time is within shot's time range (with grace period before and after)
          if (video.currentTime >= shot.startTime - START_GRACE &&
              video.currentTime <= shot.endTime + HIGHLIGHT_GRACE) {
            activeShotIndex = i;
            break;
          }
        }

        // Update selected shot only if we're actually within a shot's time range
        if (activeShotIndex !== -1) {
          const activeShot = filteredShots[activeShotIndex];
          setSelectedShot(prev => {
            // Only update if actually different to avoid unnecessary re-renders
            if (prev?.index !== activeShot.index) {
              return activeShot;
            }
            return prev;
          });

          // Auto-skip to next filtered shot when current shot ends (with grace period at end)
          const SKIP_GRACE = 2; // 2 second grace at end before skipping
          if (activeShot.endTime !== undefined) {
            if (video.currentTime >= activeShot.endTime + SKIP_GRACE) {
              // Move to next shot in filtered list
              const nextShotIndex = activeShotIndex + 1;
              if (nextShotIndex < filteredShots.length) {
                const nextShot = filteredShots[nextShotIndex];
                if (nextShot.startTime !== undefined) {
                  // Start a bit before the shot (2 second grace at beginning)
                  const START_GRACE = 2;
                  video.currentTime = Math.max(0, nextShot.startTime - START_GRACE);
                  setSelectedShot(nextShot);
                }
              } else {
                // Reached end of filtered shots - loop back to first or pause
                video.pause();
              }
            }
          }
        } else {
          // Clear selection if not in any shot's range
          setSelectedShot(null);
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
  }, [filteredShots, isPlaying, lockedShot, isSequenceMode]);

  // Handle search
  // Convert ShotFilter to ShotBlock format for SequenceBuilder
  const convertShotFilterToBlock = (filter: ShotFilter): any => {
    // Detect video length from last shot
    const lastShot = shots[shots.length - 1];
    const videoLength = lastShot?.timestamp ?? 5999;
    const defaultBeforeMinutes = Math.floor(videoLength / 60);
    const defaultBeforeSeconds = Math.floor(videoLength % 60);

    // Helper to ensure array format
    const ensureArray = (value: any): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      return [value]; // Convert single value to array
    };

    return {
      id: Date.now().toString() + Math.random(),
      shotType: filter.shotType?.[0] || 'any',
      players: ensureArray(filter.player),
      zones: ensureArray(filter.zone),
      directions: ensureArray(filter.direction),
      courtSide: filter.courtSide || '',
      minRating: filter.minRating || 0,
      maxRating: filter.maxRating || 13,
      winnerError: filter.winnerError || '',
      rallyPosition: filter.rallyPosition || 0,
      // Handle time filters
      timeBefore: filter.timeBefore || null,
      timeAfter: filter.timeAfter || null,
    };
  };

  const handleSearch = (query: string, filter: ShotFilter, response?: string, analysis?: string) => {
    console.log('🔍 handleSearch called with filter:', filter);

    // Check if this is a sequence query
    if (filter.sequence && filter.sequence.length > 0) {
      console.log('🔗 SEQUENCE QUERY DETECTED - Converting to ShotBlocks');

      // Convert each ShotFilter in the sequence to ShotBlock format
      const sequenceBlocks = filter.sequence.map((shotFilter, idx) => {
        console.log(`Converting shot ${idx}:`, shotFilter);
        const block = convertShotFilterToBlock(shotFilter);
        console.log(`Converted to block ${idx}:`, block);
        return block;
      });
      console.log('✅ Converted sequence blocks:', sequenceBlocks);

      // Validate blocks before passing
      const validBlocks = sequenceBlocks.filter(block => {
        const isValid = block && typeof block === 'object' && typeof block.shotType === 'string';
        if (!isValid) {
          console.error('Invalid block detected:', block);
        }
        return isValid;
      });

      if (validBlocks.length !== sequenceBlocks.length) {
        console.error('Some blocks were invalid and filtered out');
      }

      // Pass to SequenceBuilder
      setNlpSequence(validBlocks);
      setSearchResponse(response || 'Sequence loaded into builder. Click "Find Matching Sequences" to search.');

      // Don't apply regular filters for sequence queries
      if (analysis) {
        setAnalysisResult(analysis);
      }
      return;
    }

    // Regular filter query (not a sequence)
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

    // Check if at least one meaningful filter is set
    const hasFilters =
      newFilters.shotTypes.length > 0 ||
      newFilters.players.length > 0 ||
      newFilters.zones.length > 0 ||
      newFilters.directions.length > 0 ||
      newFilters.courtSide !== '' ||
      newFilters.winnerError !== '' ||
      newFilters.minRating > 0 ||
      newFilters.maxRating < 13 ||
      newFilters.rallyLengthMin > 0 ||
      newFilters.rallyLengthMax < 100;

    console.log('📊 Filter check:', { hasFilters, newFilters });

    // Always apply filters (even if empty, to reset)
    setFilters(newFilters);

    // Clear sequence when doing regular search
    setNlpSequence([]);

    // Reset manually removed shots/sequences when filters change
    setManuallyRemovedShots(new Set());
    setManuallyRemovedSequences(new Set());

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
      setShowReplayOverlay(false);
      setReplayLabel('');
      if (videoRef.current) {
        videoRef.current.pause();
      }
      return;
    }

    // Lock the new shot and play only that shot's segment
    setLockedShot(shot);
    setSelectedShot(shot);
    setShowReplayOverlay(false);
    setReplayLabel(`${shot.shot_label} by ${getPlayerDisplayName(shot.player_id)}\n${formatTime(shot.timestamp || 0)}`);
    if (videoRef.current && shot.startTime !== undefined) {
      videoRef.current.currentTime = shot.startTime;
      videoRef.current.play();
    }
  };

  // Replay the current locked shot/sequence/rally
  const handleReplay = () => {
    if (videoRef.current && lockedShot && lockedShot.startTime !== undefined) {
      videoRef.current.currentTime = lockedShot.startTime;
      setShowReplayOverlay(false);
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
      if (isSequenceMode && sequenceLength > 0) {
        // In sequence mode: play first sequence
        const firstSequence = filteredShots.slice(0, sequenceLength);
        const firstShot = firstSequence[0];
        const lastShot = firstSequence[sequenceLength - 1];

        if (firstShot.startTime !== undefined && lastShot.endTime !== undefined) {
          // Create a sequence lock that will play the entire sequence
          const seqLock: Shot = {
            ...firstShot,
            index: -3, // Sequence lock marker
            startTime: firstShot.startTime,
            endTime: lastShot.endTime,
          };
          setLockedShot(seqLock);
          setSelectedShot(firstShot);
          setShowReplayOverlay(false);
          videoRef.current.currentTime = firstShot.startTime;
          videoRef.current.play();
        }
      } else {
        // Regular mode: play first shot
        const firstShot = filteredShots[0];
        if (firstShot.startTime !== undefined) {
          videoRef.current.currentTime = firstShot.startTime;
          setSelectedShot(firstShot);
          setLockedShot(null);
          setShowReplayOverlay(false);
          setReplayLabel('');
          videoRef.current.play();
        }
      }
    }
  };

  // Scroll to active shot in the list
  const scrollToActiveShot = () => {
    if (selectedShot && shotListRef.current[selectedShot.index] && shotListContainerRef.current) {
      const element = shotListRef.current[selectedShot.index];
      const container = shotListContainerRef.current;

      if (element && container) {
        // Get the position of the element relative to its parent
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Calculate how far down in the container the element currently is
        const elementRelativeTop = elementRect.top - containerRect.top;

        // Calculate desired scroll position to center the element
        const containerHeight = container.clientHeight;
        const elementHeight = element.offsetHeight;
        const desiredScrollOffset = (containerHeight / 2) - (elementHeight / 2);

        // Adjust the scroll position
        const newScrollTop = container.scrollTop + elementRelativeTop - desiredScrollOffset;

        container.scrollTo({
          top: newScrollTop,
          behavior: 'smooth',
        });
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

  // Handle zone click on heatmap - add to SequenceBuilder
  const handleZoneClick = (zone: string) => {
    if (addSequenceBlockRef.current) {
      addSequenceBlockRef.current({
        shotType: 'any',
        zones: [zone],
      });
    }
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
    console.log('🎬 Export started:', { shots: selectedShots.length, mode });
    setShowExportDialog(false);
    setExportProgress({ percent: 0, status: 'Starting export...' });

    try {
      setSearchResponse(`Processing ${selectedShots.length} shots...`);

      // Simulate realistic progress - most time is spent extracting segments
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (!prev) return null;
          const newPercent = Math.min(prev.percent + Math.random() * 2, 95);
          let status = 'Extracting video segments...';
          if (newPercent < 80) status = `Extracting segments... (${Math.floor((newPercent / 80) * selectedShots.length)}/${selectedShots.length})`;
          else if (newPercent < 90) status = 'Concatenating segments...';
          else if (newPercent < 95) status = 'Creating zip file...';
          return { percent: Math.floor(newPercent), status };
        });
      }, 500);

      console.log('📡 Calling API...');

      // Build sequence metadata if in sequence mode
      let sequenceMetadata: Array<{ index: number; note?: string }> | undefined;
      if (isSequenceMode && sequenceLength > 0) {
        sequenceMetadata = [];
        const numSequences = Math.ceil(selectedShots.length / sequenceLength);

        // Build map of visible sequence indices
        const sequences: Shot[][] = [];
        for (let i = 0; i < filteredShots.length; i += sequenceLength) {
          sequences.push(filteredShots.slice(i, i + sequenceLength));
        }
        const visibleSequences = sequences.filter((_, idx) => !manuallyRemovedSequences.has(idx));

        // For each visible sequence, add metadata with notes
        visibleSequences.forEach((seq, exportIndex) => {
          const sequenceKey = getSequenceKey(seq);
          const note = sequenceNotes.get(sequenceKey);
          sequenceMetadata!.push({
            index: exportIndex,
            note: note || undefined
          });
        });
      }

      const response = await fetch('/api/export-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shots: selectedShots,
          mode,
          videoPath: '/data/original-video.mp4',
          sequenceLength: isSequenceMode ? sequenceLength : undefined,
          sequenceMetadata: sequenceMetadata
        }),
      });

      clearInterval(progressInterval);
      setExportProgress({ percent: 95, status: 'Finalizing...' });

      console.log('📥 Response received:', response.status);
      const data = await response.json();
      console.log('📦 Data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Export failed');
      }

      setExportProgress({ percent: 100, status: 'Download starting...' });

      // Always concatenated mode - download zip file
      setSearchResponse(`✅ Export complete! Downloading zip...`);

      // Download zip file containing video + info txt
      const zipLink = document.createElement('a');
      zipLink.href = data.zipUrl;
      zipLink.download = data.filename;
      document.body.appendChild(zipLink);
      zipLink.click();
      document.body.removeChild(zipLink);

      setTimeout(() => {
        setSearchResponse(`✅ Downloaded! Check your Downloads folder for:
• ${data.filename} (${(data.fileSize / 1024 / 1024).toFixed(2)} MB)
  Contains: ${data.folderName}/
    - concatenated_${selectedShots.length}_shots.mp4
    - shot_info.txt`);
        setExportProgress(null);
      }, 1000);

    } catch (error: any) {
      console.error('Export error:', error);
      setSearchResponse(`❌ Export failed: ${error.message}`);
      setExportProgress(null);
      alert(`Export failed: ${error.message}\n\nMake sure FFmpeg is installed:\nmacOS: brew install ffmpeg\nLinux: sudo apt install ffmpeg`);
    }
  };

  // Generate shareable link
  const generateShareableLink = (): string | null => {
    try {
      console.log('🔗 GENERATING SHARE LINK');
      console.log('  filteredShots.length:', filteredShots.length);
      console.log('  baseFilteredShots.length:', baseFilteredShots.length);
      console.log('  isSequenceMode:', isSequenceMode);
      console.log('  sequenceLength:', sequenceLength);
      console.log('  filters:', JSON.stringify(filters, null, 2));
      console.log('  First 5 shot indices:', filteredShots.slice(0, 5).map(s => s.index));

      const encodedState = serializeShareableState({
        filters,
        selectedPlayer,
        sequenceLength,
        sequenceNotes,
        manuallyRemovedShots,
        manuallyRemovedSequences,
        playerNames,
        isSequenceMode,
        filteredShots, // Pass the actual filtered shots array
        sequenceBlocks, // Pass sequence blocks
      });

      const shareURL = generateShareURL(encodedState);
      console.log('✅ Generated share link:', shareURL.length, 'characters');
      return shareURL;
    } catch (error) {
      console.error('❌ Failed to generate share link:', error);
      return null;
    }
  };

  // Handle share button click
  const handleShare = () => {
    const url = generateShareableLink();
    if (url) {
      setShareURL(url);
      setShowShareDialog(true);
    } else {
      alert('Failed to generate share link. Please try again.');
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

            {/* Export Progress */}
            {exportProgress && (
              <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {exportProgress.status}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {exportProgress.percent}%
                  </p>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2">
                  <div
                    className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${exportProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Search Response */}
            {searchResponse && !exportProgress && (
              <div className="flex items-start gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg">
                <div className="flex-shrink-0 mt-0.5">
                  <InformationCircleIcon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                </div>
                <p className="text-sm text-zinc-900 dark:text-zinc-100 flex-1 whitespace-pre-line">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[calc(100vh-200px)]">
          {/* Left Column: Video + Heatmap (Sticky) */}
          <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-6 lg:self-start lg:overflow-y-auto lg:max-h-[calc(100vh-200px)]">
            {/* Video Player and Court Heatmap */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Video Player */}
              <div className="md:col-span-3 bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden relative">
                <div className="relative">
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

                  {/* Replay Overlay */}
                  {showReplayOverlay && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10">
                      <button
                        onClick={handleReplay}
                        className="group flex flex-col items-center gap-3 px-8 py-6 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-xl shadow-xl transition-all transform hover:scale-105"
                      >
                        <div className="flex items-center justify-center w-16 h-16 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-white">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                            Replay
                          </div>
                          <div className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                            {replayLabel}
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setShowReplayOverlay(false);
                          setLockedShot(null);
                          setReplayLabel('');
                        }}
                        className="px-4 py-2 text-sm text-white hover:text-zinc-300 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>

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
                          {selectedShot.startTime !== undefined && selectedShot.endTime !== undefined
                            ? `${formatTime(selectedShot.startTime)} - ${formatTime(selectedShot.endTime)}`
                            : formatTime(selectedShot.timestamp || 0)}
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
              allShots={shots}
              currentTime={currentTime}
              duration={videoDuration}
              onSeek={seekVideo}
              selectedShot={selectedShot}
              lockedShot={lockedShot}
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

          {/* Right Column: Filters + Shot List (Scrollable) */}
          <div className="space-y-4 lg:overflow-y-auto lg:max-h-[calc(100vh-200px)]">
            {/* Sequence Builder (replaces Enhanced Filters) */}
            <SequenceBuilder
              shots={baseFilteredShots}
              onSequenceMatch={(matchedShots, seqLength) => {
                setFilteredShots(matchedShots);
                setSequenceLength(seqLength);
                setIsSequenceMode(seqLength > 0);
                setManuallyRemovedShots(new Set()); // Reset manual removals
                setManuallyRemovedSequences(new Set());
                if (matchedShots.length > 0) {
                  setSearchResponse(`Found ${matchedShots.length / seqLength} matching sequences`);
                } else {
                  setSearchResponse('No sequences found matching your pattern');
                }
                setAutoExecuteSequence(false); // Reset after execution
              }}
              onSequenceBlocksChange={(blocks) => {
                setSequenceBlocks(blocks);
              }}
              onAddBlockRef={(addBlockFn) => {
                addSequenceBlockRef.current = addBlockFn;
              }}
              availablePlayers={players}
              playerNames={playerNames}
              availableShotTypes={shotTypes}
              nlpSequence={nlpSequence}
              autoExecute={autoExecuteSequence}
            />

            {/* Shot List */}
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden" key={`shotlist-${filteredShots.length}`}>
              <div className="sticky top-0 z-20 p-4 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-zinc-900 dark:text-white">
                    Shot List ({isSequenceMode
                      ? filteredShots.length - (manuallyRemovedSequences.size * sequenceLength)
                      : filteredShots.length}/{shots.length})
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        clearFilters();
                        setTrajectoryMatchedShots([]);
                        setNlpSequence([]);
                        setSelectedPlayer(null);
                        setIsSequenceMode(false);
                        setSequenceLength(0);
                        setSearchResponse('');
                        setAnalysisResult('');
                        setManuallyRemovedShots(new Set());
                        setManuallyRemovedSequences(new Set());
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-lg transition-colors"
                      title="Reset all filters and sequences"
                    >
                      <XMarkIcon className="h-4 w-4" />
                      Reset
                    </button>
                    <button
                      onClick={handleShare}
                      disabled={filteredShots.length === 0}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                      title="Share filtered shots and notes"
                    >
                      <ShareIcon className="h-4 w-4" />
                      Share
                    </button>
                    <button
                      onClick={() => setShowExportDialog(true)}
                      disabled={filteredShots.length === 0}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      Export
                    </button>
                  </div>
                </div>
                {filteredShots.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={playFilteredFromStart}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                      Play
                    </button>
                    {selectedShot && (
                      <button
                        onClick={scrollToActiveShot}
                        className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
                        </svg>
                        Go to Active
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div
                ref={shotListContainerRef}
                className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-400 dark:scrollbar-thumb-zinc-600"
              >
                {isSequenceMode && sequenceLength > 0 ? (
                  // Grouped sequence view
                  (() => {
                    const sequences: Shot[][] = [];
                    for (let i = 0; i < filteredShots.length; i += sequenceLength) {
                      sequences.push(filteredShots.slice(i, i + sequenceLength));
                    }

                    // Filter out manually removed sequences
                    const visibleSequences = sequences.filter((_, idx) => !manuallyRemovedSequences.has(idx));

                    return visibleSequences.map((sequence, seqIdx) => {
                      // Get the original sequence index before filtering
                      const originalSeqIdx = sequences.indexOf(sequence);
                      return (
                      <div key={`seq-${originalSeqIdx}`} className="border-b-4 border-zinc-300 dark:border-zinc-600">
                        {/* Sequence Header */}
                        <div className="p-2 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              Sequence {originalSeqIdx + 1}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  if (videoRef.current && sequence[0]) {
                                    const startShot = sequence[0];
                                    const endShot = sequence[sequence.length - 1];
                                    if (startShot.startTime !== undefined && endShot.endTime !== undefined) {
                                      const seqLock: Shot = {
                                        ...startShot,
                                        index: -3, // Sequence lock
                                        startTime: startShot.startTime,
                                        endTime: endShot.endTime,
                                      };
                                      // Build shot sequence description
                                      const shotSequence = sequence.map(s => s.shot_label).join(' → ');
                                      const timeRange = `${formatTime(startShot.timestamp || 0)} - ${formatTime(endShot.timestamp || 0)}`;
                                      videoRef.current.currentTime = startShot.startTime;
                                      setSelectedShot(startShot);
                                      setLockedShot(seqLock);
                                      setShowReplayOverlay(false);
                                      setReplayLabel(`Sequence ${originalSeqIdx + 1}: ${shotSequence}\n${timeRange}`);
                                      videoRef.current.play();
                                    }
                                  }
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded transition-colors"
                                title="Play this sequence"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                </svg>
                                Sequence
                              </button>
                              <button
                                onClick={(e) => removeSequenceFromList(originalSeqIdx, e)}
                                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                title="Remove sequence from list (temporary)"
                              >
                                <XMarkIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Sequence Notes */}
                        {(() => {
                          const sequenceKey = getSequenceKey(sequence);
                          const hasNote = sequenceNotes.has(sequenceKey);
                          // Auto-expand if note exists, otherwise check manual expansion state
                          const isExpanded = hasNote || expandedNotes.has(sequenceKey);

                          return (
                            <div className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                              {!hasNote && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleNoteExpansion(sequenceKey);
                                  }}
                                  className="w-full px-2 py-1.5 text-left flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                                >
                                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                    + Add note
                                  </span>
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  >
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              )}
                              {isExpanded && (
                                <div className="px-2 py-2">
                                  {hasNote && (
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">📝 Note</span>
                                    </div>
                                  )}
                                  <textarea
                                    value={sequenceNotes.get(sequenceKey) || ''}
                                    onChange={(e) => updateSequenceNote(sequence, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="Add notes for this sequence..."
                                    className="w-full px-2 py-1.5 text-xs bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={2}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Shots in sequence */}
                        {sequence.map((shot, idx) => (
                          <div
                            key={`seq-${seqIdx}-shot-${idx}`}
                            ref={(el) => { shotListRef.current[shot.index] = el; }}
                            onClick={() => jumpToShot(shot)}
                            className={`p-3 border-b border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors ${
                              lockedShot?.index === shot.index
                                ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-l-green-500'
                                : selectedShot?.index === shot.index
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500'
                                : ''
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-xs font-bold">
                                    {idx + 1}
                                  </span>
                                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
                                    {shot.shot_label}
                                  </span>
                                  <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded text-xs font-medium" title="Rally Position">
                                    R{getRallyPosition(shot)}
                                  </span>
                                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                    {getPlayerDisplayName(shot.player_id)}
                                  </span>
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
                                  {shot.startTime !== undefined && shot.endTime !== undefined
                                    ? `${formatTime(shot.startTime)} - ${formatTime(shot.endTime)}`
                                    : formatTime(shot.timestamp || 0)}
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
                    );
                    });
                  })()
                ) : (
                  // Regular shot list
                  filteredShots.map((shot) => (
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
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
                              {shot.shot_label}
                            </span>
                            <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded text-xs font-medium" title="Rally Position">
                              R{getRallyPosition(shot)}
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
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-xs font-medium text-zinc-900 dark:text-white">
                              {shot.startTime !== undefined && shot.endTime !== undefined
                                ? `${formatTime(shot.startTime)} - ${formatTime(shot.endTime)}`
                                : formatTime(shot.timestamp || 0)}
                            </div>
                            {shot.shot_rating > 0 && (
                              <div className="text-xs text-amber-600 dark:text-amber-400">
                                ⭐ {shot.shot_rating.toFixed(1)}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => removeShotFromList(shot.index, e)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Remove from list (temporary)"
                          >
                            <XMarkIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
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
      {showExportDialog && (() => {
        // Calculate visible shots after manual removals
        let visibleShots = filteredShots;

        if (isSequenceMode && sequenceLength > 0) {
          // In sequence mode: filter out removed sequences
          const sequences: Shot[][] = [];
          for (let i = 0; i < filteredShots.length; i += sequenceLength) {
            sequences.push(filteredShots.slice(i, i + sequenceLength));
          }
          const visibleSequences = sequences.filter((_, idx) => !manuallyRemovedSequences.has(idx));
          visibleShots = visibleSequences.flat();
        } else {
          // In regular mode: filter out manually removed shots
          visibleShots = filteredShots.filter(shot => !manuallyRemovedShots.has(shot.index));
        }

        return (
          <ExportDialog
            shots={visibleShots}
            videoPath="/data/original-video.mp4"
            onClose={() => setShowExportDialog(false)}
            onExport={handleExport}
            sequenceLength={isSequenceMode ? sequenceLength : undefined}
            sequenceNotes={sequenceNotes}
            getSequenceKey={getSequenceKey}
          />
        );
      })()}

      {/* Share Dialog */}
      {showShareDialog && (
        <ShareDialog
          shareURL={shareURL}
          onClose={() => setShowShareDialog(false)}
        />
      )}

      {/* Build Version */}
      <div className="fixed bottom-2 left-2 text-xs text-zinc-400 dark:text-zinc-600 font-mono">
        v1.2.1
      </div>

      </section>
    </div>
  );
}
