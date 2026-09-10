#!/bin/bash
# Wraps boky/postfix's own CMD (/scripts/run.sh, see Dockerfile) to add
# bounce-DSN routing on top, without needing to know exactly how/when that
# script builds main.cf/master.cf internally (undocumented from the
# outside, and it may regenerate them at every boot). Instead of assuming a
# fixed point in its startup sequence, this polls for master.cf to exist,
# patches it, and issues a `postfix reload` — running as a background job
# that keeps going concurrently with (not blocking) run.sh below. If a
# future base-image update changes its startup behavior, this degrades to
# "no bounce routing" rather than a boot failure — verify with a real test
# bounce after any `docker compose pull`/base-image bump (see mta/README.md).
set -e

(
  for _ in $(seq 1 30); do
    if [ -f /etc/postfix/master.cf ]; then
      postconf -e "transport_maps=regexp:/etc/postfix/mailrova-bounce-transport.regexp" 2>/dev/null || true
      grep -qF "mailrovabounce" /etc/postfix/master.cf 2>/dev/null || cat /etc/postfix/mailrova-master.cf.append >>/etc/postfix/master.cf
      # master.cf existing doesn't mean postfix is actually running yet
      # (`reload` needs a live master process to signal) — retry for a bit
      # rather than a single best-effort attempt.
      for _ in $(seq 1 15); do
        postfix reload 2>/dev/null && break
        sleep 1
      done
      break
    fi
    sleep 1
  done
) &

# The base image's own CMD (see Dockerfile) — tini (ENTRYPOINT, untouched)
# ends up supervising this directly, same as it would the unmodified image.
exec /scripts/run.sh
