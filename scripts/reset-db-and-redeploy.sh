#!/usr/bin/env bash
# Delete the IRVE survey database volume and redeploy.
# Use this to start with a fresh DB (e.g. after fixing ADMIN_PASSWORD).
#
# Usage:
#   ./scripts/reset-db-and-redeploy.sh stack   # if you use: docker stack deploy -c docker-compose.yml irve
#   ./scripts/reset-db-and-redeploy.sh compose # if you use: docker compose up
#
# Manual equivalent (stack):
#   docker stack rm irve
#   # wait 10–30s until all containers are gone, then:
#   docker volume rm irve_irve-data
#   docker stack deploy -c docker-compose.yml irve
#
# Manual equivalent (compose):
#   docker compose down
#   docker volume rm irve-copro_irve-data
#   docker compose up -d

set -e

MODE="${1:-}"

case "$MODE" in
  stack)
    STACK_NAME="irve"
    VOLUME_NAME="${STACK_NAME}_irve-data"
    echo "=== Removing stack ${STACK_NAME} ==="
    docker stack rm "$STACK_NAME" || true
    echo "Waiting for stack and all containers to tear down (volume must be released)..."
    for i in $(seq 1 60); do
      if ! docker stack services "$STACK_NAME" 2>/dev/null | grep -q .; then
        # Stack services gone; wait for task containers to be removed so volume is released
        sleep 10
        break
      fi
      sleep 2
    done
    echo "=== Removing volume ${VOLUME_NAME} ==="
    for i in $(seq 1 12); do
      if docker volume rm "$VOLUME_NAME" 2>/dev/null; then
        break
      fi
      echo "Volume still in use, waiting 5s..."
      sleep 5
    done
    if docker volume inspect "$VOLUME_NAME" 2>/dev/null; then
      echo "Warning: could not remove ${VOLUME_NAME}; it may still be in use. Retry later or: docker volume rm ${VOLUME_NAME}"
      exit 1
    fi
    echo "=== Redeploying stack ${STACK_NAME} ==="
    docker stack deploy -c docker-compose.yml "$STACK_NAME"
    echo "Done. DB reset and stack redeployed."
    ;;
  compose)
    COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-irve-copro}"
    VOLUME_NAME="${COMPOSE_PROJECT_NAME}_irve-data"
    echo "=== Bringing compose down ==="
    docker compose down
    echo "=== Removing volume ${VOLUME_NAME} ==="
    docker volume rm "$VOLUME_NAME" || { echo "Volume not found or in use: ${VOLUME_NAME}"; exit 1; }
    echo "=== Starting compose ==="
    docker compose up -d
    echo "Done. DB reset and compose redeployed."
    ;;
  *)
    echo "Usage: $0 stack|compose"
    echo "  stack   - for: docker stack deploy -c docker-compose.yml irve"
    echo "  compose - for: docker compose up"
    exit 1
    ;;
esac
