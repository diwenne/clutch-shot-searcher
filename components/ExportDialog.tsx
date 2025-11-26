'use client';

import { Shot } from '@/types/shot-data';
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface ExportDialogProps {
  shots: Shot[];
  videoPath: string;
  onClose: () => void;
  onExport: (selectedShots: Shot[], mode: 'separate' | 'concatenated') => void;
  sequenceLength?: number;
  sequenceNotes?: Map<string, string>;
  getSequenceKey?: (sequence: Shot[]) => string;
}

export default function ExportDialog({ shots, videoPath, onClose, onExport, sequenceLength, sequenceNotes, getSequenceKey }: ExportDialogProps) {
  const handleExport = () => {
    // Always export all shots as concatenated
    onExport(shots, 'concatenated');
  };

  const totalDuration = shots.reduce((sum, shot) => sum + (shot.duration || 0), 0);

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
                {shots.length} shots • {totalDuration.toFixed(1)}s total
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

        {/* Shot Preview */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Shots to Export (Concatenated Video)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              All shots will be combined into a single video file
            </p>
          </div>

          <div className="space-y-2">
            {sequenceLength && sequenceLength > 0 ? (
              // Show sequences
              (() => {
                const sequences: Shot[][] = [];
                for (let i = 0; i < shots.length; i += sequenceLength) {
                  sequences.push(shots.slice(i, i + sequenceLength));
                }

                return sequences.map((sequence, seqIdx) => {
                  const sequenceKey = getSequenceKey ? getSequenceKey(sequence) : '';
                  const note = sequenceNotes?.get(sequenceKey);

                  return (
                    <div key={`seq-${seqIdx}`} className="border border-zinc-300 dark:border-zinc-600 rounded-lg overflow-hidden">
                      <div className="bg-zinc-100 dark:bg-zinc-800 p-2 border-b border-zinc-300 dark:border-zinc-600">
                        <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Sequence {seqIdx + 1}
                        </div>
                        {note && (
                          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 italic">
                            Note: {note}
                          </div>
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        {sequence.map((shot, idx) => (
                          <div key={shot.index} className="text-xs text-zinc-700 dark:text-zinc-300">
                            <span className="font-medium">{idx + 1}.</span> {shot.shot_label} by {shot.player_id}
                            {shot.winner_error && (
                              <span className={`ml-2 ${shot.winner_error === 'winner' ? 'text-green-600' : 'text-red-600'}`}>
                                ({shot.winner_error})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()
            ) : (
              // Show individual shots (no selection, just preview)
              shots.map((shot) => (
                <div
                  key={shot.index}
                  className="flex items-start gap-3 p-3 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
                >
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
                </div>
              ))
            )}
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
              disabled={shots.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export {shots.length} Shot{shots.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
