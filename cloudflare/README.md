# Cloudflare Music API

## Bootstrap without R2

The current test catalog uses two public-domain recordings hosted on Wikimedia Commons. The Worker proxies those HTTPS audio URLs, so the initial setup needs **Cloudflare D1 only**; it does not require an R2 bucket or a payment card for R2.

1. Install Node.js and authenticate: `npx wrangler login`.
2. From the repository root run:

```bash
bash cloudflare/bootstrap.sh
```

The script creates the D1 database, writes the returned ID into `wrangler.toml`, applies the migration, inserts the two demo tracks, and deploys the Worker. If the database already exists, set `D1_DATABASE_ID=<existing-id>` before running it.

## API

- `GET /api/v1/health` — health check.
- `GET /api/v1/search?q=<term>` — searches track metadata in D1.
- `GET /api/v1/tracks/{id}/stream-info` — resolves a stream URL for the Android `AudioSourceProvider`.
- `GET /api/v1/tracks/{id}/stream` — proxies the licensed audio source and supports HTTP Range requests.
- `POST /api/v1/admin/tracks/link` — adds an HTTPS audio URL from a host listed in `AUDIO_SOURCE_HOSTS`; requires the `ADMIN_TOKEN` Worker secret.

To enable the admin endpoint, run `npx wrangler secret put ADMIN_TOKEN` and enter a long random token. Example request:

```bash
curl -X POST "https://YOUR_WORKER.workers.dev/api/v1/admin/tracks/link" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Example","artist":"Artist","source_url":"https://upload.wikimedia.org/.../track.ogg","mime_type":"audio/ogg","license":"CC0 1.0","attribution":"Creator"}'
```

The default allowlist contains only `upload.wikimedia.org`. Add another host to `AUDIO_SOURCE_HOSTS` only after checking the source's license and terms. Downloads remain disabled by default. Commercial recordings from Spotify, VK or Apple Music are not included and their licenses are not granted by this project.
