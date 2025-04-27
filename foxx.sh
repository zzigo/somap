#!/bin/bash
# install-foxx.sh — Instalador automático de Foxx para SOMAP

# Variables de configuración
DB_NAME="somap"
MOUNT_POINT="/entity-service"
ZIP_PATH="/opt/somap/entity-service.zip"
DB_USER="root"
DB_PASS="asdBGT788"
ARANGO_HOST="localhost:8529"
AUTH_HEADER="Authorization: Basic $(echo -n "$DB_USER:$DB_PASS" | base64)"

# Colores para logs
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # sin color

echo -e "${CYAN}=== Installing SOMAP Foxx service to ArangoDB ===${NC}"
echo -e "${CYAN}📡 Host:${NC} $ARANGO_HOST"
echo -e "${CYAN}📚 Database:${NC} $DB_NAME"
echo -e "${CYAN}📦 Service path:${NC} $ZIP_PATH"
echo -e "${CYAN}📍 Mount point:${NC} $MOUNT_POINT"

# 🧹 Ahora que las variables están definidas, podemos ejecutar:
echo -e "${YELLOW}🧹 Removing previous service if exists...${NC}"
curl -s -X DELETE \
  -H "$AUTH_HEADER" \
  "http://${ARANGO_HOST}/_db/${DB_NAME}/_api/foxx/service?mount=${MOUNT_POINT}"

# Comprobamos que el archivo existe
if [ ! -f "$ZIP_PATH" ]; then
  echo -e "${RED}❌ ERROR: File not found at $ZIP_PATH${NC}"
  exit 1
fi

# Realizamos la instalación con reemplazo si existe
echo -e "${YELLOW}➕ Installing or replacing Foxx service...${NC}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "$AUTH_HEADER" \
  -F "source=@${ZIP_PATH}" \
  "http://${ARANGO_HOST}/_db/${DB_NAME}/_api/foxx?mount=${MOUNT_POINT}&replace=true")

BODY=$(echo "$RESPONSE" | head -n 1)
STATUS=$(echo "$RESPONSE" | tail -n 1)

# Resultado
if [ "$STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Foxx service successfully installed at ${MOUNT_POINT}${NC}"
elif [ "$STATUS" = "201" ]; then
  echo -e "${GREEN}✅ Foxx service created successfully at ${MOUNT_POINT}${NC}"
else
  echo -e "${RED}❌ Failed to install Foxx service (Status: $STATUS)${NC}"
  echo -e "${RED}Response: $BODY${NC}"
  exit 1
fi

# Listar servicios instalados
echo -e "${CYAN}📋 Installed Foxx services:${NC}"
curl -s -u "$DB_USER:$DB_PASS" "http://${ARANGO_HOST}/_db/${DB_NAME}/_api/foxx" | jq .