import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type { SyncPayload } from "@/lib/selections";
import { createEmptySelections } from "@/lib/selections";
import { isValidSyncCode, normalizeSyncCode, generateSyncCode } from "@/lib/sync-code";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export function isCloudSyncConfigured(): boolean {
  return Boolean(redis);
}

export function isCloudSyncRequired(): boolean {
  return process.env.VERCEL === "1";
}

function ensureWritableStorage(): void {
  if (!redis && isCloudSyncRequired()) {
    throw new Error("cloud_sync_not_configured");
  }
}

function redisKey(code: string): string {
  return `furniture:sync:${code}`;
}

function filePath(code: string): string {
  return path.join(process.cwd(), "data", "sync", `${code}.json`);
}

function emptyPayload(): SyncPayload {
  return {
    selections: createEmptySelections(),
    updatedAt: Date.now(),
  };
}

async function readFromFile(code: string): Promise<SyncPayload | null> {
  try {
    const raw = await readFile(filePath(code), "utf8");
    return JSON.parse(raw) as SyncPayload;
  } catch {
    return null;
  }
}

async function writeToFile(code: string, payload: SyncPayload): Promise<void> {
  const directory = path.join(process.cwd(), "data", "sync");
  await mkdir(directory, { recursive: true });
  await writeFile(filePath(code), JSON.stringify(payload), "utf8");
}

export async function readSyncPayload(code: string): Promise<SyncPayload | null> {
  const normalizedCode = normalizeSyncCode(code);
  if (!isValidSyncCode(normalizedCode)) return null;

  if (redis) {
    const payload = await redis.get<SyncPayload>(redisKey(normalizedCode));
    return payload ?? null;
  }

  return readFromFile(normalizedCode);
}

export async function writeSyncPayload(
  code: string,
  payload: SyncPayload,
): Promise<"saved" | "conflict" | "invalid"> {
  const normalizedCode = normalizeSyncCode(code);
  if (!isValidSyncCode(normalizedCode)) return "invalid";

  ensureWritableStorage();

  const existing = await readSyncPayload(normalizedCode);
  if (existing && payload.updatedAt < existing.updatedAt) {
    return "conflict";
  }

  if (redis) {
    await redis.set(redisKey(normalizedCode), payload);
    return "saved";
  }

  await writeToFile(normalizedCode, payload);
  return "saved";
}

export async function createSyncSession(): Promise<SyncPayload & { code: string }> {
  ensureWritableStorage();

  let code = "";
  let payload: SyncPayload | null = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    code = normalizeSyncCode(generateSyncCode());
    payload = await readSyncPayload(code);
    if (!payload) break;
  }

  if (payload) {
    throw new Error("Unable to create a unique sync code");
  }

  const initialPayload = emptyPayload();
  await writeSyncPayload(code, initialPayload);
  return { code, ...initialPayload };
}
