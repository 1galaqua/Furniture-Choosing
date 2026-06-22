import type { SelectionsState, SyncPayload } from "@/lib/selections";

export type RemoteSyncState = SyncPayload & {
  code: string;
};

export type SyncStatusInfo = {
  configured: boolean;
  required: boolean;
  message: "cloud_sync_ready" | "cloud_sync_missing" | "cloud_sync_optional";
};

export async function fetchSyncStatus(): Promise<SyncStatusInfo> {
  const response = await fetch("/api/sync/status", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("status_failed");
  }

  return (await response.json()) as SyncStatusInfo;
}

export async function fetchSyncSession(code: string): Promise<RemoteSyncState> {
  const response = await fetch(`/api/sync/${code}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(response.status === 404 ? "not_found" : "fetch_failed");
  }

  return (await response.json()) as RemoteSyncState;
}

export async function saveSyncSession(
  code: string,
  payload: SyncPayload,
): Promise<RemoteSyncState | "conflict"> {
  const response = await fetch(`/api/sync/${code}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (response.status === 409) {
    return "conflict";
  }

  if (!response.ok) {
    throw new Error("save_failed");
  }

  return (await response.json()) as RemoteSyncState;
}

export { getSharedSyncCode } from "@/lib/sync-code";

export function loadLocalUpdatedAt(): number {
  if (typeof window === "undefined") return 0;

  const raw = localStorage.getItem("furniture-updated-at-v1");
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function saveLocalState(
  selections: SelectionsState,
  updatedAt: number,
  syncCode: string,
): void {
  localStorage.setItem("furniture-selections-v1", JSON.stringify(selections));
  localStorage.setItem("furniture-updated-at-v1", String(updatedAt));
  localStorage.setItem("furniture-sync-code-v1", syncCode);
}

export function loadLocalSelections(): SelectionsState | null {
  if (typeof window === "undefined") return null;

  try {
    const saved = localStorage.getItem("furniture-selections-v1");
    if (!saved) return null;
    return JSON.parse(saved) as SelectionsState;
  } catch {
    return null;
  }
}

export function loadLocalSyncCode(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("furniture-sync-code-v1");
}
