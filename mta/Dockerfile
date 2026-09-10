FROM boky/postfix:latest

# Adds bounce-DSN routing on top of the base image: mail sent to our VERP
# return-path (bounce.{campaignId}.{email}@BOUNCE_DOMAIN, see
# backend/src/common/utils/verp.ts) gets piped to forward-bounce.sh instead
# of normal local delivery, which POSTs it to the backend's
# /webhooks/bounce/postfix. Standard Postfix transport_maps + pipe(8); see
# docker-entrypoint-wrapper.sh for the one part that can't be fully verified
# without live testing (how/when this base image builds its own config).
#
# boky/postfix:latest is Debian-based by default (apt-get), but the image
# also ships alpine-tagged variants (apk); detect which package manager is
# actually present rather than hardcoding one, so this doesn't silently
# break again if the tag in use changes.
RUN if command -v apt-get >/dev/null 2>&1; then \
      apt-get update && apt-get install -y --no-install-recommends curl bash && rm -rf /var/lib/apt/lists/*; \
    elif command -v apk >/dev/null 2>&1; then \
      apk add --no-cache curl bash; \
    else \
      echo "Neither apt-get nor apk found in the base image, install curl+bash manually." >&2; exit 1; \
    fi

COPY bounce-transport.regexp /etc/postfix/mailrova-bounce-transport.regexp
COPY master.cf.append /etc/postfix/mailrova-master.cf.append
COPY forward-bounce.sh /usr/local/bin/forward-bounce.sh
COPY docker-entrypoint-wrapper.sh /usr/local/bin/docker-entrypoint-wrapper.sh
RUN chmod +x /usr/local/bin/forward-bounce.sh /usr/local/bin/docker-entrypoint-wrapper.sh

# Deliberately NOT overriding ENTRYPOINT — the base image uses
# `ENTRYPOINT ["/tini", "--"]` (tini as PID 1, for correct signal/zombie
# handling of the postfix process tree) with `CMD ["/bin/sh", "-c",
# "/scripts/run.sh"]` doing the actual setup. Only CMD is replaced, so tini
# still supervises everything; the wrapper execs /scripts/run.sh at the end
# (see docker-entrypoint-wrapper.sh) so tini's direct child ends up being
# the real postfix process, same as in the unmodified image.
CMD ["/usr/local/bin/docker-entrypoint-wrapper.sh"]
