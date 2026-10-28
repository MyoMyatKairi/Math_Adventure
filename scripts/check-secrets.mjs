#!/usr/bin/env node
// Scans tracked files for credentials that must never be committed.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' }).split('\n').filter(Boolean);
const rules = [
  { name: 'Supabase secret key', re: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'service_role JWT', re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\./ },
  { name: 'SUPABASE_SERVICE_ROLE_KEY value', re: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S{20,}/ },
  { name: 'private key', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'AWS key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'AZURE_SPEECH_KEY value', re: /AZURE_SPEECH_KEY\s*=\s*[A-Za-z0-9]{32,}/ },
];
const hits = [];
for (const f of files) {
  if (/\.(png|jpg|ico|lock|tsbuildinfo)$/.test(f) || f === 'pnpm-lock.yaml' || f === 'scripts/check-secrets.mjs') continue;
  if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example')) hits.push(`${f}: env file must not be committed`);
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  for (const r of rules) if (r.re.test(text)) hits.push(`${f}: ${r.name}`);
}
if (hits.length) {
  console.error('Possible secrets found:\n' + hits.join('\n'));
  process.exit(1);
}
console.log(`check-secrets: ${files.length} files clean`);
