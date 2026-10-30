import { createServer } from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

export async function allocatePort(): Promise<number> {
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      reject(new Error('Unable to allocate loopback port'));
      return;
    }
    server.close(() => resolve(address.port));
  });
  return promise;
}

async function waitForHealthy(origin: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${origin}/api/health`)).ok) return;
    } catch {}
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 250);
    await promise;
  }
  throw new Error('Next server did not become healthy within 30 seconds');
}

export class NextServerHost {
  private child: ChildProcess | null = null;

  async start(options: { database: string; migrations: string; production: boolean }): Promise<string> {
    this.stop();
    const port = await allocatePort();
    const origin = `http://127.0.0.1:${port}`;
    const entry = options.production
      ? join(process.resourcesPath, 'standalone', 'server.js')
      : join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
    const args = options.production ? [entry] : [entry, 'dev', '--turbopack', '-H', '127.0.0.1', '-p', String(port)];
    this.child = spawn(process.execPath, args, {
      cwd: options.production ? join(process.resourcesPath, 'standalone') : process.cwd(),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        AUTH_SECRET: process.env.AUTH_SECRET ?? randomUUID(),
        JADE_RUNTIME: 'desktop',
        SQLITE_PATH: options.database,
        JADE_MIGRATIONS_DIR: options.migrations,
        PORT: String(port),
        HOSTNAME: '127.0.0.1',
      },
      stdio: 'inherit',
      detached: process.platform !== 'win32',
    });
    await waitForHealthy(origin);
    return origin;
  }

  stop(): void {
    const child = this.child;
    this.child = null;
    if (!child || child.exitCode !== null) return;
    if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
    else child.kill('SIGTERM');
  }
}
