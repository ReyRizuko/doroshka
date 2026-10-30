'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.join(__dirname, '..', 'www', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const scripts = [...html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)]
  .filter((match) => !/\\bsrc\\s*=/.test(match[1]))
  .map((match) => match[2]);

if (scripts.length === 0) {
  throw new Error('No inline application script found in www/index.html');
}

scripts.forEach((source, index) => {
  new vm.Script(source, { filename: 'www/index.html:inline-' + (index + 1) });
});

const sourceNames = [...html.matchAll(/data-source="([^"]+)"/g)].map((match) => match[1]);
for (const name of sourceNames) {
  if (!html.includes('id="source-' + name + '"')) {
    throw new Error('Missing source panel for: ' + name);
  }
}

for (const id of ['yt-form', 'ym-form', 'sc-form', 'spotify-form', 'apple-form', 'deezer-form', 'bandcamp-form', 'vk-form', 'web-form']) {
  if (!html.includes('id="' + id + '"')) {
    throw new Error('Missing provider search form: ' + id);
  }
}

console.log('Inline JavaScript syntax OK; ' + sourceNames.length + ' source panels verified.');
