'use client';

import { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, MicrophoneIcon, CpuChipIcon } from '@heroicons/react/24/outline';
import { ShotFilter } from '@/lib/ollama-client';

import { Shot } from '@/types/shot-data';

interface NLPSearchBarProps {
  onSearch: (query: string, filter: ShotFilter, response?: string, analysis?: string) => void;
  loading?: boolean;
  allShots?: Shot[];
  selectedPlayer?: string | null;
  playerDisplayName?: string | null;
}

const EXAMPLE_QUERIES = [
  'Show me all winning overhead shots',
  'Find cross-court drives',
  'High quality shots with rating above 10',
  'How can I improve?',
  'Where do I lose the most points?',
  'What are my weaknesses?',
];

export default function NLPSearchBar({ onSearch, loading, allShots, selectedPlayer, playerDisplayName }: NLPSearchBarProps) {
  const [query, setQuery] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setQuery(transcript);
          setIsListening(false);
          // Auto-submit after voice input
          handleSearch(transcript);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const handleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSearch = async (searchQuery?: string) => {
    const queryToSearch = searchQuery || query;
    if (!queryToSearch.trim()) return;

    console.log('🔍 Search initiated:', queryToSearch);
    setIsProcessing(true);

    try {
      // Filter shots to only selected player if one is selected
      const shotsToAnalyze = selectedPlayer
        ? (allShots || []).filter(shot => shot.player_id === selectedPlayer)
        : (allShots || []);

      // Detect video duration from last shot
      const videoLength = allShots && allShots.length > 0
        ? allShots[allShots.length - 1].timestamp || 5999
        : 5999;

      console.log('📡 Calling API with:', {
        query: queryToSearch,
        shotsCount: shotsToAnalyze.length,
        selectedPlayer: selectedPlayer || 'everyone',
        playerDisplayName: playerDisplayName || 'everyone',
        videoDuration: videoLength
      });

      const response = await fetch('/api/llm-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: queryToSearch,
          shots: shotsToAnalyze,
          allShots: allShots || [], // Send ALL shots for comparison
          selectedPlayer: selectedPlayer,
          playerDisplayName: playerDisplayName,
          videoDuration: videoLength
        }),
      });

      console.log('📥 API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`Failed to parse query: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ API response data:', data);

      if (data.type === 'analysis') {
        console.log('Type: Analysis');
        // Analysis query - show analysis AND apply suggested filter if available
        onSearch(queryToSearch, data.filter || {}, data.explanation, data.analysis);
      } else {
        console.log('Type: Filter');
        // Filter query - apply filters
        onSearch(queryToSearch, data.filter || {}, data.explanation);
      }
    } catch (error) {
      console.error('❌ Error processing search:', error);
      // Fall back to basic text search if LLM fails
      onSearch(queryToSearch, {}, 'AI search failed, showing all shots. Try rephrasing your query.');
    } finally {
      setIsProcessing(false);
      setShowExamples(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    setShowExamples(false);
    handleSearch(example);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowExamples(false);
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        {/* Search Icon */}
        <div className="absolute left-3 pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-zinc-400" />
        </div>

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowExamples(true)}
          placeholder={
            selectedPlayer && playerDisplayName
              ? `Ask about ${playerDisplayName}'s performance...`
              : "Search shots naturally... (e.g., 'show me winning smashes')"
          }
          className="w-full pl-10 pr-24 py-3 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400"
          disabled={isProcessing || loading}
        />

        {/* AI Badge */}
        <div className="absolute right-14 flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-medium rounded border border-zinc-300 dark:border-zinc-600">
          <CpuChipIcon className="h-3 w-3" />
          <span>AI</span>
        </div>

        {/* Voice Button */}
        <button
          onClick={handleVoiceInput}
          disabled={isProcessing || loading}
          className={`absolute right-2 p-2 rounded-md transition-all duration-200 ${
            isListening
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'
          }`}
          title="Voice search"
        >
          <MicrophoneIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Loading Indicator */}
      {(isProcessing || loading) && (
        <div className="absolute top-full mt-1 left-0 right-0 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded-md">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 dark:border-blue-400"></div>
            <span>Processing query with AI...</span>
          </div>
        </div>
      )}

      {/* Example Queries Dropdown */}
      {showExamples && !isProcessing && !loading && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <CpuChipIcon className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              <span>Example queries</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Try these natural language searches
            </p>
          </div>
          <div className="p-2">
            {EXAMPLE_QUERIES.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
              >
                <div className="flex items-start gap-2">
                  <MagnifyingGlassIcon className="h-4 w-4 mt-0.5 text-zinc-400 flex-shrink-0" />
                  <span>{example}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close examples */}
      {showExamples && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowExamples(false)}
        />
      )}
    </div>
  );
}
