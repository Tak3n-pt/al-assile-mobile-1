#!/bin/sh
set -e

mkdir -p /data

# Restore DB from R2 if a backup exists (skips silently on first deploy)
litestream restore \
  -if-replica-exists \
  -config /etc/litestream.yml \
  /data/inventory.db

# Start Node server with continuous replication to R2 running alongside it
exec litestream replicate \
  -config /etc/litestream.yml \
  -exec "node /app/server/index.js"
