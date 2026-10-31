// Копирует jsmediatags и шрифты в www, чтобы приложение работало без интернета.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const www = path.join(root, 'www');
fs.mkdirSync(path.join(www, 'vendor'), { recursive: true });
fs.mkdirSync(path.join(www, 'fonts'), { recursive: true });

// Capacitor webDir должен содержать точку входа приложения.
fs.copyFileSync(path.join(root, 'index.html'), path.join(www, 'index.html'));

const tags = path.join(root, 'node_modules', 'jsmediatags', 'dist', 'jsmediatags.min.js');
if (fs.existsSync(tags)) fs.copyFileSync(tags, path.join(www, 'vendor', 'jsmediatags.min.js'));
else console.warn('jsmediatags не найден: обложки и теги из файлов читаться не будут');

const RANGES = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116'
};
const FONTS = [
  ['onest', 'Onest', [400, 500, 600]],
  ['unbounded', 'Unbounded', [500, 700]],
  ['jetbrains-mono', 'JetBrains Mono', [400, 500]]
];
let css = '';
for (const [pkg, family, weights] of FONTS) {
  const dir = path.join(root, 'node_modules', '@fontsource', pkg, 'files');
  for (const w of weights) for (const sub of ['cyrillic', 'latin']) {
    const name = `${pkg}-${sub}-${w}-normal.woff2`;
    const src = path.join(dir, name);
    if (!fs.existsSync(src)) { console.warn('нет шрифта', name); continue; }
    fs.copyFileSync(src, path.join(www, 'fonts', name));
    css += `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url(fonts/${name}) format('woff2');unicode-range:${RANGES[sub]}}\n`;
  }
}
fs.writeFileSync(path.join(www, 'fonts.css'), css);
const sources = path.join(root, 'sources');
if (fs.existsSync(sources)) {
  fs.cpSync(sources, path.join(www, 'sources'), { recursive: true });
  console.log('Скопированы собственные источники музыки');
}
console.log('Готово: ресурсы скопированы в www');
