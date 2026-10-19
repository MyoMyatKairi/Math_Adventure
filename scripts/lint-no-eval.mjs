#!/usr/bin/env node
// Fails if any source file evaluates strings as code. Learner input must never be executed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = process.argv.slice(2).length ? process.argv.slice(2) : ['src'];
const banned = [/\beval\s*\(/, /\bnew\s+Function\s*\(/, /\bFunction\s*\(\s*['"`]/, /setTimeout\s*\(\s*['"`]/];
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) {
      readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (banned.some((re) => re.test(line))) problems.push(`${p}:${i + 1}: ${line.trim()}`);
      });
    }
  }
}
for (const r of roots) walk(r);
if (problems.length) {
  console.error('Dynamic code evaluation is not allowed:\n' + problems.join('\n'));
  process.exit(1);
}
console.log(`no-eval: ${roots.join(', ')} clean`);
