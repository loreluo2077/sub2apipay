import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);

function loadEnvFile(filePath) {
  const abs = resolve(process.cwd(), filePath);
  if (!existsSync(abs)) return;
  const text = readFileSync(abs, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFile('.env');

  console.log('[1/2] Applying database migrations...');
  await execFileAsync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  console.log('[2/2] Bootstrapping local demo data...');
  await execFileAsync('node', ['scripts/bootstrap-local-demo.mjs'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  console.log('Local demo environment rebuild completed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
