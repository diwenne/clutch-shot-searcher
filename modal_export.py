"""
Modal function for exporting video clips
Run with: modal deploy modal_export.py
"""

import modal
import subprocess
from pathlib import Path
import json

# Create Modal app
app = modal.App("video-export")

# Create image with FFmpeg
image = modal.Image.debian_slim().apt_install("ffmpeg")

# Create volume for storing videos temporarily
volume = modal.Volume.from_name("video-exports", create_if_missing=True)

@app.function(
    image=image,
    volumes={"/exports": volume},
    timeout=3600,  # 1 hour timeout for large exports
    cpu=4.0,  # Use 4 CPUs for faster processing
)
def export_concatenated(video_url: str, shots: list[dict], output_filename: str) -> dict:
    """
    Export multiple shots concatenated into a single video.

    Args:
        video_url: URL or path to the source video
        shots: List of shot dicts with startTime, endTime, index
        output_filename: Name for the output file

    Returns:
        dict with download_url and metadata
    """
    import tempfile
    import os

    output_path = f"/exports/{output_filename}"

    # Download video if it's a URL
    if video_url.startswith("http"):
        print(f"Downloading video from {video_url}")
        subprocess.run(["curl", "-L", "-o", "/tmp/input.mp4", video_url], check=True)
        input_path = "/tmp/input.mp4"
    else:
        input_path = video_url

    print(f"Processing {len(shots)} shots...")

    # Build FFmpeg filter complex for concatenation
    filter_parts = []
    inputs = []

    for i, shot in enumerate(shots):
        start = shot.get('startTime') or shot.get('timestamp')
        end = shot.get('endTime')

        if end is None:
            duration = shot.get('duration', 3)
        else:
            duration = end - start

        # Extract and scale each clip
        filter_parts.append(
            f"[0:v]trim=start={start}:duration={duration},setpts=PTS-STARTPTS,"
            f"scale=1920:1080:force_original_aspect_ratio=decrease,"
            f"pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v{i}]"
        )
        filter_parts.append(
            f"[0:a]atrim=start={start}:duration={duration},asetpts=PTS-STARTPTS[a{i}]"
        )
        inputs.append(f"[v{i}][a{i}]")

    # Concatenate all clips
    concat_filter = f"{''.join(inputs)}concat=n={len(shots)}:v=1:a=1[outv][outa]"
    filter_parts.append(concat_filter)

    filter_complex = ";".join(filter_parts)

    # Build FFmpeg command
    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-filter_complex", filter_complex,
        "-map", "[outv]",
        "-map", "[outa]",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-y",  # Overwrite output file
        output_path
    ]

    print(f"Running FFmpeg: {' '.join(cmd[:5])}...")
    subprocess.run(cmd, check=True, capture_output=True)

    # Get file size
    file_size = os.path.getsize(output_path)

    print(f"✅ Export complete: {output_path} ({file_size / 1024 / 1024:.2f} MB)")

    # Commit volume to persist the file
    volume.commit()

    return {
        "success": True,
        "filename": output_filename,
        "path": output_path,
        "shots_count": len(shots),
        "file_size_mb": file_size / 1024 / 1024
    }


@app.function(
    image=image,
    volumes={"/exports": volume},
    timeout=3600,
    cpu=4.0,
)
def export_separate(video_url: str, shots: list[dict]) -> dict:
    """
    Export each shot as a separate video file.

    Args:
        video_url: URL or path to the source video
        shots: List of shot dicts with startTime, endTime, index

    Returns:
        dict with list of exported files
    """
    import subprocess
    import os

    # Download video if it's a URL
    if video_url.startswith("http"):
        print(f"Downloading video from {video_url}")
        subprocess.run(["curl", "-L", "-o", "/tmp/input.mp4", video_url], check=True)
        input_path = "/tmp/input.mp4"
    else:
        input_path = video_url

    print(f"Processing {len(shots)} shots...")

    exported_files = []

    for shot in shots:
        start = shot.get('startTime') or shot.get('timestamp')
        end = shot.get('endTime')
        shot_index = shot.get('index')

        if end is None:
            duration = shot.get('duration', 3)
        else:
            duration = end - start

        output_filename = f"shot_{shot_index}.mp4"
        output_path = f"/exports/{output_filename}"

        # Build FFmpeg command for single shot
        cmd = [
            "ffmpeg",
            "-i", input_path,
            "-ss", str(start),
            "-t", str(duration),
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-y",
            output_path
        ]

        subprocess.run(cmd, check=True, capture_output=True)

        file_size = os.path.getsize(output_path)

        exported_files.append({
            "filename": output_filename,
            "path": output_path,
            "shot_index": shot_index,
            "file_size_mb": file_size / 1024 / 1024
        })

        print(f"✅ Exported shot {shot_index}: {output_filename}")

    # Commit volume to persist all files
    volume.commit()

    return {
        "success": True,
        "files": exported_files,
        "total_shots": len(shots)
    }


@app.function(
    image=image,
    volumes={"/exports": volume},
)
def get_export_file(filename: str) -> bytes:
    """
    Retrieve an exported file from the volume.

    Args:
        filename: Name of the file to retrieve

    Returns:
        File contents as bytes
    """
    file_path = f"/exports/{filename}"

    if not Path(file_path).exists():
        raise FileNotFoundError(f"File not found: {filename}")

    with open(file_path, "rb") as f:
        return f.read()


@app.function(
    image=image,
    volumes={"/exports": volume},
)
def list_exports() -> list[str]:
    """List all exported files in the volume."""
    exports_dir = Path("/exports")
    if not exports_dir.exists():
        return []

    return [f.name for f in exports_dir.iterdir() if f.is_file()]


@app.function(
    image=image,
    volumes={"/exports": volume},
)
def cleanup_old_exports(max_age_hours: int = 24) -> dict:
    """
    Clean up exports older than max_age_hours.

    Args:
        max_age_hours: Maximum age in hours before files are deleted

    Returns:
        dict with cleanup statistics
    """
    import time

    exports_dir = Path("/exports")
    if not exports_dir.exists():
        return {"deleted": 0, "remaining": 0}

    current_time = time.time()
    max_age_seconds = max_age_hours * 3600

    deleted = 0
    remaining = 0

    for file_path in exports_dir.iterdir():
        if file_path.is_file():
            file_age = current_time - file_path.stat().st_mtime
            if file_age > max_age_seconds:
                file_path.unlink()
                deleted += 1
            else:
                remaining += 1

    volume.commit()

    return {
        "deleted": deleted,
        "remaining": remaining,
        "max_age_hours": max_age_hours
    }


# Web endpoint for downloading files
@app.function(
    image=image,
    volumes={"/exports": volume},
)
@modal.web_endpoint(method="GET")
def download_export(filename: str):
    """
    Web endpoint to download an exported file.
    Usage: https://your-modal-url.modal.run/download_export?filename=export.mp4
    """
    from fastapi.responses import FileResponse

    file_path = f"/exports/{filename}"

    if not Path(file_path).exists():
        return {"error": "File not found"}, 404

    return FileResponse(
        file_path,
        media_type="video/mp4",
        filename=filename
    )
