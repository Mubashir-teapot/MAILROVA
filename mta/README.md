# mta — bounce-DSN routing

Extends `boky/postfix` so bounce DSNs sent back to our VERP return-path
(`bounce.{campaignId}.{email}@BOUNCE_DOMAIN`, see
`backend/src/common/utils/verp.ts`) get forwarded to the backend's
`POST /webhooks/bounce/postfix` instead of failing local delivery.

Needs `BOUNCE_DOMAIN` set (`.env`) and its MX record pointing at this server
(see the Domains page's DNS records / `MTA_HOSTNAME` in `.env.example`) —
without that, remote bounces have nowhere to come back to and this never
fires; third-party `MAIL_MODE` bounces still go through their own ESP
webhook (`/webhooks/bounce/{ses,sendgrid,postmark}`) as before.

**Verify after `docker compose up --build` or any base-image update:**

```bash
docker compose exec mta postconf -h transport_maps
# expect: regexp:/etc/postfix/mailrova-bounce-transport.regexp

docker compose exec mta grep mailrovabounce /etc/postfix/master.cf
# expect: the mailrovabounce pipe transport line
```

If either is missing, `docker-entrypoint-wrapper.sh`'s background patcher
didn't win its race with however `boky/postfix` builds its own config on
that particular version — bounce handling silently falls back to "no
self-hosted bounce detection" rather than failing the container, so this is
worth actually checking once after setup rather than assuming it worked.
