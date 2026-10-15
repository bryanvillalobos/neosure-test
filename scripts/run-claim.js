#!/usr/bin/env node
/**
 * Wrapper so every natural way of passing the property id works on Windows,
 * macOS and Linux:
 *
 *   npm run create:claim:headed --id 1888     npm sets npm_config_id (or passes 1888 through)
 *   npm run create:claim:headed --id=1888     npm sets npm_config_id=1888
 *   npm run create:claim:headed -- --id 1888  reaches argv directly
 *   npm run create:claim:headed -- 1888       bare number in argv
 *   PROPERTY_ID=1888 npm run create:claim     env var
 *
 * It then runs create-claim.spec with PROPERTY_ID set, forwarding --headed and
 * any other Playwright flags (e.g. --project=broker).
 */
const { spawn } = require('child_process');

const argv = process.argv.slice(2);
const passthrough = [];
let id = null;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--id=')) id = a.slice(5);
  else if (a === '--id' && argv[i + 1]) id = argv[++i];
  else if (/^\d+$/.test(a)) id = a;
  else passthrough.push(a);
}

const fromNpm = process.env.npm_config_id;
if (!id && fromNpm && fromNpm !== 'true') id = fromNpm;
if (!id && process.env.PROPERTY_ID) id = process.env.PROPERTY_ID;

if (!id || !/^\d+$/.test(id)) {
  console.error('\n  Missing property id.\n  Usage: npm run create:claim:headed --id 1888\n');
  process.exit(1);
}

console.log(`\n  Lodging a claim on PropertyId ${id}\n`);

// Lodging is a Strata Manager action, so the strata profile is the default.
// Pass --project=broker to lodge as the broker instead.
const project = passthrough.some((a) => a.startsWith('--project')) ? [] : ['--project=strata'];

const child = spawn(
  'npx',
  ['playwright', 'test', ...project, 'create-claim.spec', ...passthrough],
  { stdio: 'inherit', shell: true, env: { ...process.env, PROPERTY_ID: id } },
);
child.on('exit', (code) => process.exit(code ?? 1));
