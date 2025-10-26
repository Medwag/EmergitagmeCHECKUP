// tools/audit-wix-structure.mjs
import { promises as fs } from 'fs';
import path from 'path';
import url from 'url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'src');

const requiredDirs = [
  'backend',
  'public',
  'pages'
];

const findings = [];

for (const d of requiredDirs) {
  try { await fs.access(path.join(SRC, d)); }
  catch { findings.push(`Missing folder: src/${d}`); }
}

async function scan(dir) {
  const list = await fs.readdir(dir, { withFileTypes: true });
  for (const e of list) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await scan(p);
    else if (e.name.endsWith('.jsw') && !p.includes('/backend/')) {
      findings.push(`.jsw found outside backend: ${p.replace(root + '/', '')}`);
    }
  }
}
await scan(SRC);

if (findings.length) {
  console.log('⚠️ Structure issues:');
  findings.forEach(f => console.log('- ' + f));
  process.exitCode = 1;
} else {
  console.log('✅ Wix structure looks good.');
}



