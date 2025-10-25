const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

const s3Client = new S3Client({
  region: 'eu-central-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

const BUCKET = 'clutchvideostorageios112257-dev';
const VIDEO_ID = '7CDF4E19-AFC0-438A-9CFD-AEFEBBC09E10';
const IDENTITY = 'eu-central-1:7c7c8578-5f5e-cec1-3c5e-67484f324a2c';

async function downloadFile(key, outputPath, description) {
  try {
    console.log(`Downloading: ${description}...`);

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

    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`✓ Downloaded: ${description} (${fileSizeMB} MB)`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to download ${description}: ${error.message}`);
    return false;
  }
}

async function downloadEssentials() {
  console.log('='.repeat(60));
  console.log('Downloading Essential Files for Shot Viewer');
  console.log('='.repeat(60));
  console.log('');

  const files = [
    {
      key: `shot-search-test-data/${VIDEO_ID}.mp4`,
      output: path.join(__dirname, '../public/data/original-video.mp4'),
      description: 'Original Match Video'
    },
    {
      key: `shot-search-test-data/detected_shots_v2.csv`,
      output: path.join(__dirname, '../public/data/detected_shots_v2.csv'),
      description: 'Shot Detection Data (CSV)'
    },
    {
      key: `shot-search-test-data/protected/${IDENTITY}/output/${VIDEO_ID}/checkpoint/player_tracker_state_postprocessed/`,
      output: path.join(__dirname, '../public/data/player-tracking/'),
      description: 'Player Tracking Data'
    }
  ];

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    const success = await downloadFile(file.key, file.output, file.description);
    if (success) successCount++;
    else failCount++;
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`Download Summary`);
  console.log('='.repeat(60));
  console.log(`✓ Success: ${successCount}`);
  console.log(`✗ Failed: ${failCount}`);

  if (successCount > 0) {
    console.log('');
    console.log('Files saved to: public/data/');
    console.log('Next steps:');
    console.log('  1. Refresh http://localhost:3000');
    console.log('  2. Use the shot searcher to find specific shots');
    console.log('  3. Video will jump to exact timestamps!');
  }

  if (failCount > 0) {
    console.log('');
    console.log('⚠️  Some files failed. Make sure:');
    console.log('  - .env.local has AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
    console.log('  - Your IAM user has S3 read permissions');
  }
}

downloadEssentials().catch(console.error);
