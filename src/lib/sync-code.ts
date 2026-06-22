const CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

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
