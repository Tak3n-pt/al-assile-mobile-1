#!/bin/sh
set -e

mkdir -p /data

# Restore DB from R2 on startup (non-fatal: first deploy has no backup yet)
litestream restore \
  -if-replica-exists \
  -config /etc/litestream.yml \
  /data/inventory.db 2>&1 || echo "[litestream] restore skipped (no backup yet or connection issue)"

# Start Node server; Litestream replicates every WAL write to R2 in the background
exec litestream replicate \
  -config /etc/litestream.yml \
  -exec "node /app/server/index.js"
