#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-deploy/docker-compose.yml}
NATS_URL=${NATS_URL:-nats://nats:4222}
STREAM_NAME="MATCHZY.EVENTS"
STREAM_SUBJECTS=${STREAM_SUBJECTS:-"matchzy.events.*"}
# Stream configuration aligns with JetStream stream properties per https://docs.nats.io/using-nats/developer/develop_jetstream/jetstream_streams
MATCHZY_STREAM_MAX_BYTES=${MATCHZY_STREAM_MAX_BYTES:-6442450944}
MATCHZY_STREAM_MAX_AGE=${MATCHZY_STREAM_MAX_AGE:-48h}

if [[ ${MATCHZY_STREAM_MAX_BYTES} -lt 5368709120 || ${MATCHZY_STREAM_MAX_BYTES} -gt 10737418240 ]]; then
  echo "MATCHZY_STREAM_MAX_BYTES must be between 5 GiB and 10 GiB" >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" run --rm \
  -e NATS_URL="$NATS_URL" \
  -e STREAM_NAME="$STREAM_NAME" \
  -e STREAM_SUBJECTS="$STREAM_SUBJECTS" \
  -e MATCHZY_STREAM_MAX_BYTES="$MATCHZY_STREAM_MAX_BYTES" \
  -e MATCHZY_STREAM_MAX_AGE="$MATCHZY_STREAM_MAX_AGE" \
  nats-tools \
  sh -eo pipefail -c '
set -euo pipefail
CONFIG_PATH="/tmp/stream.json"
cat <<JSON >"${CONFIG_PATH}"
{
  "name": "${STREAM_NAME}",
  "subjects": ["${STREAM_SUBJECTS}"],
  "retention": "limits",
  "max_age": "${MATCHZY_STREAM_MAX_AGE}",
  "max_bytes": ${MATCHZY_STREAM_MAX_BYTES},
  "storage": "file",
  "discard": "old",
  "num_replicas": 1,
  "allow_direct": true,
  "deny_delete": false,
  "deny_purge": false
}
JSON
if nats --server "$NATS_URL" stream info "$STREAM_NAME" >/dev/null 2>&1; then
  echo "Stream ${STREAM_NAME} already exists"
else
  echo "Creating stream ${STREAM_NAME}"
  nats --server "$NATS_URL" stream add "$STREAM_NAME" --config "$CONFIG_PATH"
fi
'
