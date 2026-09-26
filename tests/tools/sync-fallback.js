// Copies cartoons/episodes.json into the inline <script id="episodes-fallback"> of cartoons/index.html.
// Usage: node tests/tools/sync-fallback.js [--check]   (--check exits 1 if out of sync)
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../..');
const json = JSON.stringify(JSON.parse(fs.readFileSync(path.join(root, 'cartoons/episodes.json'), 'utf8'))).replace(/</g, '\\u003c');
const htmlPath = path.join(root, 'cartoons/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const re = /(<script type="application\/json" id="episodes-fallback">)([\s\S]*?)(<\/script>)/;
if (!re.test(html)) { console.error('episodes-fallback block not found'); process.exit(1); }
const current = html.match(re)[2];
if (process.argv.includes('--check')) {
  if (current !== json) { console.error('fallback out of sync: run npm run sync'); process.exit(1); }
  console.log('fallback in sync'); process.exit(0);
}
fs.writeFileSync(htmlPath, html.replace(re, (_, a, _b, c) => a + json + c));
console.log('fallback updated');
