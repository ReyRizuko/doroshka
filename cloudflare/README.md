# Doroshka Music on Cloudflare

This deployment does not require a VPS. Cloudflare Workers hosts the API, D1 stores catalog metadata, and R2 stores audio objects.

## One-time Cloudflare setup

1. Create a Cloudflare account (ask a parent or guardian to help with account setup if required by the service's terms).
2. Create a D1 database named `doroshka-music`.
3. Create an R2 bucket named `doroshka-music-audio`.
4. Copy the D1 database ID into `database_id` in the repository's `wrangler.toml`.
5. In GitHub repository Settings → Secrets and variables → Actions, add:
   - `CLOUDFLARE_API_TOKEN`: token with Workers Scripts edit, D1 edit and R2 edit permissions for this account.
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.
   - `DOROZHKA_ADMIN_TOKEN`: a long random secret used to authorize uploads.

Set the Worker secret from a terminal after installing Wrangler and logging in:

```sh
npx wrangler secret put ADMIN_TOKEN
``

Paste the value of `DOROZHKA_ADMIN_TOKEN` when prompted. Never put this token in source code or commit it to Git.

## Deploy

After the D1 ID is configured and GitHub secrets are added, run the **Deploy Doroshka Music API** workflow from the Actions tab. The API will be available at the Worker URL, normally `https://doroshka-music-api.<your-subdomain>.workers.dev`.

Set that URL in the Doroshka app's source settings.

## Upload an authorized recording

The upload endpoint accepts the audio as the raw request body; metadata is passed as query parameters:

```sh
curl -X POST "https://YOUR-WORKER-URL/api/v1/admin/tracks?title=Track%20title&artist=Artist&license=CC%20BY%204.0&attribution=Artist%20name" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: audio/mpeg" \
  --data-binary "@track.mp3"
```

Supported content types: MP3, M4A, AAC, OGG, OPUS, FLAC and WAV. Default upload limit is 100 MiB. Only upload audio you own or are authorized to distribute.

## Cost and limits

Cloudflare has usage quotas and plan limits. Check the current Workers, D1 and R2 allowances before uploading a large library. This is not unlimited free music hosting.
