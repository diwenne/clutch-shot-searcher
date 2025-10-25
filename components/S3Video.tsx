'use client';

import { useEffect, useState } from 'react';

interface S3VideoProps {
  s3Key: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
}

export function S3Video({ s3Key, className, controls = true, autoPlay = false }: S3VideoProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if using local files (paths start with /)
  const isLocalFile = s3Key.startsWith('/');

  useEffect(() => {
    if (isLocalFile) {
      // Local file - use directly
      setSignedUrl(s3Key);
      setLoading(false);
      return;
    }

    // S3 file - fetch presigned URL
    async function fetchSignedUrl() {
      try {
        const response = await fetch(
          `/api/presigned-url?key=${encodeURIComponent(s3Key)}`
        );

        if (!response.ok) {
          throw new Error('Failed to get presigned URL');
        }

        const data = await response.json();
        setSignedUrl(data.url);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching presigned URL:', err);
        setError(true);
        setLoading(false);
      }
    }

    fetchSignedUrl();
  }, [s3Key, isLocalFile]);

  if (loading) {
    return (
      <div className={`${className} bg-zinc-900 flex items-center justify-center`}>
        <div className="text-white">Loading video...</div>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className={`${className} bg-zinc-900 flex items-center justify-center`}>
        <div className="text-center text-white">
          <p className="mb-2">Video unavailable</p>
          <p className="text-xs text-zinc-400">
            {isLocalFile ? 'File not found - download files first' : 'Check AWS credentials in .env.local'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <video
      src={signedUrl}
      controls={controls}
      autoPlay={autoPlay}
      className={className}
      onError={() => setError(true)}
    >
      Your browser does not support the video tag.
    </video>
  );
}
