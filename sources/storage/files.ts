/**
 * Lightweight file storage for happy-server-light.
 *
 * The original happy-server uses S3/Minio. For personal/self-hosting use-cases
 * (e.g. over Tailscale), we store "public" files on local disk and serve them
 * via `GET /files/*`.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { homedir } from 'node:os';

export async function loadFiles(): Promise<void> {
    // Ensure base directories exist
    await mkdir(getFilesDir(), { recursive: true });
}

export function getFilesDir(): string {
    return process.env.HAPPY_SERVER_LIGHT_FILES_DIR
        ? process.env.HAPPY_SERVER_LIGHT_FILES_DIR
        : join(homedir(), '.happy', 'server-light', 'files');
}

export function getPublicBaseUrl(): string {
    // Used for generating absolute URLs for clients (mobile expects a `url` field).
    // Prefer explicit config; fallback to localhost for local dev.
    if (process.env.PUBLIC_URL && process.env.PUBLIC_URL.trim()) {
        return process.env.PUBLIC_URL.trim().replace(/\/+$/, '');
    }
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3005;
    return `http://localhost:${port}`;
}

export function getPublicUrl(path: string): string {
    const safe = normalizePublicPath(path);
    return `${getPublicBaseUrl()}/files/${encodeURI(safe)}`;
}

export async function writePublicFile(path: string, data: Uint8Array): Promise<void> {
    const safe = normalizePublicPath(path);
    const abs = join(getFilesDir(), safe);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, data);
}

export async function readPublicFile(path: string): Promise<Uint8Array> {
    const safe = normalizePublicPath(path);
    const abs = join(getFilesDir(), safe);
    return await readFile(abs);
}

export function normalizePublicPath(path: string): string {
    // Prevent path traversal and enforce a relative path
    const p = normalize(path).replace(/\\\\/g, '/').replace(/^\/+/, '');
    const parts = p.split('/').filter(Boolean);
    if (parts.some((part: string) => part === '..')) {
        throw new Error('Invalid path');
    }
    // Disallow absolute paths and Windows drive letters
    if (p.includes(':') || p.startsWith('/')) {
        throw new Error('Invalid path');
    }
    return parts.join('/');
}

export type ImageRef = {
    width: number;
    height: number;
    thumbhash: string;
    path: string;
}
