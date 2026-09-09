FROM boky/postfix:latest

# Adds bounce-DSN routing on top of the base image: mail sent to our VERP
# return-path (bounce.{campaignId}.{email}@BOUNCE_DOMAIN, see
# backend/src/common/utils/verp.ts) gets piped to forward-bounce.sh instead
# of normal local delivery, which POSTs it to the backend's
# /webhooks/bounce/postfix. Standard Postfix transport_maps + pipe(8) — see
# docker-entrypoint-wrapper.sh for the one part that can't be fully verified
# without live testing (how/when this base image builds its own config).
RUN apk add --no-cache curl bash

COPY bounce-transport.regexp /etc/postfix/mailrova-bounce-transport.regexp
COPY master.cf.append /etc/postfix/mailrova-master.cf.append
COPY forward-bounce.sh /usr/local/bin/forward-bounce.sh
COPY docker-entrypoint-wrapper.sh /usr/local/bin/docker-entrypoint-wrapper.sh
RUN chmod +x /usr/local/bin/forward-bounce.sh /usr/local/bin/docker-entrypoint-wrapper.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint-wrapper.sh"]
