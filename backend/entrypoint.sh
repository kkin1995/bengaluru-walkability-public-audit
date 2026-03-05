#!/bin/sh
set -e

# Fix ownership of the uploads volume at startup.
# The named Docker volume mounts after image layers, so the chown in the
# Dockerfile doesn't persist. Running as root here, we fix it then drop
# to appuser for the actual server process.
chown -R appuser:appuser /app/uploads 2>/dev/null || true

exec gosu appuser "$@"
