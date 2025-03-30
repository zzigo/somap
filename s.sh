#!/bin/bash

# Función para matar procesos en puertos específicos
kill_port() {
  local port=$1
  lsof -i :$port | grep LISTEN | awk '{print $2}' | xargs -r kill -9
}

# Limpiar puertos
kill_port 3000
kill_port 3001

# Lanzar Hono con watch
bun --watch index.ts &

# Lanzar Tailwind con watch
bunx tailwindcss -i ./input.css -o ./public/output.css --watch &

# Lanzar reload server
bun reload.js &

# Esperar a que todos los procesos terminen
wait