'use client';

import { useState } from 'react';
import { UserIcon, PencilIcon, CheckIcon } from '@heroicons/react/24/outline';

interface PlayerSelectorProps {
  players: string[];
  selectedPlayer: string | null;
  onSelectPlayer: (player: string | null) => void;
  playerNames: Record<string, string>;
  onRenamePlayer: (playerId: string, newName: string) => void;
}

export default function PlayerSelector({
  players,
  selectedPlayer,
  onSelectPlayer,
  playerNames,
  onRenamePlayer,
}: PlayerSelectorProps) {
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const startEditing = (playerId: string) => {
    setEditingPlayer(playerId);
    setEditName(playerNames[playerId] || playerId);
  };

  const saveEdit = () => {
    if (editingPlayer && editName.trim()) {
      onRenamePlayer(editingPlayer, editName.trim());
    }
    setEditingPlayer(null);
  };

  const cancelEdit = () => {
    setEditingPlayer(null);
    setEditName('');
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <UserIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Viewing:
        </span>
      </div>

      <div className="relative">
        <select
          value={selectedPlayer || 'everyone'}
          onChange={(e) => onSelectPlayer(e.target.value === 'everyone' ? null : e.target.value)}
          className="pl-3 pr-10 py-2 text-sm font-medium bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white appearance-none cursor-pointer"
        >
          <option value="everyone">Everyone</option>
          {players.map((player) => (
            <option key={player} value={player}>
              {playerNames[player] || player}
            </option>
          ))}
        </select>
      </div>

      {selectedPlayer && (
        <div className="flex items-center gap-2">
          {editingPlayer === selectedPlayer ? (
            <>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                autoFocus
                className="px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white"
              />
              <button
                onClick={saveEdit}
                className="p-1 text-green-600 hover:text-green-700 dark:text-green-400"
              >
                <CheckIcon className="h-4 w-4" />
              </button>
              <button
                onClick={cancelEdit}
                className="p-1 text-zinc-600 hover:text-zinc-700 dark:text-zinc-400"
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={() => startEditing(selectedPlayer)}
              className="p-1.5 text-zinc-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors"
              title="Rename player"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
