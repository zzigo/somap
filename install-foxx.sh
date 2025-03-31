#!/bin/bash

# Configuration
ARANGO_HOST=${ARANGO_HOST:-localhost}
ARANGO_PORT=${ARANGO_PORT:-8529}
ARANGO_USER=${ARANGO_USER:-root}
ARANGO_PASS=${ARANGO_PASS:-asdBGT788}
DB_NAME=${DB_NAME:-somap}
MOUNT_POINT=${MOUNT_POINT:-/entity-service}

# Exit on error
set -e

echo "=== Installing SOMAP Foxx services to ArangoDB ==="
echo "Host: $ARANGO_HOST:$ARANGO_PORT"
echo "Database: $DB_NAME"
echo "Mount point: $MOUNT_POINT"

# Check if required tools are available
command -v zip >/dev/null 2>&1 || { echo "Error: zip is required but not installed. Please install it first."; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "Error: curl is required but not installed. Please install it first."; exit 1; }

# Check if Foxx directory exists
if [ ! -d "foxx" ]; then
    echo "Error: foxx directory not found"
    exit 1
fi

# Create database if it doesn't exist
echo "Checking if database $DB_NAME exists..."
DB_EXISTS=$(curl -s -u "$ARANGO_USER:$ARANGO_PASS" "http://$ARANGO_HOST:$ARANGO_PORT/_api/database" | grep -o "\"$DB_NAME\"" || echo "")

if [ -z "$DB_EXISTS" ]; then
  echo "Creating database $DB_NAME..."
  curl -X POST -u "$ARANGO_USER:$ARANGO_PASS" "http://$ARANGO_HOST:$ARANGO_PORT/_api/database" -d "{\"name\":\"$DB_NAME\"}"
else
  echo "Database $DB_NAME already exists."
fi

# Create a zip file of the Foxx service
echo "Creating zip file..."
cd foxx
zip -r ../entity-service.zip . || { echo "Error: Failed to create zip file"; exit 1; }
cd ..

# Check if ArangoDB is running and accessible
echo "Checking ArangoDB connection..."
if ! curl -s -u "$ARANGO_USER:$ARANGO_PASS" "http://$ARANGO_HOST:$ARANGO_PORT/_api/version" > /dev/null; then
    echo "Error: Cannot connect to ArangoDB at $ARANGO_HOST:$ARANGO_PORT"
    rm entity-service.zip
    exit 1
fi

# Check if service already exists and replace it if it does
echo "Checking if service already exists..."
SERVICE_EXISTS=$(curl -s -u "$ARANGO_USER:$ARANGO_PASS" "http://$ARANGO_HOST:$ARANGO_PORT/_db/$DB_NAME/_api/foxx" | grep -o "\"$MOUNT_POINT\"" || echo "")

if [ -n "$SERVICE_EXISTS" ]; then
  echo "Service already exists at $MOUNT_POINT, replacing..."
  curl -X DELETE -u "$ARANGO_USER:$ARANGO_PASS" "http://$ARANGO_HOST:$ARANGO_PORT/_db/$DB_NAME/_api/foxx/service$MOUNT_POINT"
fi

# Install the service
echo "Installing Foxx service..."
RESPONSE=$(curl -s -X POST \
  -u "$ARANGO_USER:$ARANGO_PASS" \
  --form "source=@entity-service.zip" \
  --form "mount=$MOUNT_POINT" \
  "http://$ARANGO_HOST:$ARANGO_PORT/_db/$DB_NAME/_api/foxx/service")

if echo $RESPONSE | grep -q "error"; then
  echo "Error installing service: $RESPONSE"
  rm entity-service.zip
  exit 1
fi

echo "Service installed successfully, running setup..."

# Run service setup script
curl -s -X POST \
  -u "$ARANGO_USER:$ARANGO_PASS" \
  "http://$ARANGO_HOST:$ARANGO_PORT/_db/$DB_NAME/_api/foxx/service$MOUNT_POINT/setup"

# Clean up
rm entity-service.zip

echo "=== SOMAP Foxx services installation complete ==="
echo "Service is available at: http://$ARANGO_HOST:$ARANGO_PORT/_db/$DB_NAME$MOUNT_POINT" 