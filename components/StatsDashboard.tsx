'use client';

import { Shot } from '@/types/shot-data';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useMemo } from 'react';
import {
  calculateAllPlayerStats,
  calculateShotTypeStats,
  calculateZoneStats,
  calculateOverallStats,
} from '@/lib/stats-calculator';

interface StatsDashboardProps {
  shots: Shot[];
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

export default function StatsDashboard({ shots, isOpen, onClose }: StatsDashboardProps) {
  const stats = useMemo(() => {
    if (shots.length === 0) return null;
    return {
      overall: calculateOverallStats(shots),
      players: calculateAllPlayerStats(shots),
      shotTypes: calculateShotTypeStats(shots),
      zones: calculateZoneStats(shots),
    };
  }, [shots]);

  if (!isOpen || !stats) return null;

  // Prepare data for charts
  const shotTypeChartData = stats.shotTypes.map((st) => ({
    name: st.shotType,
    count: st.count,
    winners: st.winners,
    errors: st.errors,
    avgRating: st.avgRating,
  }));

  const zoneChartData = stats.zones.map((z) => ({
    name: z.zone,
    count: z.count,
    successRate: (z.successRate * 100).toFixed(1),
    avgRating: z.avgRating.toFixed(1),
  }));

  const playerChartData = stats.players.map((p) => ({
    name: p.playerId.split('-')[1] || p.playerId,
    shots: p.totalShots,
    winners: p.winners,
    errors: p.errors,
    winRate: (p.winnerRate * 100).toFixed(1),
  }));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="min-h-screen px-4 py-8 flex items-start justify-center">
        <div className="relative w-full max-w-6xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                Statistics Dashboard
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {shots.length} shots analyzed
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-8">
            {/* Overall Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  Total Shots
                </div>
                <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                  {stats.overall.totalShots}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                  Winners
                </div>
                <div className="text-3xl font-bold text-green-900 dark:text-green-100 mt-1">
                  {stats.overall.totalWinners}
                </div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <div className="text-sm text-red-600 dark:text-red-400 font-medium">
                  Errors
                </div>
                <div className="text-3xl font-bold text-red-900 dark:text-red-100 mt-1">
                  {stats.overall.totalErrors}
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                  Avg Rating
                </div>
                <div className="text-3xl font-bold text-amber-900 dark:text-amber-100 mt-1">
                  {stats.overall.avgShotRating.toFixed(1)}
                </div>
              </div>
            </div>

            {/* Shot Type Distribution */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                Shot Type Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={shotTypeChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="count" fill="#3b82f6" name="Total" />
                  <Bar dataKey="winners" fill="#10b981" name="Winners" />
                  <Bar dataKey="errors" fill="#ef4444" name="Errors" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Player Performance */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                Player Performance
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={playerChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="winners" fill="#10b981" name="Winners" />
                    <Bar dataKey="errors" fill="#ef4444" name="Errors" />
                  </BarChart>
                </ResponsiveContainer>

                {/* Player Stats Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700">
                        <th className="text-left py-2 text-zinc-600 dark:text-zinc-400 font-medium">
                          Player
                        </th>
                        <th className="text-right py-2 text-zinc-600 dark:text-zinc-400 font-medium">
                          Shots
                        </th>
                        <th className="text-right py-2 text-zinc-600 dark:text-zinc-400 font-medium">
                          Win %
                        </th>
                        <th className="text-right py-2 text-zinc-600 dark:text-zinc-400 font-medium">
                          Avg Rating
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.players.map((player) => (
                        <tr
                          key={player.playerId}
                          className="border-b border-zinc-100 dark:border-zinc-800"
                        >
                          <td className="py-2 text-zinc-900 dark:text-white font-medium">
                            {player.playerId}
                          </td>
                          <td className="text-right py-2 text-zinc-700 dark:text-zinc-300">
                            {player.totalShots}
                          </td>
                          <td className="text-right py-2 text-zinc-700 dark:text-zinc-300">
                            {(player.winnerRate * 100).toFixed(1)}%
                          </td>
                          <td className="text-right py-2 text-zinc-700 dark:text-zinc-300">
                            {player.avgShotRating.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Zone Analysis */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                Zone Analysis
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={zoneChartData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry) => entry.name}
                    >
                      {zoneChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={zoneChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    />
                    <Bar dataKey="avgRating" fill="#f59e0b" name="Avg Rating" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
