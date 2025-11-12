# Modal Video Export Setup Guide

This guide will help you set up Modal for video export functionality.

## Prerequisites

1. Install Modal:
```bash
pip install modal
```

2. Create a Modal account and authenticate:
```bash
modal setup
```

## Deployment Steps

### 1. Deploy the Modal Function

```bash
modal deploy modal_export.py
```

This will deploy the video export functions to Modal and give you a URL like:
```
https://your-username--video-export-export-concatenated.modal.run
```

### 2. Set Environment Variables

Create a `.env.local` file in your project root:

```bash
# Modal export function URL (get this after deployment)
MODAL_EXPORT_URL=https://your-username--video-export.modal.run

# Base URL for your Next.js app (for video access)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

For production, use your actual domain:
```bash
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### 3. Restart Your Dev Server

```bash
npm run dev
```

## Usage

1. Filter or search for shots you want to export
2. Click the "Export" button
3. Select which shots to include (or keep all selected)
4. Choose export mode:
   - **Single Video**: All shots concatenated into one file
   - **Separate Videos**: Each shot as its own file
5. Click "Export X Shots"
6. Modal will process the video and automatically download it to your computer

## How It Works

1. **Frontend** sends shot data to `/api/export-video-modal`
2. **Next.js API** route calls your Modal function with shot timestamps
3. **Modal** downloads the video, uses FFmpeg to extract/concatenate shots
4. **Modal** stores the result in a persistent volume
5. **Browser** downloads the exported video(s) directly from Modal

## Cost Estimation

Modal pricing (as of 2024):
- **CPU**: ~$0.000030 per CPU-second
- **Storage**: ~$0.10 per GB-month

Example costs:
- Exporting 10 shots (~2 min processing): **~$0.01**
- Storing 1GB of exports for 1 month: **~$0.10**

## Cleanup

Modal automatically keeps files in the volume. To clean up old exports:

```bash
# Delete exports older than 24 hours
modal run modal_export.py::cleanup_old_exports --max-age-hours 24
```

Or list all exports:
```bash
modal run modal_export.py::list_exports
```

## Troubleshooting

### "Modal export URL not configured"
- Make sure you've set `MODAL_EXPORT_URL` in `.env.local`
- Restart your Next.js dev server

### "Failed to download video"
- Ensure your video file is accessible at the URL
- For local development, your Next.js server must be accessible to Modal
- Consider uploading videos to a cloud storage service (S3, GCS, etc.) for production

### Slow exports
- Increase CPU allocation in `modal_export.py` (currently set to 4.0 CPUs)
- Use a faster preset in FFmpeg (change from "fast" to "ultrafast")

## Production Recommendations

1. **Upload videos to cloud storage** (S3, Cloudflare R2, etc.) instead of serving from Next.js
2. **Add authentication** to the Modal endpoints to prevent unauthorized use
3. **Implement rate limiting** to control costs
4. **Set up monitoring** for export failures
5. **Add progress webhooks** for long exports

## Advanced Configuration

Edit `modal_export.py` to customize:
- Video quality (CRF value, currently 23)
- Processing speed (preset, currently "fast")
- Output format (currently H.264 MP4)
- Resolution (currently 1920x1080)
- CPU allocation (currently 4 CPUs)
- Timeout (currently 1 hour)
