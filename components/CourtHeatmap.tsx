'use client';

import { Shot } from '@/types/shot-data';
import { useMemo } from 'react';

interface CourtHeatmapProps {
  shots: Shot[];
  highlightedShot?: Shot | null;
  onZoneClick?: (zone: string) => void;
  colorMode?: 'type' | 'rating' | 'outcome';
  selectedZones?: string[];
}

// Badminton court dimensions (normalized 0-1, vertical orientation)
// Court is vertical rectangle: width=100, height=200 (taller than wide)
const COURT_WIDTH = 100;
const COURT_HEIGHT = 200;

// Zone boundaries (6 zones: 0-5) - FULL vertical court layout with 4 EQUAL rows
// Each row is 50 units tall. The horizontal lines (service lines) are just court markings.
// Top half (opponent's side):
//   Row 1: zones 5, 4, 3 (left to right) - back court
//   Row 2: zones 2, 1, 0 (left to right) - front court
// Bottom half (your side):
//   Row 3: zones 0, 1, 2 (left to right) - front court
//   Row 4: zones 3, 4, 5 (left to right) - back court
const ZONES = [
  // Row 1 (top back court): 5, 4, 3
  { id: 'zone-5', key: 'top-zone-5', x: 0, y: 0, width: 33.33, height: 50, label: 'Zone 5' },
  { id: 'zone-4', key: 'top-zone-4', x: 33.33, y: 0, width: 33.34, height: 50, label: 'Zone 4' },
  { id: 'zone-3', key: 'top-zone-3', x: 66.67, y: 0, width: 33.33, height: 50, label: 'Zone 3' },
  // Row 2 (top front court): 2, 1, 0
  { id: 'zone-2', key: 'top-zone-2', x: 0, y: 50, width: 33.33, height: 50, label: 'Zone 2' },
  { id: 'zone-1', key: 'top-zone-1', x: 33.33, y: 50, width: 33.34, height: 50, label: 'Zone 1' },
  { id: 'zone-0', key: 'top-zone-0', x: 66.67, y: 50, width: 33.33, height: 50, label: 'Zone 0' },
  // Row 3 (bottom front court): 0, 1, 2
  { id: 'zone-0', key: 'bot-zone-0', x: 0, y: 100, width: 33.33, height: 50, label: 'Zone 0' },
  { id: 'zone-1', key: 'bot-zone-1', x: 33.33, y: 100, width: 33.34, height: 50, label: 'Zone 1' },
  { id: 'zone-2', key: 'bot-zone-2', x: 66.67, y: 100, width: 33.33, height: 50, label: 'Zone 2' },
  // Row 4 (bottom back court): 3, 4, 5
  { id: 'zone-3', key: 'bot-zone-3', x: 0, y: 150, width: 33.33, height: 50, label: 'Zone 3' },
  { id: 'zone-4', key: 'bot-zone-4', x: 33.33, y: 150, width: 33.34, height: 50, label: 'Zone 4' },
  { id: 'zone-5', key: 'bot-zone-5', x: 66.67, y: 150, width: 33.33, height: 50, label: 'Zone 5' },
];

const SHOT_TYPE_COLORS: Record<string, string> = {
  serve: '#3b82f6', // blue
  drive: '#10b981', // green
  volley: '#f59e0b', // amber
  lob: '#8b5cf6', // purple
  overhead: '#ef4444', // red
};

export default function CourtHeatmap({
  shots,
  highlightedShot,
  onZoneClick,
  colorMode = 'type',
  selectedZones = [],
}: CourtHeatmapProps) {
  // Calculate zone densities for heatmap
  const zoneDensities = useMemo(() => {
    const densities: Record<string, number> = {};
    ZONES.forEach((zone) => {
      const count = shots.filter((shot) => shot.zone_shuttle === zone.id).length;
      densities[zone.id] = count;
    });
    const maxDensity = Math.max(...Object.values(densities), 1);
    // Normalize to 0-1
    Object.keys(densities).forEach((zoneId) => {
      densities[zoneId] = densities[zoneId] / maxDensity;
    });
    return densities;
  }, [shots]);

  // Determine which players are on which side
  const { topPlayers, bottomPlayers } = useMemo(() => {
    const topSet = new Set<string>();
    const bottomSet = new Set<string>();

    shots.forEach((shot) => {
      if (shot.player_court_side === 'top') {
        topSet.add(shot.player_id);
      } else if (shot.player_court_side === 'bot') {
        bottomSet.add(shot.player_id);
      }
    });

    return {
      topPlayers: Array.from(topSet).join(', '),
      bottomPlayers: Array.from(bottomSet).join(', '),
    };
  }, [shots]);

  const getShotColor = (shot: Shot): string => {
    switch (colorMode) {
      case 'type':
        return SHOT_TYPE_COLORS[shot.shot_label] || '#6b7280';
      case 'rating':
        const rating = shot.shot_rating || 0;
        if (rating > 10) return '#ef4444'; // red - excellent
        if (rating > 7) return '#f59e0b'; // amber - good
        if (rating > 4) return '#10b981'; // green - average
        return '#6b7280'; // gray - poor
      case 'outcome':
        if (shot.winner_error === 'winner') return '#10b981'; // green
        if (shot.winner_error === 'error') return '#ef4444'; // red
        return '#6b7280'; // gray
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-b from-emerald-50 to-green-100 dark:from-emerald-950 dark:to-green-900 rounded-lg shadow-lg flex flex-col items-center justify-center overflow-hidden py-2 px-2 relative">
      {/* Top player label */}
      {topPlayers && (
        <div className="text-[8px] text-zinc-600 dark:text-zinc-300 font-medium mb-0.5 text-center">
          {topPlayers}
        </div>
      )}

      <svg
        viewBox="0 0 100 200"
        className="max-w-full max-h-full flex-1"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Court boundaries (outer rectangle) */}
        <rect
          x="0"
          y="0"
          width="100"
          height="200"
          fill="none"
          stroke="#059669"
          strokeWidth="1"
          className="dark:stroke-emerald-400"
        />

        {/* Net (horizontal line in the middle) */}
        <line
          x1="0"
          y1="100"
          x2="100"
          y2="100"
          stroke="#374151"
          strokeWidth="1.5"
          className="dark:stroke-gray-300"
        />

        {/* Center line (vertical, dividing left/right) */}
        <line
          x1="50"
          y1="0"
          x2="50"
          y2="200"
          stroke="#059669"
          strokeWidth="0.5"
          strokeDasharray="2,2"
          className="dark:stroke-emerald-400"
        />

        {/* Service lines (horizontal dividers for 4 rows) - closer to edges */}
        <line
          x1="0"
          y1="33"
          x2="100"
          y2="33"
          stroke="#059669"
          strokeWidth="0.5"
          strokeDasharray="2,2"
          className="dark:stroke-emerald-400"
        />
        <line
          x1="0"
          y1="167"
          x2="100"
          y2="167"
          stroke="#059669"
          strokeWidth="0.5"
          strokeDasharray="2,2"
          className="dark:stroke-emerald-400"
        />

        {/* Zone backgrounds with heatmap */}
        {ZONES.map((zone) => {
          const density = zoneDensities[zone.id] || 0;
          const opacity = 0.1 + density * 0.3;
          const isSelected = selectedZones.includes(zone.id);
          return (
            <g key={zone.key}>
              <rect
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                fill="#059669"
                opacity={opacity}
                className="cursor-pointer hover:opacity-50 transition-opacity dark:fill-emerald-400"
                onClick={() => onZoneClick?.(zone.id)}
              />
              {/* Selection indicator - subtle fill overlay */}
              {isSelected && (
                <>
                  <rect
                    x={zone.x}
                    y={zone.y}
                    width={zone.width}
                    height={zone.height}
                    fill="#3b82f6"
                    opacity="0.15"
                    className="pointer-events-none dark:fill-blue-400"
                  />
                  <rect
                    x={zone.x}
                    y={zone.y}
                    width={zone.width}
                    height={zone.height}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1"
                    className="pointer-events-none dark:stroke-blue-400"
                    opacity="0.4"
                  />
                </>
              )}
              <text
                x={zone.x + zone.width / 2}
                y={zone.y + zone.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[8px] fill-emerald-700 dark:fill-emerald-300 font-semibold pointer-events-none select-none"
                opacity="0.5"
              >
                {zone.id.split('-')[1]}
              </text>
            </g>
          );
        })}

        {/* Shot markers */}
        {shots.map((shot, index) => {
          const [x, y] = shot.normalized_coordinates;
          if (!x || !y) return null;

          const isHighlighted = highlightedShot?.index === shot.index;
          const color = getShotColor(shot);

          return (
            <g key={shot.index}>
              {/* Shot dot */}
              <circle
                cx={x * 100}
                cy={y * 200}
                r={isHighlighted ? 3 : 1.2}
                fill={color}
                opacity={isHighlighted ? 1 : 0.6}
                className="transition-all duration-200"
                strokeWidth={isHighlighted ? 0.8 : 0}
                stroke="white"
              />
              {/* Pulse animation for highlighted shot */}
              {isHighlighted && (
                <>
                  <circle
                    cx={x * 100}
                    cy={y * 200}
                    r={4}
                    fill="none"
                    stroke={color}
                    strokeWidth="0.8"
                    opacity="0.6"
                  >
                    <animate
                      attributeName="r"
                      from="3"
                      to="8"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.8"
                      to="0"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Bottom player label */}
      {bottomPlayers && (
        <div className="text-[8px] text-zinc-600 dark:text-zinc-300 font-medium mt-0.5 text-center">
          {bottomPlayers}
        </div>
      )}
    </div>
  );
}

// Export the shot type colors for use in the legend
export { SHOT_TYPE_COLORS };
