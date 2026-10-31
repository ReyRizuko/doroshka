# Doroshka Music API — Cloudflare deployment

This service does not need a VPS or an always-on computer. Cloudflare runs the API; D1 stores track metadata and R2 stores audio files.

There are two deployment paths. **Use the Dashboard path if you do not want to use a terminal.** The GitHub Actions path is optional automation.

## Option A — deploy entirely in the Cloudflare Dashboard

You will need a Cloudflare account. If the service's age or account terms require it, ask a parent or guardian to handle account setup. Do not add payment details unless the account owner has reviewed the current plan and limits.

### 1. Create the database

1. In the Cloudflare Dashboard, open **Storage & databases → D1** and create a database named `doroshka-music`.
2. Open that database's SQL console.
3. Open [cloudflare/schema.sql](./schema.sql) in this repository, copy its full contents, paste them into the SQL console and execute them. This creates the catalog table and indexes.

### 2. Create audio storage

In **Storage & databases → R2**, create a bucket named `doroshka-music-audio`. Keep the bucket private; the Worker reads audio through its binding.

### 3. Create the Worker

1. Open **Workers & Pages** and create a Worker named `doroshka-music-api`.
2. Open its code editor.
3. Replace the starter code with the complete contents of [cloudflare/worker.js](./worker.js), then save and deploy.

### 4. Add the bindings and secret

Open the Worker settings and add these bindings (the labels may vary slightly in the Dashboard):

- **D1 database binding**: variable name `DB`, select `doroshka-music`.
- **R2 bucket binding**: variable name `AUDIO`, select `doroshka-music-audio`.
- **Secret**: variable name `ADMIN_TOKEN`, set a long random value. Keep it private; do not paste it into chat or commit it to GitHub.

The Worker code includes a default `ALLOWED_ORIGINS=*` setting, suitable for initial testing. You can restrict it to the app's origin later.

After adding bindings and the secret, save and deploy the Worker again.

### 5. Check the API

Open this address in a browser, replacing the host with the Worker URL shown by Cloudflare:

```
https://YOUR-WORKER-URL/api/v1/health
```

A working deployment returns JSON containing `"ok":true`. The catalog will be empty until authorized audio is uploaded.

In the Doroshka app's source settings, set the catalog server URL to the Worker base URL, for example `https://doroshka-music-api.YOUR-SUBDOMAIN.workers.dev` (without the `/api/v1` suffix).

## Uploading music

Only upload recordings you own or have permission to distribute, and provide accurate license and attribution information. The upload endpoint accepts raw audio bytes and requires the private `ADMIN_TOKEN`.

The current upload endpoint is intended for an administrator/developer tool; it is not yet a point-and-click upload page. Example request:

```sh
curl -X POST "https://YOUR-WORKER-URL/api/v1/admin/tracks?title=Track%20title&artist=Artist&license=CC%20BY%204.0&attribution=Artist%20name" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: audio/mpeg" \
  --data-binary "@track.mp3"
```

Supported formats: MP3, M4A, AAC, OGG, OPUS, FLAC and WAV. Default maximum upload size is 100 MiB.

## Option B — deploy through GitHub Actions

This path is for someone comfortable configuring Cloudflare resources and GitHub repository secrets.

1. Create the D1 database and R2 bucket as above.
2. Put the D1 database ID into `database_id` in the repository's `wrangler.toml`.
3. Add these repository Actions secrets:
   - `CLOUDFLARE_API_TOKEN`: token with the required Workers, D1 and R2 permissions.
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.
   - `DOROZHKA_ADMIN_TOKEN`: a long random secret for upload authorization.
4. Run **Deploy Doroshka Music API** from the GitHub Actions tab, selecting the feature branch if needed.

The workflow applies the D1 migration, sets the Worker secret and deploys the Worker.

## Limits and licensing

Cloudflare has plan quotas and usage limits; storage and audio delivery are not unlimited. Review current Cloudflare pricing and limits before uploading a large library. This project does not provide rights to commercial recordings from Spotify, VK, Apple Music or other services.