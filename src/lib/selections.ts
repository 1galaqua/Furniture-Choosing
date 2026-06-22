import { getAllItemIds, type PersonName } from "@/data/furniture";

export type ItemSelection = {
  selected: boolean;
  assignedTo: PersonName | "";
};

export type SelectionsState = Record<string, ItemSelection>;

export type SyncPayload = {
  selections: SelectionsState;
  updatedAt: number;
};

export const LOCAL_SELECTIONS_KEY = "furniture-selections-v1";
export const LOCAL_SYNC_CODE_KEY = "furniture-sync-code-v1";
export const LOCAL_UPDATED_AT_KEY = "furniture-updated-at-v1";

export function createEmptySelections(): SelectionsState {
  return Object.fromEntries(
    getAllItemIds().map((id) => [id, { selected: false, assignedTo: "" }]),
  );
}

export function mergeSelections(
  base: SelectionsState,
  incoming: SelectionsState,
): SelectionsState {
  return { ...base, ...incoming };
}

export function normalizeSelections(
  incoming: SelectionsState | undefined,
): SelectionsState {
  const base = createEmptySelections();
  if (!incoming) return base;
  return mergeSelections(base, incoming);
}
