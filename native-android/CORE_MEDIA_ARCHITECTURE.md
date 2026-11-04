# Catalog-independent media core

This branch adds an isolated provider/download core to the existing Android application.

## Contracts

- `CatalogProvider`: Room-first catalog search and trending observation.
- `AudioSourceProvider`: resolves a direct HTTPS audio URL for a track ID.
- `DownloadPermissionProvider`: independently confirms whether offline storage is allowed.
- `TrackDownloadWorker`: streams permitted audio into app-private storage and persists the final path in Room.
- `PlayerProgressTicker`: emits playback position on a dedicated StateFlow at 250 ms while playing.

## Provider API contract

Configure `MUSIC_API_BASE_URL` with a provider you control or are authorized to use. The client expects:

- `GET /api/v1/search?q={query}` -> array of `{ id, title, artist, durationMs, imageUrl, audioUrl }`
- `GET /api/v1/trending` -> the same array shape
- `GET /api/v1/tracks/{id}/stream` -> `{ url, downloadAllowed }`

The stream URL must be a direct HTTPS media URL. Set `downloadAllowed=true` only when the provider's license and terms explicitly permit downloading and offline storage. Reachability of a stream URL does not grant download rights.

## Build configuration

The module uses JDK 17, Android SDK 35, Room/KSP and Hilt/KAPT. Override the provider URL with:

```properties
MUSIC_API_BASE_URL=https://your-authorized-provider.example/
```

Build command:

```bash
./gradlew :app:assembleDebug
```

The API host must be configured before network catalog features can work. Existing Compose screens remain in place; the new core contracts are intentionally decoupled from them.
