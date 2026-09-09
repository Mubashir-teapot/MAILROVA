#!/bin/bash
# Invoked by Postfix's pipe(8) transport (see master.cf.append) for every
# message addressed to bounce.{campaignId}.{email}@BOUNCE_DOMAIN — i.e.
# every bounce DSN a recipient's mail server sends back to our VERP
# return-path (see backend's mailer.ts `envelopeFrom` / verp.ts). Receives
# the raw message on stdin and the envelope recipient as $1.
set -euo pipefail

RECIPIENT="$1"
ENCODED_RECIPIENT="$(printf '%s' "$RECIPIENT" | tr -d '\n' | sed 's/@/%40/')"

curl -sf -m 15 \
  -X POST \
  --data-binary @- \
  -H "Content-Type: message/rfc822" \
  "http://backend:${BACKEND_PORT:-4000}/webhooks/bounce/postfix?to=${ENCODED_RECIPIENT}&key=${BOUNCE_WEBHOOK_KEY:-}"
