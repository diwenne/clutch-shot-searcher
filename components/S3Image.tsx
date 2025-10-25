'use client';

import { useEffect, useState } from 'react';

interface S3ImageProps {
  s3Key: string;
  alt: string;
  className?: string;
}

export function S3Image({ s3Key, alt, className }: S3ImageProps) {
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
      <div className={`${className} bg-zinc-200 dark:bg-zinc-700 animate-pulse`} />
    );
  }

  if (error || !signedUrl) {
    return (
      <div className={`${className} bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center`}>
        <span className="text-xs text-zinc-500">Image unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={signedUrl}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
}
