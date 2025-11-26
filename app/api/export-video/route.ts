import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, unlink, rm } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

export const maxDuration = 1200; // 20 minutes timeout (matches nginx)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { shots, mode, videoPath, sequenceLength, sequenceMetadata } = await request.json();

    if (!shots || shots.length === 0) {
      return NextResponse.json({ error: 'No shots provided' }, { status: 400 });
    }

    // Ensure output directory exists
    const outputDir = path.join(process.cwd(), 'public', 'exports');
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    const inputVideoPath = path.join(process.cwd(), 'public', videoPath);

    if (!existsSync(inputVideoPath)) {
      return NextResponse.json({ error: `Video file not found: ${videoPath}` }, { status: 404 });
    }

    const timestamp = Date.now();

    // Always export as concatenated (mode parameter kept for backwards compatibility)
    // Create a folder for this export
      const exportFolderName = `padel_export_${new Date().toISOString().split('T')[0]}_${shots.length}shots`;
      const exportFolderPath = path.join(outputDir, exportFolderName);

      // Create export folder
      if (!existsSync(exportFolderPath)) {
        await mkdir(exportFolderPath, { recursive: true });
      }

      // Create a concatenated video
      const outputFileName = `concatenated_${shots.length}_shots.mp4`;
      const outputPath = path.join(exportFolderPath, outputFileName);

      console.log(`Processing ${shots.length} shots for concatenation...`);

      // Create concat file for FFmpeg - much faster than filter_complex
      const concatFileName = `concat_${timestamp}.txt`;
      const concatFilePath = path.join(exportFolderPath, concatFileName);
      const concatLines = [];

      // First, extract individual segments without re-encoding
      const segmentPaths = [];
      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        const start = shot.startTime || shot.timestamp;
        const end = shot.endTime;
        const duration = end ? (end - start) : (shot.duration || 3);

        const segmentPath = path.join(exportFolderPath, `segment_${i}.mp4`);
        segmentPaths.push(segmentPath);

        // Extract segment using copy codec (no re-encoding) - MUCH faster
        const extractCmd = `ffmpeg -i "${inputVideoPath}" -ss ${start} -t ${duration} -c copy -avoid_negative_ts make_zero -y "${segmentPath}"`;

        console.log(`Extracting segment ${i + 1}/${shots.length}...`);
        try {
          await execAsync(extractCmd, { maxBuffer: 1024 * 1024 * 50 });
        } catch (error: any) {
          console.error(`Error extracting segment ${i}:`, error.message);
          throw error;
        }

        concatLines.push(`file '${path.basename(segmentPath)}'`);
      }

      // Write concat file
      await writeFile(concatFilePath, concatLines.join('\n'));

      // Concatenate all segments using concat demuxer (fastest method)
      const command = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy -y "${outputPath}"`;

      console.log('Concatenating segments...');
      try {
        const { stdout, stderr } = await execAsync(command, { maxBuffer: 1024 * 1024 * 50 }); // 50MB buffer
        console.log('FFmpeg completed successfully');
      } catch (error: any) {
        console.error('FFmpeg error:', error.stderr || error.message);
        throw new Error(`FFmpeg processing failed: ${error.message}`);
      }

      // Clean up temporary segment files and concat file
      console.log('Cleaning up temporary files...');
      for (const segmentPath of segmentPaths) {
        try {
          await unlink(segmentPath);
        } catch (e) {
          console.warn(`Could not delete segment: ${segmentPath}`);
        }
      }
      try {
        await unlink(concatFilePath);
      } catch (e) {
        console.warn(`Could not delete concat file: ${concatFilePath}`);
      }

      // Generate documentation
      const docFileName = `shot_info.txt`;
      const docPath = path.join(exportFolderPath, docFileName);
      const documentation = generateDocumentation(shots, mode, outputFileName, sequenceLength, sequenceMetadata);
      await writeFile(docPath, documentation);

      // Create a zip file using native zip command
      const zipFileName = `${exportFolderName}.zip`;
      const zipPath = path.join(outputDir, zipFileName);

      console.log('Creating zip file...');
      try {
        // Use native zip command to create zip file
        // -r: recursive, -j: junk (don't store) directory paths, we'll add folder name manually
        await execAsync(`cd "${outputDir}" && zip -r "${zipFileName}" "${exportFolderName}"`);
      } catch (error: any) {
        console.error('Zip error:', error.message);
        throw new Error(`Failed to create zip file: ${error.message}`);
      }

      const fileStats = await import('fs').then(m => m.promises.stat(outputPath));
      const zipStats = await import('fs').then(m => m.promises.stat(zipPath));

      // Clean up the unzipped folder
      await rm(exportFolderPath, { recursive: true, force: true });

      return NextResponse.json({
        success: true,
        zipUrl: `/exports/${zipFileName}`,
        filename: zipFileName,
        folderName: exportFolderName,
        fileSize: zipStats.size,
        videoSize: fileStats.size,
        message: `Successfully exported ${shots.length} shots as concatenated video`
      });

  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export video', details: error.message },
      { status: 500 }
    );
  }
}

function generateDocumentation(
  shots: any[],
  mode: 'separate' | 'concatenated',
  outputFilename?: string | null,
  sequenceLength?: number,
  sequenceMetadata?: Array<{ index: number; note?: string }>
): string {
  const lines = [
    '='.repeat(80),
    'VIDEO EXPORT DOCUMENTATION',
    '='.repeat(80),
    '',
    `Export Mode: ${mode}`,
    `Total Shots: ${shots.length}`,
    `Export Date: ${new Date().toISOString()}`,
    '',
  ];

  if (mode === 'concatenated' && outputFilename) {
    lines.push(`Output File: ${outputFilename}`);
    lines.push('');
  }

  // If sequences, group shots by sequence
  if (sequenceLength && sequenceLength > 0) {
    lines.push('='.repeat(80));
    lines.push(`SEQUENCES (${Math.ceil(shots.length / sequenceLength)} sequences of ${sequenceLength} shots)`);
    lines.push('='.repeat(80));
    lines.push('');

    for (let i = 0; i < shots.length; i += sequenceLength) {
      const sequence = shots.slice(i, i + sequenceLength);
      const sequenceIdx = Math.floor(i / sequenceLength);
      const metadata = sequenceMetadata?.find(m => m.index === sequenceIdx);

      lines.push(`Sequence ${sequenceIdx + 1}:`);
      if (metadata?.note) {
        lines.push(`  NOTE: ${metadata.note}`);
      }
      lines.push('');

      sequence.forEach((shot, idx) => {
        const start = shot.startTime || shot.timestamp;
        const end = shot.endTime || (start + (shot.duration || 3));

        lines.push(`  Shot ${idx + 1} (Global Index: ${shot.index}):`);
        lines.push(`    Type: ${shot.shot_label}`);
        lines.push(`    Player: ${shot.player_id}`);
        lines.push(`    Time Range: ${start.toFixed(2)}s - ${end.toFixed(2)}s`);
        lines.push(`    Duration: ${(end - start).toFixed(2)}s`);
        if (shot.shot_direction) lines.push(`    Direction: ${shot.shot_direction}`);
        if (shot.winner_error) lines.push(`    Outcome: ${shot.winner_error}`);
        if (shot.shot_rating > 0) lines.push(`    Rating: ${shot.shot_rating.toFixed(1)}`);
        lines.push('');
      });

      lines.push('');
    }
  } else {
    lines.push('='.repeat(80));
    lines.push('SHOT LIST');
    lines.push('='.repeat(80));
    lines.push('');

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
  }

  if (mode === 'concatenated') {
    const totalDuration = shots.reduce((sum, shot) => {
      const start = shot.startTime || shot.timestamp;
      const end = shot.endTime || (start + (shot.duration || 3));
      return sum + (end - start);
    }, 0);
    lines.push('');
    lines.push('='.repeat(80));
    lines.push('SUMMARY');
    lines.push('='.repeat(80));
    lines.push(`Total Duration: ${totalDuration.toFixed(2)}s (${Math.floor(totalDuration / 60)}m ${Math.floor(totalDuration % 60)}s)`);
  }

  return lines.join('\n');
}
