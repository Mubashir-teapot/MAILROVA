#!/bin/bash
# Wraps boky/postfix's own entrypoint to add bounce-DSN routing on top,
# without needing to know exactly how/when it builds main.cf/master.cf
# internally (that's undocumented from the outside, and this image may
# regenerate them at every boot). Instead of assuming a fixed point in its
# startup sequence, this polls for master.cf to exist, patches it, and
# issues a `postfix reload` — running as a background job that keeps going
# concurrently with (not blocking) the real entrypoint below. If a future
# base-image update changes this image's startup behavior, this degrades to
# "no bounce routing" rather than a boot failure — verify with a real test
# bounce after any `docker compose pull`/base-image bump (see mta/README.md).
set -e

(
  for _ in $(seq 1 30); do
    if [ -f /etc/postfix/master.cf ]; then
      postconf -e "transport_maps=regexp:/etc/postfix/mailrova-bounce-transport.regexp" 2>/dev/null || true
      grep -qF "mailrovabounce" /etc/postfix/master.cf 2>/dev/null || cat /etc/postfix/mailrova-master.cf.append >>/etc/postfix/master.cf
      postfix reload 2>/dev/null || true
      break
    fi
    sleep 1
  done
) &

exec /docker-entrypoint.sh "$@"
