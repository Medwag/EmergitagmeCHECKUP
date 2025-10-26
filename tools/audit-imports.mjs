// tools/audit-imports.mjs
import { promises as fs } from 'fs';
import path from 'path';
import url from 'url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'src');
const FILE_EXTS = ['.js', '.jsw', '.ts', '.tsx', '.mjs'];
const IMPORT_RE =
  /(?:import\s+(?:.+?)\s+from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\))/g;

const results = { missing: [], checked: 0 };

async function fileExistsAnyVariant(basePath) {
  try { await fs.access(basePath); return basePath; } catch {}
  for (const ext of FILE_EXTS) {
    try {
      await fs.access(basePath + ext);
      return basePath + ext;
    } catch {}
  }
  for (const ext of FILE_EXTS) {
    try {
      await fs.access(path.join(basePath, 'index' + ext));
      return path.join(basePath, 'index' + ext);
    } catch {}
  }
  return null;
}

async function collectFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await collectFiles(p));
    else if (/\.(js|jsx|ts|tsx|mjs|jsw)$/.test(e.name)) out.push(p);
  }
  return out;
}

function toFsPath(fromFile, spec) {
  if (spec.startsWith('backend/')) {
    return path.join(SRC, 'backend', spec.replace(/^backend\//, ''));
  }
  if (spec.startsWith('public/')) {
    return path.join(SRC, 'public', spec.replace(/^public\//, ''));
  }
  if (spec.startsWith('./') || spec.startsWith('../')) {
    return path.resolve(path.dirname(fromFile), spec);
  }
  return null;
}

const files = await collectFiles(SRC);
for (const file of files) {
  const code = await fs.readFile(file, 'utf8');
  let m;
  while ((m = IMPORT_RE.exec(code))) {
    const spec = m[1] || m[2];
    const fsPath = toFsPath(file, spec);
    if (!fsPath) continue;
    const resolved = await fileExistsAnyVariant(fsPath);
    results.checked++;
    if (!resolved) results.missing.push({ from: path.relative(SRC, file), spec, fsPath: path.relative(SRC, fsPath) });
  }
}

if (results.missing.length) {
  console.log('❌ Missing imports/targets:');
  for (const r of results.missing) {
    console.log(`- ${r.from} → ${r.spec} (expected at: ${r.fsPath}[.js|.jsw|/index.*])`);
  }
  process.exitCode = 1;
} else {
  console.log(`✅ All ${results.checked} internal imports resolved.`);
}
