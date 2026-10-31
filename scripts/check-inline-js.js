'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.join(__dirname, '..', 'www', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const sourceHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
if (html !== sourceHtml) throw new Error('www/index.html is stale; run npm run prepare-assets first.');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter((match) => !/\bsrc\s*=/.test(match[1]))
  .map((match) => match[2]);

if (scripts.length === 0) {
  throw new Error('No inline application script found in www/index.html');
}

scripts.forEach((source, index) => {
  new vm.Script(source, { filename: 'www/index.html:inline-' + (index + 1) });
});

const markup = html.slice(0, html.indexOf('<script'));
const sourceNames = [...markup.matchAll(/data-source="([^"]+)"/g)].map((match) => match[1]);
for (const name of sourceNames) {
  if (!html.includes('id="source-' + name + '"')) {
    throw new Error('Missing source panel for: ' + name);
  }
}

for (const id of ['yt-form', 'ym-form', 'sc-form', 'apple-form', 'deezer-form', 'bandcamp-form', 'vk-form', 'web-form',
  'apple-token-form', 'spotify-config-form', 'spotify-connect', 'global-apple-slot', 'global-spotify-slot']) {
  if (!html.includes('id="' + id + '"')) {
    throw new Error('Missing provider search form: ' + id);
  }
}

const sourceFile = path.join(__dirname, '..', 'www', 'sources', 'dorozhka-source.js');
if (!fs.existsSync(sourceFile)) {
  throw new Error('Dorozhka source adapter is missing from www/sources');
}
new vm.Script(fs.readFileSync(sourceFile, 'utf8'), { filename: 'www/sources/dorozhka-source.js' });

const catalogFile = path.join(__dirname, '..', 'www', 'sources', 'dorozhka-catalog.js');
if (!fs.existsSync(catalogFile)) {
  throw new Error('Doroshka Music catalog adapter is missing from www/sources');
}
new vm.Script(fs.readFileSync(catalogFile, 'utf8'), { filename: 'www/sources/dorozhka-catalog.js' });

const majorCatalogFile = path.join(__dirname, '..', 'www', 'sources', 'dorozhka-major-catalogs.js');
if (!fs.existsSync(majorCatalogFile)) {
  throw new Error('Apple Music / Spotify catalog adapter is missing from www/sources');
}
const majorCatalogSource = fs.readFileSync(majorCatalogFile, 'utf8');
new vm.Script(majorCatalogSource, { filename: 'www/sources/dorozhka-major-catalogs.js' });

for (const token of ['function sendNativeQueue(payload,seq)', 'Native.setQueue(payload).catch', 'nativeLive=false;']) {
  if (!html.includes(token)) throw new Error('Native queue error handling is missing: ' + token);
}
for (const token of ['function queueMajorTrack', 'function syncExternalState', 'var externalProvider', 'externalEnded=false', 'dorozhka-provider-ended', 'DorozhkaMajorCatalogs.seek']) {
  if (!html.includes(token)) {
    throw new Error('Unified player integration is missing: ' + token);
  }
}

for (const token of ['function recordHistory(id)', 'function toggleFavorite(id)', 'function renderHomeShelves()', 'function queueTrack(id)', 'var globalSearchSeq=0', 'youtubeSearch(q)', 'data-discover=', 'data-library-view=', 'queue-music', 'queue-ds', 'data-act=iaqueue', 'function queueTrack(id)']) {
  if (!html.includes(token)) {
    throw new Error('Music platform feature is missing: ' + token);
  }
}
for (const id of ['recent-list', 'home-queue', 'queue-clear', 'n-fav']) {
  if (!html.includes('id="' + id + '"')) {
    throw new Error('Music platform UI is missing: ' + id);
  }
}
for (const token of ['function play(provider,id)', 'function pause(provider)', 'function resume(provider)',
  'function seek(provider,seconds)', 'function setVolume(provider,value)', 'function getState(provider)',
  'function waitForSpotifyDevice()', 'spotifyReadyWaiters', 'function refreshSpotifyToken()', 'function ensureSpotifyToken()', 'function hasSpotifySession()', 'spotifyAuthGeneration', 'generation!==spotifyAuthGeneration', 'dorozhkaSpotifyRefreshToken', "addListener('ready'", "addListener('player_state_changed'"]) {
  if (!majorCatalogSource.includes(token)) {
    throw new Error('Major catalog playback API is missing: ' + token);
  }
}
if (majorCatalogSource.includes("root.open(item.url")) {
  throw new Error('Major catalog playback must not fall back to an external track link.');
}

const nativeSetupFile = path.join(__dirname, '..', 'native-setup.py');
const nativeSetupSource = fs.readFileSync(nativeSetupFile, 'utf8');
const nativeGuards = [
  ['completion callback', 'onTrackEnd();'],
  ['error callback', 'onTrackError();'],
  ['stale player identity', 'if (m != mp) return;'],
  ['stale prepare failure', 'if (p != mp) return;'],
  ['service startup command queue', 'static void prepareStart()'],
  ['deferred native controls', 'pendingCommands.add(r)'],
  ['native service startup drain', 'for (Runnable command : pendingCommands) handler.post(command);'],
  ['startup failure cleanup', 'static void cancelStart()'],
  ['plugin teardown cleanup', 'protected void handleOnDestroy()'],
  ['plugin instance release', 'if (instance == this) instance = null;'],
  ['native command dispatch result', 'static boolean post(Runnable r)'],
  ['native command rejection when service is absent', 'call.reject("Android-плеер ещё не запущен")'],
  ['modern Android audio focus request', 'new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)'],
  ['audio focus release', 'audio.abandonAudioFocusRequest(focusRequest)'],
  ['stop cleanup uses version-aware focus release', '        abandonFocus();\n        pausedByFocus = false;'],
  ['focus denial releases Wi-Fi lock and updates playback state', 'if (!requestFocus()) {\n            wantPlay = false;\n            handler.removeCallbacks(ticker);\n            releaseWifiLock();\n            updateSession();\n            updateNotification();\n            emitState();'],
  ['repeat-one reacquires audio focus', 'mp.seekTo(0);\n                startPlayback();'],
  ['completed track restarts on resume', 'if (completed) {\n                try { mp.seekTo(0); completed = false;'],
  ['foreground startup failure resets JS player', 'emitError("");\n            PlaybackPlugin.emit("stopped", new JSObject());'],
  ['service teardown resets JS player', 'PlaybackPlugin.emit("stopped", new JSObject());\n        super.onDestroy();']
];
for (const [label, token] of nativeGuards) {
  if (!nativeSetupSource.includes(token)) {
    throw new Error('Native playback guard is missing: ' + label);
  }
}
if ((nativeSetupSource.match(/if \(m != mp\) return;/g) || []).length < 2) {
  throw new Error('Native completion and error callbacks must both reject stale players.');
}

console.log('Inline JavaScript syntax OK; ' + sourceNames.length + ' source panels, major catalog adapters, unified playback controls and native Android guards verified.');
