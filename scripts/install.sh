#!/usr/bin/env bash
set -euo pipefail

print_usage() {
  cat <<'USAGE'
Usage: scripts/install.sh --mode <domain|http> [--domain example.com]

Options:
  --mode      Deployment mode. Use 'domain' for automatic HTTPS with a public domain or 'http' for plain HTTP.
  --domain    Required when --mode=domain. The public domain name that should terminate HTTPS.
  --help      Show this message.

The script installs Docker Engine and the compose plugin following the official Ubuntu instructions
(https://docs.docker.com/engine/install/ubuntu/), prepares deployment environment variables, and
starts the stack with `docker compose up -d`.
USAGE
}

MODE=""
DOMAIN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      print_usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$MODE" ]]; then
  echo "--mode is required" >&2
  print_usage >&2
  exit 1
fi

case "$MODE" in
  domain)
    if [[ -z "$DOMAIN" ]]; then
      echo "--domain must be provided when --mode=domain" >&2
      exit 1
    fi
    CADDY_SITE_ADDRESS="$DOMAIN"
    CADDY_AUTO_HTTPS_DIRECTIVE=""
    ;;
  http)
    CADDY_SITE_ADDRESS=":80"
    CADDY_AUTO_HTTPS_DIRECTIVE="auto_https off"
    ;;
  *)
    echo "Unsupported mode: $MODE" >&2
    exit 1
    ;;
esac

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker Engine and docker compose plugin (Ubuntu 24.04)..."
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg lsb-release
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "Docker is already installed. Skipping installation steps."
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
DEPLOY_DIR="$REPO_ROOT/deploy"

cat > "$DEPLOY_DIR/.env" <<ENV
CADDY_SITE_ADDRESS=$CADDY_SITE_ADDRESS
CADDY_AUTO_HTTPS_DIRECTIVE=$CADDY_AUTO_HTTPS_DIRECTIVE
ENV

if [[ "$MODE" == domain ]]; then
  cat >> "$DEPLOY_DIR/.env" <<ENV
# When using domain mode, FRONTEND should be served over HTTPS by Caddy.
ENV
fi

echo "Generated $DEPLOY_DIR/.env with deployment parameters."

cd "$DEPLOY_DIR"

docker compose pull || true
DOCKER_COMPOSE_UP_CMD=(docker compose up -d)

if [[ "$MODE" == domain ]]; then
  echo "Running stack in domain mode for $DOMAIN"
else
  echo "Running stack in HTTP-only mode"
fi

"${DOCKER_COMPOSE_UP_CMD[@]}"
