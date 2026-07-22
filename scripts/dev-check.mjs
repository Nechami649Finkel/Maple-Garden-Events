#!/usr/bin/env node
/** Quick dev-stack health check (run after npm run dev). */
const checks = [
  ['Server direct', 'http://127.0.0.1:5000/api/health'],
  ['Client proxy', 'http://127.0.0.1:5173/api/health'],
  ['Client UI', 'http://127.0.0.1:5173/'],
];

let failed = 0;
for (const [name, url] of checks) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const ok = res.ok;
    console.log(`${ok ? '✅' : '❌'} ${name}: ${url} → HTTP ${res.status}`);
    if (!ok) failed++;
  } catch (err) {
    console.log(`❌ ${name}: ${url} → ${err.cause?.code || err.message}`);
    failed++;
  }
}
process.exit(failed ? 1 : 0);
