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

for (const token of ['function queueMajorTrack', 'function syncExternalState', 'var externalProvider', 'externalEnded=false', 'dorozhka-provider-ended', 'DorozhkaMajorCatalogs.seek']) {
  if (!html.includes(token)) {
    throw new Error('Unified player integration is missing: ' + token);
  }
}
for (const token of ['function play(provider,id)', 'function pause(provider)', 'function resume(provider)',
  'function seek(provider,seconds)', 'function setVolume(provider,value)', 'function getState(provider)',
  'function waitForSpotifyDevice()', 'spotifyReadyWaiters', "addListener('ready'", "addListener('player_state_changed'"]) {
  if (!majorCatalogSource.includes(token)) {
    throw new Error('Major catalog playback API is missing: ' + token);
  }
}
if (majorCatalogSource.includes("root.open(item.url")) {
  throw new Error('Major catalog playback must not fall back to an external track link.');
}

const nativeSetupFile = path.join(__dirname, '..', 'native-setup.py');
const nativeSetupSource = fs.readFileSync(nativeSetupFile, 'utf8');
for (const token of [
  'if (m != mp) return;\n                        onTrackEnd();',
  'if (m != mp) return;\n                        onTrackError();',
  'if (p != mp) return;\n                    onTrackError();'
]) {
  if (!nativeSetupSource.includes(token)) {
    throw new Error('Native playback stale-callback guard is missing: ' + token.split('\n').pop().trim());
  }
}
if (!nativeSetupSource.includes('if (m != mp) return;')) {
  throw new Error('Native MediaPlayer callbacks must verify the active player instance.');
}

console.log('Inline JavaScript syntax OK; ' + sourceNames.length + ' source panels, major catalog adapters and unified playback controls verified.');
