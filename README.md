# Clutch Match Viewer

A Next.js web application for browsing and viewing badminton match analysis data from S3 storage.

## Features

- **Organized by Content Type**: Browse videos organized into categories:
  - **Highlights**: Audio energy, pose-based, and clutch moment analysis
  - **Longest Rallies**: Top 5 longest rallies from the match
  - **Top Rated**: Top 4 highest-rated clips
  - **Full Match**: Complete match with breaks removed
  - **Tracking Data**: Ball tracking, court keypoints, and analysis parameters

- **Multiple Formats**: Each video available in both:
  - Portrait (Autopan) - Auto-panned vertical format
  - Landscape - Wide horizontal format

- **Search & Filter**: Search clips by name and filter by format
- **Dark Mode**: Automatic dark mode support
- **Responsive Design**: Works on mobile, tablet, and desktop

## Getting Started

1. **Install dependencies**:
```bash
npm install
```

2. **Run the development server**:
```bash
npm run dev
```

3. **Open [http://localhost:3000](http://localhost:3000)** in your browser

## Current Issue: S3 Access

⚠️ **Videos and thumbnails are currently not accessible** because the S3 bucket returns `403 Forbidden`.

### How to Fix S3 Access

You have two options:

#### Option 1: Make S3 Bucket Public (Simple, but less secure)

1. Go to AWS S3 Console
2. Navigate to your bucket: `clutchvideostorageios112257-dev`
3. Go to **Permissions** tab
4. Edit **Block Public Access** settings - uncheck "Block all public access"
5. Add this **Bucket Policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::clutchvideostorageios112257-dev/shot-search-test-data/*"
    }
  ]
}
```

6. Add **CORS Configuration**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

#### Option 2: Use Signed URLs (More secure, requires backend)

Create an API route that generates signed URLs:

1. Install AWS SDK: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
2. Create `/app/api/signed-url/route.ts`:

```typescript
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: 'eu-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  const command = new GetObjectCommand({
    Bucket: 'clutchvideostorageios112257-dev',
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return Response.json({ url: signedUrl });
}
```

3. Update your components to fetch signed URLs before loading media

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   └── page.tsx            # Main viewer with tabs and filters
├── lib/
│   └── match-data.ts       # Data generation from S3 structure
├── types/
│   └── match-data.ts       # TypeScript interfaces
└── README.md
```

## Tech Stack

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling

## Data Source

Data is loaded from AWS S3:
- **Bucket**: `clutchvideostorageios112257-dev`
- **Region**: `eu-central-1`
- **Path**: `/shot-search-test-data/`

Video ID: `7CDF4E19-AFC0-438A-9CFD-AEFEBBC09E10`
