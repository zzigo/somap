#!/bin/bash

# Function to kill processes on specific ports
kill_port() {
  local port=$1
  lsof -i :$port | grep LISTEN | awk '{print $2}' | xargs -r kill -9
}

# Clean up ports
kill_port 3000
kill_port 3001

# Make sure database schemas are up to date
echo "Updating database schema..."
if [ -f ./scripts/update-db-schema.js ]; then
  node ./scripts/update-db-schema.js
fi

# Make sure Foxx service is installed
echo "Installing Foxx service..."
if [ -f ./install-foxx.sh ]; then
  bash ./install-foxx.sh
fi

echo "Starting server..."

# Launch Hono with watch
bun --watch index.ts &

# Launch Tailwind with watch
bunx tailwindcss -i ./input.css -o ./public/output.css --watch &

# Launch reload server
bun reload.js &

# Wait for all processes to complete
wait