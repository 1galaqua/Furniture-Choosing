const CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;
const DEFAULT_SHARED_SYNC_CODE = "REHITM";

export function getSharedSyncCode(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SHARED_SYNC_CODE?.trim();
  const candidate = normalizeSyncCode(fromEnv ?? DEFAULT_SHARED_SYNC_CODE);

  if (!isValidSyncCode(candidate)) {
    return DEFAULT_SHARED_SYNC_CODE;
  }

  return candidate;
}

export function generateSyncCode(): string {
  let code = "";

  for (let index = 0; index < CODE_LENGTH; index += 1) {
    const randomIndex = Math.floor(Math.random() * CHARSET.length);
    code += CHARSET[randomIndex];
  }

  return code;
}

export function isValidSyncCode(value: string): boolean {
  if (value.length !== CODE_LENGTH) return false;

  return [...value.toUpperCase()].every((char) => CHARSET.includes(char));
}

export function normalizeSyncCode(value: string): string {
  return value.trim().toUpperCase();
}
