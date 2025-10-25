import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextRequest } from 'next/server';

const s3Client = new S3Client({
  region: 'eu-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');

    if (!key) {
      return Response.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return Response.json(
        { error: 'AWS credentials not configured' },
        { status: 500 }
      );
    }

    const command = new GetObjectCommand({
      Bucket: 'clutchvideostorageios112257-dev',
      Key: key,
    });

    // Generate presigned URL that expires in 1 hour
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return Response.json({ url: signedUrl });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return Response.json(
      { error: 'Failed to generate presigned URL' },
      { status: 500 }
    );
  }
}
