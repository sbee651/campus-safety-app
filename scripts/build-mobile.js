const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'www');

const files = [
  'index.html',
  'manifest.json',
  'sw.js',
  'vigil-icon-192.png',
  'vigil-icon-512.png',
  'vigil-icon-1024_1.png'
];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(out, file));
}

console.log(`Copied ${files.length} web app files to ${path.relative(root, out)}.`);
