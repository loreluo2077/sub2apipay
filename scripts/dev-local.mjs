/**
 * 跨平台本地开发启动脚本
 * 先关闭占用 3000/3001 端口的进程，再同时启动 dev 和 mock-sub2api 服务
 *
 * @author Alfie
 */

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PORTS = [3000, 3001];
const isWindows = process.platform === 'win32';

/**
 * 查找占用指定端口的 PID 列表（跨平台）
 * @param {number} port
 * @returns {Promise<number[]>}
 */
async function findPidsByPort(port) {
  try {
    if (isWindows) {
      // netstat -ano 输出中找 LISTENING 行
      const { stdout } = await execFileAsync('netstat', ['-ano']);
      const pids = [];
      for (const line of stdout.split('\n')) {
        if (line.includes(`:${port}`) && line.includes('LISTENING')) {
          const pid = Number(line.trim().split(/\s+/).pop());
          if (pid > 0) pids.push(pid);
        }
      }
      return [...new Set(pids)];
    } else {
      const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN']);
      const lines = stdout.split('\n').filter(Boolean).slice(1);
      return lines.map((l) => Number(l.trim().split(/\s+/)[1])).filter(Boolean);
    }
  } catch {
    return [];
  }
}

/**
 * 强制终止指定 PID（跨平台）
 * @param {number} pid
 */
async function killPid(pid) {
  try {
    if (isWindows) {
      await execFileAsync('taskkill', ['/PID', String(pid), '/F']);
    } else {
      await execFileAsync('kill', ['-TERM', String(pid)]);
    }
  } catch {
    // 进程可能已退出，忽略错误
  }
}

/**
 * 关闭所有占用指定端口的进程
 * @param {number[]} ports
 */
async function killPorts(ports) {
  for (const port of ports) {
    const pids = await findPidsByPort(port);
    if (pids.length === 0) {
      console.log(`  Port ${port}: free`);
      continue;
    }
    for (const pid of pids) {
      console.log(`  Port ${port}: killing PID ${pid}`);
      await killPid(pid);
    }
  }
}

/**
 * 启动子进程，继承当前终端的 stdout/stderr
 * @param {string} name    服务名称（用于日志前缀）
 * @param {string} cmdline 完整命令行字符串
 * @returns {import('node:child_process').ChildProcess}
 */
function startService(name, cmdline) {
  const child = spawn(cmdline, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });
  return child;
}

async function main() {
  console.log('[1/2] Stopping processes on ports', PORTS.join(', '), '...');
  await killPorts(PORTS);

  console.log('[2/2] Starting services...');
  const mock = startService('mock-sub2api', 'node mock-sub2api/server.mjs');
  const app = startService('next-dev', 'next dev');

  // Ctrl+C 时同时关闭两个子进程
  const cleanup = () => {
    mock.kill();
    app.kill();
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
