import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { shots, mode, videoPath } = await request.json();

    if (!shots || shots.length === 0) {
      return NextResponse.json({ error: 'No shots provided' }, { status: 400 });
    }

    // Ensure output directory exists
    const outputDir = path.join(process.cwd(), 'public', 'exports');
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    const inputVideoPath = path.join(process.cwd(), 'public', videoPath);
    const timestamp = Date.now();

    if (mode === 'concatenated') {
      // Create a concatenated video
      const outputFileName = `export_concatenated_${timestamp}.mp4`;
      const outputPath = path.join(outputDir, outputFileName);
      const filterComplex = [];
      const inputs = [];

      // Build FFmpeg filter complex for concatenation
      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        const start = shot.startTime || shot.timestamp;
        const duration = shot.endTime ? (shot.endTime - start) : (shot.duration || 3);

        // Extract each clip and scale/pad to same size
        filterComplex.push(
          `[0:v]trim=start=${start}:duration=${duration},setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v${i}]`,
          `[0:a]atrim=start=${start}:duration=${duration},asetpts=PTS-STARTPTS[a${i}]`
        );
        inputs.push(`[v${i}][a${i}]`);
      }

      // Concatenate all clips
      const concatFilter = `${inputs.join('')}concat=n=${shots.length}:v=1:a=1[outv][outa]`;
      filterComplex.push(concatFilter);

      const filterComplexStr = filterComplex.join(';');

      // Execute FFmpeg command
      const command = `ffmpeg -i "${inputVideoPath}" -filter_complex "${filterComplexStr}" -map "[outv]" -map "[outa]" -c:v libx264 -preset fast -crf 23 -c:a aac "${outputPath}"`;

      console.log('Executing FFmpeg command:', command);
      await execAsync(command, { maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer

      // Generate documentation
      const docFileName = `export_concatenated_${timestamp}.txt`;
      const docPath = path.join(outputDir, docFileName);
      const documentation = generateDocumentation(shots, mode);
      await writeFile(docPath, documentation);

      return NextResponse.json({
        success: true,
        videoUrl: `/exports/${outputFileName}`,
        docUrl: `/exports/${docFileName}`,
        message: `Successfully exported ${shots.length} shots as concatenated video`
      });

    } else {
      // Export separate videos
      const exportedFiles = [];

      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        const start = shot.startTime || shot.timestamp;
        const duration = shot.endTime ? (shot.endTime - start) : (shot.duration || 3);
        const outputFileName = `export_shot_${shot.index}_${timestamp}.mp4`;
        const outputPath = path.join(outputDir, outputFileName);

        const command = `ffmpeg -i "${inputVideoPath}" -ss ${start} -t ${duration} -c:v libx264 -preset fast -crf 23 -c:a aac "${outputPath}"`;

        console.log(`Exporting shot ${i + 1}/${shots.length}:`, command);
        await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });

        exportedFiles.push({
          shotIndex: shot.index,
          url: `/exports/${outputFileName}`,
          shotType: shot.shot_label,
          timestamp: start
        });
      }

      // Generate documentation
      const docFileName = `export_separate_${timestamp}.txt`;
      const docPath = path.join(outputDir, docFileName);
      const documentation = generateDocumentation(shots, mode);
      await writeFile(docPath, documentation);

      return NextResponse.json({
        success: true,
        files: exportedFiles,
        docUrl: `/exports/${docFileName}`,
        message: `Successfully exported ${shots.length} separate video files`
      });
    }

  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export video', details: error.message },
      { status: 500 }
    );
  }
}

function generateDocumentation(shots: any[], mode: 'separate' | 'concatenated'): string {
  const lines = [
    '='.repeat(80),
    'VIDEO EXPORT DOCUMENTATION',
    '='.repeat(80),
    '',
    `Export Mode: ${mode}`,
    `Total Shots: ${shots.length}`,
    `Export Date: ${new Date().toISOString()}`,
    '',
    '='.repeat(80),
    'SHOT LIST',
    '='.repeat(80),
    ''
  ];

  shots.forEach((shot, idx) => {
    const start = shot.startTime || shot.timestamp;
    const end = shot.endTime || (start + (shot.duration || 3));
    lines.push(`Shot ${idx + 1}:`);
    lines.push(`  Index: ${shot.index}`);
    lines.push(`  Type: ${shot.shot_label}`);
    lines.push(`  Player: ${shot.player_id}`);
    lines.push(`  Time Range: ${start.toFixed(2)}s - ${end.toFixed(2)}s`);
    lines.push(`  Duration: ${(end - start).toFixed(2)}s`);
    if (shot.shot_direction) {
      lines.push(`  Direction: ${shot.shot_direction}`);
    }
    if (shot.winner_error) {
      lines.push(`  Outcome: ${shot.winner_error}`);
    }
    if (shot.shot_rating > 0) {
      lines.push(`  Rating: ${shot.shot_rating.toFixed(1)}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}
