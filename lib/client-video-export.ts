/**
 * Client-side video export using browser APIs
 * No server required - all processing happens in the browser
 */

export interface ShotExport {
  index: number;
  startTime: number;
  endTime: number;
  shot_label: string;
  player_id: string;
}

/**
 * Download a single shot clip
 */
export async function exportSingleShot(
  videoElement: HTMLVideoElement,
  shot: ShotExport
): Promise<void> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;

  // Calculate duration
  const duration = shot.endTime - shot.startTime;

  // Seek to start time
  videoElement.currentTime = shot.startTime;
  await new Promise(resolve => {
    videoElement.onseeked = resolve;
  });

  // For now, just create a simple bookmark file with timestamps
  // Full video re-encoding requires MediaRecorder API which has limitations
  const bookmarkData = {
    shot: shot.shot_label,
    player: shot.player_id,
    startTime: shot.startTime,
    endTime: shot.endTime,
    duration: duration,
    instructions: `Use a video editor or ffmpeg to extract this clip:

ffmpeg -i input.mp4 -ss ${shot.startTime} -to ${shot.endTime} -c copy shot_${shot.index}.mp4

Or use online tools like:
- https://online-video-cutter.com/
- https://clideo.com/cut-video`
  };

  const blob = new Blob([JSON.stringify(bookmarkData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shot_${shot.index}_bookmark.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export multiple shots as separate files
 */
export async function exportSeparateShots(
  videoElement: HTMLVideoElement,
  shots: ShotExport[]
): Promise<void> {
  for (let i = 0; i < shots.length; i++) {
    await exportSingleShot(videoElement, shots[i]);
    // Small delay to avoid browser blocking multiple downloads
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

/**
 * Export concatenated shots info
 */
export async function exportConcatenatedInfo(
  shots: ShotExport[]
): Promise<void> {
  const totalDuration = shots.reduce((sum, shot) => sum + (shot.endTime - shot.startTime), 0);

  // Create ffmpeg concat file format
  const concatFileContent = shots.map((shot, idx) => {
    return `# Shot ${idx + 1}: ${shot.shot_label} by ${shot.player_id}
file 'input.mp4'
inpoint ${shot.startTime}
outpoint ${shot.endTime}`;
  }).join('\n\n');

  // Create detailed instructions
  const instructions = {
    total_shots: shots.length,
    total_duration: totalDuration,
    shots: shots.map(shot => ({
      index: shot.index,
      type: shot.shot_label,
      player: shot.player_id,
      startTime: shot.startTime,
      endTime: shot.endTime,
      duration: shot.endTime - shot.startTime
    })),
    ffmpeg_command: `ffmpeg -f concat -safe 0 -i concat_list.txt -c copy output.mp4`,
    concat_file: concatFileContent,
    instructions: `
1. Save the concat_list.txt file (included below)
2. Place your video file as 'input.mp4' in the same directory
3. Run: ffmpeg -f concat -safe 0 -i concat_list.txt -c copy output.mp4

Alternatively, use online tools:
- https://online-video-cutter.com/ (cut individual clips then merge)
- https://clideo.com/merge-video (merge multiple clips)
    `.trim()
  };

  // Download instructions JSON
  const blob = new Blob([JSON.stringify(instructions, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `export_instructions_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  // Download concat list file
  await new Promise(resolve => setTimeout(resolve, 300));
  const concatBlob = new Blob([concatFileContent], { type: 'text/plain' });
  const concatUrl = URL.createObjectURL(concatBlob);
  const concatLink = document.createElement('a');
  concatLink.href = concatUrl;
  concatLink.download = `concat_list_${Date.now()}.txt`;
  concatLink.click();
  URL.revokeObjectURL(concatUrl);
}

/**
 * Generate CSV export of shots
 */
export function exportShotsCSV(shots: ShotExport[]): void {
  const headers = ['Index', 'Shot Type', 'Player', 'Start Time (s)', 'End Time (s)', 'Duration (s)'];
  const rows = shots.map(shot => [
    shot.index,
    shot.shot_label,
    shot.player_id,
    shot.startTime.toFixed(2),
    shot.endTime.toFixed(2),
    (shot.endTime - shot.startTime).toFixed(2)
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shots_export_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Generate Python script for batch processing
 */
export function exportPythonScript(shots: ShotExport[], videoPath: string): void {
  const script = `#!/usr/bin/env python3
"""
Auto-generated video export script
Generated: ${new Date().toISOString()}
"""

import subprocess
import os

VIDEO_PATH = "${videoPath}"
OUTPUT_DIR = "exported_shots"

# Create output directory
os.makedirs(OUTPUT_DIR, exist_ok=True)

shots = [
${shots.map(shot => `    {
        "index": ${shot.index},
        "type": "${shot.shot_label}",
        "player": "${shot.player_id}",
        "start": ${shot.startTime},
        "end": ${shot.endTime}
    }`).join(',\n')}
]

print(f"Exporting {len(shots)} shots...")

for shot in shots:
    output_file = f"{OUTPUT_DIR}/shot_{shot['index']}_{shot['type']}.mp4"
    duration = shot['end'] - shot['start']

    cmd = [
        "ffmpeg",
        "-i", VIDEO_PATH,
        "-ss", str(shot['start']),
        "-t", str(duration),
        "-c", "copy",  # Copy codec for fast processing
        "-y",  # Overwrite output
        output_file
    ]

    print(f"Exporting shot {shot['index']}: {shot['type']}...")
    subprocess.run(cmd, check=True)

print(f"✅ Done! Exported {len(shots)} shots to {OUTPUT_DIR}/")

# To concatenate all shots:
# concat_file = "concat_list.txt"
# with open(concat_file, "w") as f:
#     for shot in shots:
#         f.write(f"file 'exported_shots/shot_{shot['index']}_{shot['type']}.mp4'\\n")
#
# subprocess.run([
#     "ffmpeg",
#     "-f", "concat",
#     "-safe", "0",
#     "-i", concat_file,
#     "-c", "copy",
#     "concatenated_output.mp4"
# ])
`;

  const blob = new Blob([script], { type: 'text/x-python' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `export_shots_${Date.now()}.py`;
  a.click();
  URL.revokeObjectURL(url);
}
