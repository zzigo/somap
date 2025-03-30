#!/bin/bash

# Exit on error
set -e

# Check if required tools are available
command -v zip >/dev/null 2>&1 || { echo "Error: zip is required but not installed. Please install it first."; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "Error: curl is required but not installed. Please install it first."; exit 1; }

# Check if Foxx directory exists
if [ ! -d "foxx" ]; then
    echo "Error: foxx directory not found"
    exit 1
fi

# Create a zip file of the Foxx service
echo "Creating zip file..."
cd foxx
zip -r ../entity-service.zip . || { echo "Error: Failed to create zip file"; exit 1; }

# Check if ArangoDB is running and accessible
echo "Checking ArangoDB connection..."
if ! curl -s "http://localhost:8529/_api/version" > /dev/null; then
    echo "Error: Cannot connect to ArangoDB. Make sure it's running on port 8529"
    rm ../entity-service.zip
    exit 1
fi

# Install the service
echo "Installing Foxx service..."
curl -X POST \
  -H "Authorization: Basic $(echo -n "root:asdBGT788" | base64)" \
  -H "Content-Type: multipart/form-data" \
  --form "source=@../entity-service.zip" \
  "http://localhost:8529/_db/somap/_api/foxx" || { echo "Error: Failed to install Foxx service"; rm ../entity-service.zip; exit 1; }

# Clean up
cd ..
rm entity-service.zip

echo "Foxx service installed successfully" 