import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { shots, mode, videoPath } = await request.json();

    if (!shots || shots.length === 0) {
      return NextResponse.json({ error: 'No shots provided' }, { status: 400 });
    }

    // Get Modal function URL from environment variable
    const modalFunctionUrl = process.env.MODAL_EXPORT_URL;

    if (!modalFunctionUrl) {
      return NextResponse.json(
        { error: 'Modal export URL not configured. Set MODAL_EXPORT_URL environment variable.' },
        { status: 500 }
      );
    }

    const timestamp = Date.now();

    // Prepare video URL - convert local path to full URL if needed
    const videoUrl = videoPath.startsWith('http')
      ? videoPath
      : `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${videoPath}`;

    if (mode === 'concatenated') {
      const outputFilename = `export_concatenated_${timestamp}.mp4`;

      // Call Modal function
      const response = await fetch(`${modalFunctionUrl}/export_concatenated`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_url: videoUrl,
          shots,
          output_filename: outputFilename
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Modal export failed: ${error}`);
      }

      const result = await response.json();

      // Generate download URL
      const downloadUrl = `${modalFunctionUrl}/download_export?filename=${outputFilename}`;

      return NextResponse.json({
        success: true,
        videoUrl: downloadUrl,
        filename: outputFilename,
        shots_count: result.shots_count,
        file_size_mb: result.file_size_mb,
        message: `Successfully exported ${shots.length} shots as concatenated video (${result.file_size_mb.toFixed(2)} MB)`
      });

    } else {
      // Separate videos mode
      const response = await fetch(`${modalFunctionUrl}/export_separate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_url: videoUrl,
          shots
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Modal export failed: ${error}`);
      }

      const result = await response.json();

      // Generate download URLs for each file
      const files = result.files.map((file: any) => ({
        shotIndex: file.shot_index,
        url: `${modalFunctionUrl}/download_export?filename=${file.filename}`,
        filename: file.filename,
        file_size_mb: file.file_size_mb
      }));

      return NextResponse.json({
        success: true,
        files,
        total_shots: result.total_shots,
        message: `Successfully exported ${result.total_shots} separate video files`
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
