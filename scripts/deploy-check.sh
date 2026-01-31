#!/usr/bin/env bash
# Run on the Docker host to verify running containers, ports, and alignment
# for IRVE stack behind Traefik (https://irve.example.com).

set -e

echo "=== Docker Swarm / Stack ==="
docker node ls 2>/dev/null || echo "Swarm not initialized or not manager."
echo ""

echo "=== Stack 'irve' services ==="
docker stack services irve 2>/dev/null || echo "Stack 'irve' not deployed."
echo ""

echo "=== Containers (all) - name, image, status, ports ==="
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "=== Listening ports on host (80, 443, 3000) ==="
for port in 80 443 3000; do
  if command -v ss >/dev/null 2>&1; then
    out=$(ss -tlnp 2>/dev/null | grep -E ":\s*${port}\s" || true)
  else
    out=$(netstat -tlnp 2>/dev/null | grep -E "[.:]${port}\s" || true)
  fi
  if [ -n "$out" ]; then
    echo "Port $port: $out"
  else
    echo "Port $port: (not listening or no permission)"
  fi
done
echo ""

echo "=== Network 'traefik-public' ==="
docker network inspect traefik-public --format '{{.Name}} ({{.Driver}})' 2>/dev/null || echo "Network 'traefik-public' not found. Create with: docker network create -d overlay traefik-public"
echo ""

echo "=== Alignment summary ==="
echo "- IRVE app: no host ports published; container listens on 3000 internally."
echo "- Traefik: expected to listen on host 80 (HTTP) and 443 (HTTPS)."
echo "- Routing: Host(irve.example.com) -> websecure -> service irve:3000 on traefik-public."
echo "- If stack 'irve' is deployed: docker service logs irve_enquete-irve"
