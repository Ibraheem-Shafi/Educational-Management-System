#!/usr/bin/env node
/**
 * Fails if leftover ERP/auth hex from the pre-lively palette remains
 * in apps/web/src (print layouts are allowed).
 *
 * Run: node apps/web/scripts/audit-ui-hex.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const FORBIDDEN = [
  /#00A5FF/gi,
  /#CEF0FF/gi,
  /#003E73/gi,
  /#3B1FA8/gi,
  /#5B2FE0/gi,
  /#7C4DFF/gi,
  /#6B4EFF/gi,
  /#2563EB/gi,
  /#38C793/gi,
  /--primary-base/g,
];

const ALLOWED_EXT = new Set(['.ts', '.tsx', '.css', '.mjs', '.js']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(SRC, full).split(sep).join('/');
    if (rel.startsWith('app/print/')) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (ALLOWED_EXT.has(extname(name))) out.push(full);
  }
  return out;
}

const hits = [];
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const pattern of FORBIDDEN) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        hits.push(`${relative(ROOT, file).split(sep).join('/')}:${i + 1}: ${line.trim()}`);
      }
    }
  });
}

if (hits.length) {
  console.error(`audit-ui-hex: ${hits.length} leftover forbidden color(s)\n`);
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

console.log('audit-ui-hex: cleared (no forbidden leftover palette hex in apps/web/src)');
