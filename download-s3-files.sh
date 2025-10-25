#!/bin/bash

# This script downloads files from S3 to local public folder
# You'll need AWS CLI installed and configured

# Base S3 URL
S3_BASE="s3://clutchvideostorageios112257-dev/shot-search-test-data"
VIDEO_ID="7CDF4E19-AFC0-438A-9CFD-AEFEBBC09E10"

# Create local directories
mkdir -p public/data/autopan
mkdir -p public/data/landscape

echo "Downloading files from S3..."
echo "This may take a while (estimated 700MB - 1GB)"

# Download autopan files
echo "Downloading autopan highlights..."
aws s3 cp "$S3_BASE/autopan/$VIDEO_ID/" "public/data/autopan/" --recursive --exclude "*" --include "*.jpg" --include "*.mp4"

# Download landscape files
echo "Downloading landscape videos..."
aws s3 cp "$S3_BASE/landscape/$VIDEO_ID/" "public/data/landscape/" --recursive --exclude "*" --include "*.jpg" --include "*.mp4"

# Download config files
echo "Downloading config files..."
mkdir -p public/data/config
aws s3 cp "$S3_BASE/court_keypoints/$VIDEO_ID.yaml" "public/data/config/court_keypoints.yaml"
aws s3 cp "$S3_BASE/output/$VIDEO_ID/params.yaml" "public/data/config/params.yaml"

echo "Download complete!"
echo "Files saved to public/data/"
