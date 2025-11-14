#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-deploy/docker-compose.yml}
NATS_URL=${NATS_URL:-nats://nats:4222}
STREAM_NAME=${STREAM_NAME:-MATCHZY.EVENTS}
SUBJECT=${SUBJECT:-matchzy.events.smoke}
PAYLOAD=${PAYLOAD:-'{"smoke":true}'}

# Smoke-проверка использует JetStream stream view по https://docs.nats.io/using-nats/developer/develop_jetstream/jetstream_streams
docker compose -f "$COMPOSE_FILE" run --rm \
  -e NATS_URL="$NATS_URL" \
  -e STREAM_NAME="$STREAM_NAME" \
  -e SUBJECT="$SUBJECT" \
  -e PAYLOAD="$PAYLOAD" \
  nats-tools \
  sh -eo pipefail -c '
set -euo pipefail
nats --server "$NATS_URL" pub "$SUBJECT" "$PAYLOAD"
echo "Published smoke message to $SUBJECT"
# Read back the newest message to confirm delivery
nats --server "$NATS_URL" stream view "$STREAM_NAME" --since=1m --raw --count=1 > /tmp/last-message.json
echo "Last message in $STREAM_NAME:"
cat /tmp/last-message.json
'
