import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

function resolveDataDir(env) {
  if (env.HAPPY_SERVER_LIGHT_DATA_DIR && env.HAPPY_SERVER_LIGHT_DATA_DIR.trim()) {
    return env.HAPPY_SERVER_LIGHT_DATA_DIR.trim();
  }
  return join(homedir(), '.happy', 'server-light');
}

function resolveFilesDir(env, dataDir) {
  if (env.HAPPY_SERVER_LIGHT_FILES_DIR && env.HAPPY_SERVER_LIGHT_FILES_DIR.trim()) {
    return env.HAPPY_SERVER_LIGHT_FILES_DIR.trim();
  }
  return join(dataDir, 'files');
}

function resolveDatabaseUrl(env, dataDir) {
  if (env.DATABASE_URL && env.DATABASE_URL.trim()) {
    return env.DATABASE_URL.trim();
  }
  const dbPath = join(dataDir, 'happy-server-light.sqlite');
  return `file:${dbPath}`;
}

function resolvePublicUrl(env) {
  if (env.PUBLIC_URL && env.PUBLIC_URL.trim()) {
    return env.PUBLIC_URL.trim().replace(/\/+$/, '');
  }
  const port = env.PORT ? parseInt(env.PORT, 10) : 3005;
  return `http://localhost:${port}`;
}

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      env,
      stdio: 'inherit',
      shell: false,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function main() {
  const env = { ...process.env };

  const dataDir = resolveDataDir(env);
  const filesDir = resolveFilesDir(env, dataDir);
  const databaseUrl = resolveDatabaseUrl(env, dataDir);
  const publicUrl = resolvePublicUrl(env);

  env.HAPPY_SERVER_LIGHT_DATA_DIR = dataDir;
  env.HAPPY_SERVER_LIGHT_FILES_DIR = filesDir;
  env.DATABASE_URL = databaseUrl;
  env.PUBLIC_URL = publicUrl;

  // Ensure dirs exist so SQLite can create the DB file.
  await mkdir(dataDir, { recursive: true });
  await mkdir(filesDir, { recursive: true });

  // Keep Prisma schema in sync (idempotent)
  await run('yarn', ['-s', 'prisma', 'db', 'push'], env);

  // Run the server
  await run('yarn', ['-s', 'start'], env);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

