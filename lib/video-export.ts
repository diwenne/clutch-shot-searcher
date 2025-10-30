import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Shot } from '@/types/shot-data';

let ffmpeg: FFmpeg | null = null;

export async function loadFFmpeg(onProgress?: (progress: number) => void): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    console.log(message);
  });

  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(progress);
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
}

export async function exportShots(
  shots: Shot[],
  videoPath: string,
  mode: 'separate' | 'concatenated',
  onProgress?: (progress: number, status: string) => void
): Promise<{ files: { name: string; blob: Blob }[] }> {
  try {
    console.log('=== EXPORT STARTING ===');
    console.log('Video path:', videoPath);
    console.log('Number of shots:', shots.length);
    console.log('Mode:', mode);

    onProgress?.(0, 'Loading FFmpeg...');
    const ffmpegInstance = await loadFFmpeg((p) => onProgress?.(p * 0.1, 'Loading FFmpeg...'));
    console.log('FFmpeg loaded successfully');

    // Fetch the source video
    onProgress?.(0.1, 'Loading source video...');
    console.log('Fetching video from:', videoPath);

    const videoResponse = await fetch(videoPath);
    console.log('Fetch response status:', videoResponse.status, videoResponse.statusText);

    if (!videoResponse.ok) {
      throw new Error(`Failed to load video: ${videoResponse.statusText}`);
    }

    const videoBlob = await videoResponse.blob();
    console.log('Video blob created, size:', videoBlob.size, 'bytes');

    console.log('Converting blob to FFmpeg data...');
    const videoData = await fetchFile(videoBlob);
    console.log('Video data converted, length:', videoData.length, 'bytes');

    console.log('Writing to FFmpeg filesystem...');
    await ffmpegInstance.writeFile('input.mp4', videoData);
    console.log('✓ Video written to FFmpeg FS');

    const files: { name: string; blob: Blob }[] = [];

  if (mode === 'separate') {
    // Export each shot as a separate file
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const progress = 0.1 + (i / shots.length) * 0.8;
      onProgress?.(progress, `Exporting shot ${i + 1}/${shots.length}...`);

      const outputName = `shot_${String(i + 1).padStart(3, '0')}_${shot.shot_label}_${shot.player_id.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;

      console.log(`Processing shot ${i + 1}: ${outputName}`);
      console.log(`Start: ${shot.startTime}, End: ${shot.endTime}`);

      try {
        // List files in FFmpeg FS to verify input exists
        const fileList = await ffmpegInstance.listDir('/');
        console.log('Files in FFmpeg FS:', fileList);

        // Trim video from startTime to endTime
        const startTime = shot.startTime || shot.timestamp || 0;
        const duration = (shot.endTime || (shot.timestamp || 0) + 1) - startTime;

        console.log(`FFmpeg command: -ss ${startTime} -i input.mp4 -t ${duration} -c copy ${outputName}`);

        await ffmpegInstance.exec([
          '-ss',
          String(startTime),
          '-i',
          'input.mp4',
          '-t',
          String(duration),
          '-c',
          'copy',
          outputName,
        ]);

        console.log(`FFmpeg exec completed for ${outputName}`);

        const data = await ffmpegInstance.readFile(outputName);
        console.log(`Read file ${outputName}, size: ${data.length}`);

        // Convert Uint8Array to Blob
        const uint8Data = data instanceof Uint8Array ? data : new Uint8Array(data as any);
        files.push({
          name: outputName,
          blob: new Blob([uint8Data.buffer], { type: 'video/mp4' }),
        });

        // Clean up
        await ffmpegInstance.deleteFile(outputName);
      } catch (error) {
        console.error(`Failed to process shot ${i + 1}:`, error);
        throw error;
      }
    }
  } else {
    // Concatenate all shots into a single video
    // First, extract each shot as a temporary file
    const tempFiles: string[] = [];

    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const progress = 0.1 + (i / shots.length) * 0.4;
      onProgress?.(progress, `Extracting shot ${i + 1}/${shots.length}...`);

      const tempName = `temp_${String(i).padStart(3, '0')}.mp4`;
      tempFiles.push(tempName);

      // Extract this shot
      await ffmpegInstance.exec([
        '-ss',
        String(shot.startTime || shot.timestamp || 0),
        '-i',
        'input.mp4',
        '-t',
        String((shot.endTime || (shot.timestamp || 0) + 1) - (shot.startTime || shot.timestamp || 0)),
        '-c',
        'copy',
        '-avoid_negative_ts',
        'make_zero',
        tempName,
      ]);
    }

    onProgress?.(0.5, 'Creating concat list...');

    // Create concat list with the temp files
    const concatList = tempFiles.map(f => `file '${f}'`).join('\n');
    await ffmpegInstance.writeFile('concat_list.txt', concatList);

    onProgress?.(0.6, 'Concatenating shots...');

    // Concatenate the temp files
    await ffmpegInstance.exec([
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      'concat_list.txt',
      '-c',
      'copy',
      'output_concatenated.mp4',
    ]);

    const data = await ffmpegInstance.readFile('output_concatenated.mp4');
    // Convert Uint8Array to Blob
    const uint8Data = data instanceof Uint8Array ? data : new Uint8Array(data as any);
    files.push({
      name: 'concatenated_shots.mp4',
      blob: new Blob([uint8Data.buffer], { type: 'video/mp4' }),
    });

    // Clean up temp files
    await ffmpegInstance.deleteFile('concat_list.txt');
    await ffmpegInstance.deleteFile('output_concatenated.mp4');
    for (const tempFile of tempFiles) {
      await ffmpegInstance.deleteFile(tempFile);
    }
  }

    // Clean up input file
    await ffmpegInstance.deleteFile('input.mp4');

    onProgress?.(0.9, 'Generating documentation...');

    // Generate documentation file
    const doc = generateDocumentation(shots, mode);
    files.push({
      name: 'export_info.txt',
      blob: new Blob([doc], { type: 'text/plain' }),
    });

    onProgress?.(1, 'Export complete!');

    return { files };
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}

function generateDocumentation(shots: Shot[], mode: 'separate' | 'concatenated'): string {
  const now = new Date();
  const dateStr = now.toLocaleString();

  let doc = `CLUTCH SHOT EXPORT
==================
Generated: ${dateStr}
Export Mode: ${mode === 'separate' ? 'Separate Videos' : 'Concatenated Video'}
Total Shots: ${shots.length}

`;

  if (mode === 'separate') {
    doc += `FILES EXPORTED:\n`;
    doc += `==============\n\n`;

    shots.forEach((shot, i) => {
      const fileName = `shot_${String(i + 1).padStart(3, '0')}_${shot.shot_label}_${shot.player_id.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;
      doc += `${fileName}\n`;
      doc += `  Type: ${shot.shot_label}\n`;
      doc += `  Player: ${shot.player_id}\n`;
      doc += `  Time: ${shot.timestamp?.toFixed(2)}s\n`;
      doc += `  Duration: ${shot.duration?.toFixed(2)}s\n`;
      doc += `  Zone: ${shot.zone_player} → ${shot.zone_shuttle}\n`;
      doc += `  Direction: ${shot.shot_direction}\n`;
      if (shot.winner_error) {
        doc += `  Outcome: ${shot.winner_error}\n`;
      }
      if (shot.shot_rating) {
        doc += `  Rating: ${shot.shot_rating.toFixed(1)}\n`;
      }
      doc += `\n`;
    });
  } else {
    doc += `CONCATENATED VIDEO TIMELINE:\n`;
    doc += `===========================\n\n`;

    let currentTime = 0;
    shots.forEach((shot, i) => {
      const duration = shot.duration || 0;
      doc += `${String(i + 1).padStart(3, '0')}. ${currentTime.toFixed(2)}s - ${(currentTime + duration).toFixed(2)}s: ${shot.shot_label} by ${shot.player_id}`;
      if (shot.winner_error) {
        doc += ` [${shot.winner_error}]`;
      }
      doc += `\n`;
      currentTime += duration;
    });

    doc += `\nTotal Duration: ${currentTime.toFixed(2)}s\n`;
  }

  doc += `\n---\nGenerated by clutchapp.io\n`;

  return doc;
}

export async function downloadFiles(files: { name: string; blob: Blob }[]) {
  for (const file of files) {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Small delay between downloads
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
