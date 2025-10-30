'use client';

import { Shot } from '@/types/shot-data';
import { useState } from 'react';
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface ExportDialogProps {
  shots: Shot[];
  videoPath: string;
  onClose: () => void;
  onExport: (selectedShots: Shot[], mode: 'separate' | 'concatenated') => void;
}

export default function ExportDialog({ shots, videoPath, onClose, onExport }: ExportDialogProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(shots.map((s) => s.index))
  );
  const [exportMode, setExportMode] = useState<'separate' | 'concatenated'>('separate');

  const toggleShot = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  const toggleAll = () => {
    if (selectedIndices.size === shots.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(shots.map((s) => s.index)));
    }
  };

  const handleExport = () => {
    const selectedShots = shots.filter((s) => selectedIndices.has(s.index));
    onExport(selectedShots, exportMode);
  };

  const selectedShots = shots.filter((s) => selectedIndices.has(s.index));
  const totalDuration = selectedShots.reduce((sum, shot) => sum + (shot.duration || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <ArrowDownTrayIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Export Shots
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {selectedIndices.size} of {shots.length} shots selected • {totalDuration.toFixed(1)}s total
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>

        {/* Export Options */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 space-y-3">
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">
              Export Mode
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="separate"
                  checked={exportMode === 'separate'}
                  onChange={(e) => setExportMode(e.target.value as 'separate')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Separate Videos (one file per shot)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="concatenated"
                  checked={exportMode === 'concatenated'}
                  onChange={(e) => setExportMode(e.target.value as 'concatenated')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Single Video (all shots concatenated)
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Shot Selection */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Select Shots to Export
            </h3>
            <button
              onClick={toggleAll}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {selectedIndices.size === shots.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="space-y-2">
            {shots.map((shot) => {
              const isSelected = selectedIndices.has(shot.index);
              return (
                <label
                  key={shot.index}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                      : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-700/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleShot(shot.index)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
                        {shot.shot_label}
                      </span>
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        {shot.player_id}
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
                      {shot.timestamp?.toFixed(2)}s • Duration: {shot.duration?.toFixed(2)}s
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Export will include a documentation file
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={selectedIndices.size === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export {selectedIndices.size} Shot{selectedIndices.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
