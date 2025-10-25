const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

// Load AWS credentials from environment or use default profile
const s3Client = new S3Client({
  region: 'eu-central-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined, // Will use default AWS credentials if env vars not set
});

const BUCKET = 'clutchvideostorageios112257-dev';
const VIDEO_ID = '7CDF4E19-AFC0-438A-9CFD-AEFEBBC09E10';
const BASE_PATH = 'shot-search-test-data';

// Files to download
const FILES = {
  autopan: [
    'audio_energy_highlights',
    'pose_based_highlights',
    'highlights',
    '5_longest_rally_clips_1',
    '5_longest_rally_clips_2',
    '5_longest_rally_clips_3',
    '5_longest_rally_clips_4',
    '5_longest_rally_clips_5',
    '4_rating_clips_1',
    '4_rating_clips_2',
    '4_rating_clips_3',
    '4_rating_clips_4',
  ],
  landscape: [
    'audio_energy_highlights',
    'pose_based_highlights',
    'highlights',
    'match_without_breaks',
    '5_longest_rally_clips_1',
    '5_longest_rally_clips_2',
    '5_longest_rally_clips_3',
    '5_longest_rally_clips_4',
    '5_longest_rally_clips_5',
    '4_rating_clips_1',
    '4_rating_clips_2',
    '4_rating_clips_3',
    '4_rating_clips_4',
  ],
};

async function downloadFile(key, outputPath) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    const response = await s3Client.send(command);

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Download the file
    await pipeline(response.Body, fs.createWriteStream(outputPath));
    console.log(`✓ Downloaded: ${path.basename(outputPath)}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to download ${key}: ${error.message}`);
    return false;
  }
}

async function downloadAll() {
  console.log('Starting S3 download...');
  console.log('This will download ~700MB - 1GB of files');
  console.log('');

  let totalFiles = 0;
  let successCount = 0;
  let failCount = 0;

  // Download autopan files
  console.log('Downloading autopan files...');
  for (const filename of FILES.autopan) {
    for (const ext of ['jpg', 'mp4']) {
      const key = `${BASE_PATH}/autopan/${VIDEO_ID}/${filename}.${ext}`;
      const outputPath = path.join(__dirname, '../public/data/autopan', `${filename}.${ext}`);
      totalFiles++;

      const success = await downloadFile(key, outputPath);
      if (success) successCount++;
      else failCount++;
    }
  }

  // Download landscape files
  console.log('');
  console.log('Downloading landscape files...');
  for (const filename of FILES.landscape) {
    for (const ext of ['jpg', 'mp4']) {
      const key = `${BASE_PATH}/landscape/${VIDEO_ID}/${filename}.${ext}`;
      const outputPath = path.join(__dirname, '../public/data/landscape', `${filename}.${ext}`);
      totalFiles++;

      const success = await downloadFile(key, outputPath);
      if (success) successCount++;
      else failCount++;
    }
  }

  console.log('');
  console.log('='.repeat(50));
  console.log(`Download complete!`);
  console.log(`Total files: ${totalFiles}`);
  console.log(`✓ Success: ${successCount}`);
  console.log(`✗ Failed: ${failCount}`);
  console.log('='.repeat(50));

  if (successCount > 0) {
    console.log('');
    console.log('Files saved to: public/data/');
    console.log('Refresh your browser at http://localhost:3000 to view!');
  }

  if (failCount > 0) {
    console.log('');
    console.log('⚠️  Some files failed to download.');
    console.log('Make sure you have AWS credentials configured:');
    console.log('  - Option 1: Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars');
    console.log('  - Option 2: Run "aws configure" to set up default credentials');
  }
}

// Run the download
downloadAll().catch(console.error);
