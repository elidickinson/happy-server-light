import 'dotenv/config';

import { startApi } from "@/app/api/api";
import { log } from "@/utils/log";
import { awaitShutdown, onShutdown } from "@/utils/shutdown";
import { db } from './storage/db';
import { startTimeout } from "./app/presence/timeout";
import { startMetricsServer } from "@/app/monitoring/metrics";
import { activityCache } from "@/app/presence/sessionCache";
import { auth } from "./app/auth/auth";
import { startDatabaseMetricsUpdater } from "@/app/monitoring/metrics2";
import { initEncrypt } from "./modules/encrypt";
import { initGithub } from "./modules/github";
import { loadFiles } from "./storage/files";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";

async function main() {
    applyDefaultEnv();

    // Storage
    await db.$connect();
    onShutdown('db', async () => {
        await db.$disconnect();
    });
    onShutdown('activity-cache', async () => {
        activityCache.shutdown();
    });

    // Initialize auth module
    await ensureHandyMasterSecret();
    await initEncrypt();
    await initGithub();
    await loadFiles();
    await auth.init();

    //
    // Start
    //

    await startApi();
    await startMetricsServer();
    startDatabaseMetricsUpdater();
    startTimeout();

    //
    // Ready
    //

    log('Ready');
    await awaitShutdown();
    log('Shutting down...');
}

// Process-level error handling
process.on('uncaughtException', (error) => {
    log({
        module: 'process-error',
        level: 'error',
        stack: error.stack,
        name: error.name
    }, `Uncaught Exception: ${error.message}`);

    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    const errorMsg = reason instanceof Error ? reason.message : String(reason);
    const errorStack = reason instanceof Error ? reason.stack : undefined;

    log({
        module: 'process-error',
        level: 'error',
        stack: errorStack,
        reason: String(reason)
    }, `Unhandled Rejection: ${errorMsg}`);

    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('warning', (warning) => {
    log({
        module: 'process-warning',
        level: 'warn',
        name: warning.name,
        stack: warning.stack
    }, `Process Warning: ${warning.message}`);
});

// Log when the process is about to exit
process.on('exit', (code) => {
    if (code !== 0) {
        log({
            module: 'process-exit',
            level: 'error',
            exitCode: code
        }, `Process exiting with code: ${code}`);
    } else {
        log({
            module: 'process-exit',
            level: 'info',
            exitCode: code
        }, 'Process exiting normally');
    }
});

main().catch((e) => {
    console.error(e);
    process.exit(1);
}).then(() => {
    process.exit(0);
});

async function ensureHandyMasterSecret(): Promise<void> {
    // In "light" mode we make HANDY_MASTER_SECRET optional by persisting a generated value to disk.
    // This keeps tokens stable across restarts without requiring any external secrets manager.
    if (process.env.HANDY_MASTER_SECRET && process.env.HANDY_MASTER_SECRET.trim()) {
        return;
    }

    const dataDir = resolveDataDir();
    const secretPath = join(dataDir, 'handy-master-secret.txt');

    try {
        const existing = (await readFile(secretPath, 'utf-8')).trim();
        if (existing) {
            process.env.HANDY_MASTER_SECRET = existing;
            return;
        }
    } catch {
        // ignore - will create below
    }

    await mkdir(dirname(secretPath), { recursive: true });
    const generated = randomBytes(32).toString('base64url');
    await writeFile(secretPath, generated, { encoding: 'utf-8', mode: 0o600 });
    process.env.HANDY_MASTER_SECRET = generated;
}

function applyDefaultEnv(): void {
    const dataDir = resolveDataDir();
    const filesDir = process.env.HAPPY_SERVER_LIGHT_FILES_DIR?.trim()
        ? process.env.HAPPY_SERVER_LIGHT_FILES_DIR.trim()
        : join(dataDir, 'files');

    process.env.HAPPY_SERVER_LIGHT_DATA_DIR = dataDir;
    process.env.HAPPY_SERVER_LIGHT_FILES_DIR = filesDir;

    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
        const dbPath = join(dataDir, 'happy-server-light.sqlite');
        process.env.DATABASE_URL = `file:${dbPath}`;
    }

    if (!process.env.PUBLIC_URL || !process.env.PUBLIC_URL.trim()) {
        const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3005;
        process.env.PUBLIC_URL = `http://localhost:${port}`;
    }
}

function resolveDataDir(): string {
    const fromEnv = process.env.HAPPY_SERVER_LIGHT_DATA_DIR?.trim();
    if (fromEnv) {
        return fromEnv;
    }
    // Store under the same home folder convention as happy-cli (~/.happy).
    return join(homedir(), '.happy', 'server-light');
}