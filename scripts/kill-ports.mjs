import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function parsePorts(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: pnpm kill:ports -- 3000 3001');
    console.log('Default ports: 3000 3001');
    process.exit(0);
  }

  const raw = argv.length > 0 ? argv : ['3000', '3001'];
  const ports = raw
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0 && value <= 65535);

  if (ports.length === 0) {
    throw new Error('Please provide at least one valid port, for example: pnpm kill:ports -- 3000 3001');
  }

  return [...new Set(ports)];
}

async function findPortProcesses(port) {
  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN']);
    const lines = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) return [];

    return lines.slice(1).map((line) => {
      const parts = line.split(/\s+/);
      return {
        command: parts[0] || 'unknown',
        pid: Number(parts[1]),
        user: parts[2] || 'unknown',
        raw: line,
      };
    });
  } catch (error) {
    const stderr = error?.stderr || '';
    const stdout = error?.stdout || '';
    const combined = `${stdout}\n${stderr}`;
    if (combined.includes('No such file or directory') || combined.includes('not found')) {
      throw new Error('lsof is required but was not found on this machine.');
    }
    return [];
  }
}

async function killPid(pid) {
  await execFileAsync('kill', ['-TERM', String(pid)]);
}

async function main() {
  const ports = parsePorts(process.argv.slice(2));

  console.log(`Checking ports: ${ports.join(', ')}`);

  let foundAny = false;

  for (const port of ports) {
    const processes = await findPortProcesses(port);

    if (processes.length === 0) {
      console.log(`- Port ${port}: no listening process`);
      continue;
    }

    foundAny = true;
    console.log(`- Port ${port}:`);

    for (const processInfo of processes) {
      console.log(`  - killing PID ${processInfo.pid} (${processInfo.command}, user=${processInfo.user})`);
      await killPid(processInfo.pid);
    }
  }

  if (!foundAny) {
    console.log('Nothing to stop.');
    return;
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
