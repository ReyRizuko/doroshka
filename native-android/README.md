# Doroshka Native Android

Native Android client written in Kotlin, Jetpack Compose, Media3, Room, Retrofit, Coroutines and Hilt.

## Build

Use JDK 17 and Gradle 8.9 or newer:

```bash
cd native-android
gradle assembleDebug
```

The APK is created at `app/build/outputs/apk/debug/app-debug.apk`.

## API endpoint

The app uses one first-party Doroshka catalog API. The checked-in URL is a build fallback, not proof that a live worker is deployed. Set the actual Cloudflare `workers.dev` hostname (or your HTTPS FastAPI host) when building:

```bash
gradle assembleDebug -PMUSIC_API_BASE_URL=https://your-worker-subdomain.workers.dev/
```

The value must be an HTTPS base URL and must end in `/`. The catalog and streaming will not work until this URL points to a deployed API with its database and audio storage configured. The Cloudflare worker requires its D1 database and R2 audio bucket to be provisioned and bound before catalog requests and streaming work. The FastAPI service in `../music-server` implements the same `/api/v1` contract and can also be used by supplying its HTTPS origin.

## Catalog and playback

The client searches one first-party catalog endpoint and caches results in Room. Cached tracks remain visible offline. Audio is streamed by Media3 from each track's `audioUrl`; the service supports system media controls and background playback.

The catalog is not a preloaded commercial music dump. Only upload audio that you own or are licensed to distribute. The admin upload endpoint is server-side and its token must never be embedded in the APK.

## Package layout

- `data/local`: Room entities, DAO and database
- `data/remote`: Retrofit API, DTOs and mappers
- `data/repository`: offline-first repository
- `domain`: track model, repository contract and use cases
- `playback`: MediaSessionService and MediaController connection
- `presentation`: Compose navigation, screens, state and ViewModel
- `di`: Hilt modules
