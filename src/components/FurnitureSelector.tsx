"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FURNITURE_SECTIONS,
  PERSON_NAMES,
  getItemById,
  getItemLocation,
  type PersonName,
} from "@/data/furniture";
import {
  createEmptySelections,
  mergeSelections,
  normalizeSelections,
  type ItemSelection,
  type SelectionsState,
} from "@/lib/selections";
import { isValidSyncCode, normalizeSyncCode } from "@/lib/sync-code";
import {
  buildShareUrl,
  copyText,
  createSyncSession,
  fetchSyncSession,
  fetchSyncStatus,
  getCodeFromUrl,
  loadLocalSelections,
  loadLocalSyncCode,
  loadLocalUpdatedAt,
  saveLocalState,
  saveSyncSession,
} from "@/lib/sync-client";

type SyncStatus = "loading" | "syncing" | "synced" | "error";

function applyRemoteState(
  remoteSelections: SelectionsState,
  remoteUpdatedAt: number,
  syncCode: string,
  setSelections: (value: SelectionsState) => void,
  setUpdatedAt: (value: number) => void,
  setSyncCode: (value: string) => void,
) {
  const normalized = normalizeSelections(remoteSelections);
  setSelections(normalized);
  setUpdatedAt(remoteUpdatedAt);
  setSyncCode(syncCode);
  saveLocalState(normalized, remoteUpdatedAt, syncCode);
}

export default function FurnitureSelector() {
  const [selections, setSelections] = useState<SelectionsState>(
    createEmptySelections,
  );
  const [updatedAt, setUpdatedAt] = useState(0);
  const [syncCode, setSyncCode] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [syncMessage, setSyncMessage] = useState("טוען נתונים...");
  const [codeInput, setCodeInput] = useState("");
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState(
    FURNITURE_SECTIONS[0]?.id ?? "",
  );
  const [showSummary, setShowSummary] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [cloudSyncReady, setCloudSyncReady] = useState(true);
  const [cloudSyncRequired, setCloudSyncRequired] = useState(false);

  const selectionsRef = useRef(selections);
  const updatedAtRef = useRef(updatedAt);
  const syncCodeRef = useRef(syncCode);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    selectionsRef.current = selections;
  }, [selections]);

  useEffect(() => {
    updatedAtRef.current = updatedAt;
  }, [updatedAt]);

  useEffect(() => {
    syncCodeRef.current = syncCode;
  }, [syncCode]);

  useEffect(() => {
    void fetchSyncStatus()
      .then((status) => {
        setCloudSyncReady(status.configured);
        setCloudSyncRequired(status.required);
      })
      .catch(() => {
        setCloudSyncReady(false);
      });
  }, []);

  const pushToServer = useCallback(async (code: string, nextUpdatedAt: number) => {
    setSyncStatus("syncing");
    setSyncMessage("שומר בענן...");

    try {
      const result = await saveSyncSession(code, {
        selections: selectionsRef.current,
        updatedAt: nextUpdatedAt,
      });

      if (result === "conflict") {
        const remote = await fetchSyncSession(code);
        applyRemoteState(
          remote.selections,
          remote.updatedAt,
          code,
          setSelections,
          setUpdatedAt,
          setSyncCode,
        );
        setSyncStatus("synced");
        setSyncMessage("עודכן מהענן");
        return;
      }

      setUpdatedAt(result.updatedAt);
      updatedAtRef.current = result.updatedAt;
      saveLocalState(selectionsRef.current, result.updatedAt, code);
      setSyncStatus("synced");
      setSyncMessage("מסונכרן בין מכשירים");
    } catch {
      setSyncStatus("error");
      setSyncMessage("שגיאה בשמירה בענן");
    }
  }, []);

  const pullFromServer = useCallback(async (code: string, preferRemote = false) => {
    try {
      const remote = await fetchSyncSession(code);
      const localSelections = loadLocalSelections();
      const localUpdatedAt = loadLocalUpdatedAt();

      if (
        preferRemote ||
        remote.updatedAt >= localUpdatedAt ||
        !localSelections
      ) {
        applyRemoteState(
          remote.selections,
          remote.updatedAt,
          code,
          setSelections,
          setUpdatedAt,
          setSyncCode,
        );
        return remote.updatedAt;
      }

      const merged = mergeSelections(
        createEmptySelections(),
        localSelections,
      );
      setSelections(merged);
      setUpdatedAt(localUpdatedAt);
      setSyncCode(code);
      saveLocalState(merged, localUpdatedAt, code);
      await pushToServer(code, localUpdatedAt);
      return localUpdatedAt;
    } catch (error) {
      if (error instanceof Error && error.message === "not_found") {
        throw error;
      }
      throw error;
    }
  }, [pushToServer]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const urlCode = getCodeFromUrl();
        const storedCode = loadLocalSyncCode();
        let code = normalizeSyncCode(urlCode ?? storedCode ?? "");

        if (!isValidSyncCode(code)) {
          const session = await createSyncSession();
          code = session.code;
        }

        const localSelections = loadLocalSelections();
        const localUpdatedAt = loadLocalUpdatedAt();

        if (urlCode && isValidSyncCode(normalizeSyncCode(urlCode))) {
          await pullFromServer(code, true);
        } else if (localSelections) {
          let remote;

          try {
            remote = await fetchSyncSession(code);
          } catch (error) {
            if (error instanceof Error && error.message === "not_found") {
              const merged = mergeSelections(
                createEmptySelections(),
                localSelections,
              );
              const nextUpdatedAt = localUpdatedAt || Date.now();
              await saveSyncSession(code, {
                selections: merged,
                updatedAt: nextUpdatedAt,
              });
              remote = await fetchSyncSession(code);
            } else {
              throw error;
            }
          }

          if (remote.updatedAt >= localUpdatedAt) {
            applyRemoteState(
              remote.selections,
              remote.updatedAt,
              code,
              setSelections,
              setUpdatedAt,
              setSyncCode,
            );
          } else {
            const merged = mergeSelections(
              createEmptySelections(),
              localSelections,
            );
            setSelections(merged);
            setUpdatedAt(localUpdatedAt);
            setSyncCode(code);
            saveLocalState(merged, localUpdatedAt, code);
            await pushToServer(code, localUpdatedAt);
          }
        } else {
          await pullFromServer(code, true);
        }

        if (!cancelled) {
          setCodeInput(code);
          setHydrated(true);
          setSyncStatus("synced");
          setSyncMessage("מסונכרן בין מכשירים");
        }
      } catch {
        if (!cancelled) {
          setHydrated(true);
          setSyncStatus("error");
          setSyncMessage("לא ניתן לטעון סנכרון");
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [pullFromServer, pushToServer]);

  useEffect(() => {
    if (!hydrated || !syncCode) return;

    saveLocalState(selections, updatedAtRef.current, syncCode);

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      const nextUpdatedAt = Date.now();
      updatedAtRef.current = nextUpdatedAt;
      setUpdatedAt(nextUpdatedAt);
      void pushToServer(syncCode, nextUpdatedAt);
    }, 900);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [selections, hydrated, syncCode, pushToServer]);

  useEffect(() => {
    if (!hydrated || !syncCode) return;

    function refreshFromServer() {
      if (document.visibilityState !== "visible") return;
      void pullFromServer(syncCodeRef.current, false).then(() => {
        setSyncStatus("synced");
        setSyncMessage("מסונכרן בין מכשירים");
      }).catch(() => {
        setSyncStatus("error");
        setSyncMessage("שגיאה בטעינה מהענן");
      });
    }

    document.addEventListener("visibilitychange", refreshFromServer);
    return () => {
      document.removeEventListener("visibilitychange", refreshFromServer);
    };
  }, [hydrated, syncCode, pullFromServer]);

  const selectedCount = useMemo(
    () => Object.values(selections).filter((entry) => entry.selected).length,
    [selections],
  );

  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return FURNITURE_SECTIONS;

    return FURNITURE_SECTIONS.map((section) => ({
      ...section,
      categories: section.categories
        .map((category) => ({
          ...category,
          items: category.items.filter(
            (item) =>
              item.name.toLowerCase().includes(query) ||
              category.title.toLowerCase().includes(query) ||
              section.title.toLowerCase().includes(query),
          ),
        }))
        .filter((category) => category.items.length > 0),
    })).filter((section) => section.categories.length > 0);
  }, [search]);

  const summaryByPerson = useMemo(() => {
    const grouped: Record<string, { id: string; name: string; location: string }[]> =
      {};

    for (const person of PERSON_NAMES) {
      grouped[person] = [];
    }
    grouped["ללא שיוך"] = [];

    for (const [id, entry] of Object.entries(selections)) {
      if (!entry.selected) continue;

      const item = getItemById(id);
      const location = getItemLocation(id);
      if (!item || !location) continue;

      const key = entry.assignedTo || "ללא שיוך";
      grouped[key].push({
        id,
        name: item.name,
        location: `${location.section} · ${location.category}`,
      });
    }

    return grouped;
  }, [selections]);

  function updateItem(id: string, patch: Partial<ItemSelection>) {
    setSelections((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  function toggleCategory(categoryItemIds: string[], selected: boolean) {
    setSelections((current) => {
      const next = { ...current };
      for (const id of categoryItemIds) {
        next[id] = { ...next[id], selected };
      }
      return next;
    });
  }

  function clearAll() {
    if (!confirm("למחוק את כל הבחירות?")) return;
    setSelections(createEmptySelections());
  }

  async function handleLoadCode() {
    const code = normalizeSyncCode(codeInput);
    if (!isValidSyncCode(code)) {
      setSyncStatus("error");
      setSyncMessage("קוד הסנכרון חייב להיות 6 תווים");
      return;
    }

    setSyncStatus("syncing");
    setSyncMessage("טוען קוד...");

    try {
      await pullFromServer(code, true);
      setSyncStatus("synced");
      setSyncMessage("נטען בהצלחה");
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(
        error instanceof Error && error.message === "not_found"
          ? "קוד הסנכרון לא נמצא"
          : "שגיאה בטעינת הקוד",
      );
    }
  }

  async function handleCreateNewCode() {
    if (!confirm("ליצור קוד סנכרון חדש? הקוד הנוכחי יישאר, אבל המכשיר יעבור לרשימה חדשה.")) {
      return;
    }

    setSyncStatus("syncing");
    setSyncMessage("יוצר קוד חדש...");

    try {
      const session = await createSyncSession();
      applyRemoteState(
        session.selections,
        session.updatedAt,
        session.code,
        setSelections,
        setUpdatedAt,
        setSyncCode,
      );
      setCodeInput(session.code);
      setSyncStatus("synced");
      setSyncMessage("נוצר קוד סנכרון חדש");
    } catch {
      setSyncStatus("error");
      setSyncMessage("לא ניתן ליצור קוד חדש");
    }
  }

  async function handleCopyCode() {
    if (!syncCode) return;
    const copied = await copyText(syncCode);
    setCopyFeedback(copied ? "הקוד הועתק" : "לא ניתן להעתיק");
    window.setTimeout(() => setCopyFeedback(""), 2000);
  }

  async function handleCopyLink() {
    if (!syncCode) return;
    const copied = await copyText(buildShareUrl(syncCode));
    setCopyFeedback(copied ? "הקישור הועתק" : "לא ניתן להעתיק");
    window.setTimeout(() => setCopyFeedback(""), 2000);
  }

  const visibleSection =
    filteredSections.find((section) => section.id === activeSection) ??
    filteredSections[0];

  const syncStatusClass =
    syncStatus === "synced"
      ? "bg-emerald-100 text-emerald-800"
      : syncStatus === "syncing"
        ? "bg-amber-100 text-amber-800"
        : syncStatus === "loading"
          ? "bg-stone-100 text-stone-700"
          : "bg-red-100 text-red-800";

  return (
    <div className="min-h-full bg-stone-100 text-stone-900">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-amber-700">בחירת רהיטים</p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                רשימת רהיטים וציוד
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                סמנו פריטים ובחרו שם: {PERSON_NAMES.join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
                {selectedCount} נבחרו
              </span>
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${syncStatusClass}`}>
                {syncMessage}
              </span>
              <button
                type="button"
                onClick={() => setShowSummary((value) => !value)}
                className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-stone-50 lg:hidden"
              >
                {showSummary ? "הסתר סיכום" : "הצג סיכום"}
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
              >
                נקה הכל
              </button>
            </div>
          </div>

          <section className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            {!cloudSyncReady && cloudSyncRequired && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">סנכרון ענן עדיין לא מוגדר ב-Vercel</p>
                <p className="mt-1">
                  הבחירות נשמרות רק במכשיר הנוכחי. כדי שיעבדו בין מכשירים, חברו
                  Upstash Redis בלוח הבקרה של Vercel ופרסו מחדש.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-stone-800">
                  סנכרון בין מכשירים
                </h2>
                <p className="text-sm text-stone-600">
                  השתמשו באותו קוד סנכרון בכל המכשירים, או שלחו קישור.
                </p>
                {syncCode && (
                  <p className="font-mono text-lg font-bold tracking-[0.2em] text-stone-900">
                    {syncCode}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  disabled={!syncCode}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-stone-100 disabled:opacity-50"
                >
                  העתק קוד
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={!syncCode}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-stone-100 disabled:opacity-50"
                >
                  העתק קישור
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewCode}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-stone-100"
                >
                  קוד חדש
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={codeInput}
                onChange={(event) =>
                  setCodeInput(event.target.value.toUpperCase())
                }
                placeholder="הזינו קוד סנכרון (6 תווים)"
                maxLength={6}
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 font-mono text-base tracking-widest outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200 sm:max-w-xs"
              />
              <button
                type="button"
                onClick={handleLoadCode}
                className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700"
              >
                טען קוד
              </button>
            </div>

            {copyFeedback && (
              <p className="mt-2 text-sm font-medium text-emerald-700">
                {copyFeedback}
              </p>
            )}
          </section>

          <label className="relative block">
            <span className="sr-only">חיפוש פריט</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="חיפוש לפי שם פריט, חדר או קטגוריה..."
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
            />
          </label>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {filteredSections.map((section) => {
              const count = section.categories.reduce(
                (total, category) =>
                  total +
                  category.items.filter((item) => selections[item.id]?.selected)
                    .length,
                0,
              );

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                    visibleSection?.id === section.id
                      ? "bg-stone-900 text-white"
                      : "bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
                  }`}
                >
                  {section.title}
                  {count > 0 ? ` (${count})` : ""}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-5">
          {!visibleSection && (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-600">
              לא נמצאו פריטים התואמים לחיפוש.
            </div>
          )}

          {visibleSection?.categories.map((category) => {
            const categoryIds = category.items.map((item) => item.id);
            const selectedInCategory = categoryIds.filter(
              (id) => selections[id]?.selected,
            ).length;

            return (
              <section
                key={category.id}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
              >
                <div className="flex flex-col gap-3 border-b border-stone-100 bg-stone-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <h2 className="text-lg font-semibold">{category.title}</h2>
                    <p className="text-sm text-stone-500">
                      {selectedInCategory} מתוך {category.items.length} נבחרו
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCategory(categoryIds, true)}
                      className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-stone-700"
                    >
                      בחר הכל
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCategory(categoryIds, false)}
                      className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium transition hover:bg-stone-50"
                    >
                      נקה
                    </button>
                  </div>
                </div>

                <ul className="divide-y divide-stone-100">
                  {category.items.map((item) => {
                    const entry = selections[item.id] ?? {
                      selected: false,
                      assignedTo: "",
                    };

                    return (
                      <li
                        key={item.id}
                        className={`flex flex-col gap-3 px-4 py-4 transition sm:flex-row sm:items-center sm:justify-between sm:px-5 ${
                          entry.selected ? "bg-amber-50/70" : "bg-white"
                        }`}
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={entry.selected}
                            onChange={(event) =>
                              updateItem(item.id, {
                                selected: event.target.checked,
                              })
                            }
                            className="mt-1 h-5 w-5 shrink-0 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-base leading-6">{item.name}</span>
                        </label>

                        <div className="flex shrink-0 items-center gap-2 sm:min-w-[220px]">
                          <label htmlFor={`person-${item.id}`} className="sr-only">
                            שיוך {item.name}
                          </label>
                          <select
                            id={`person-${item.id}`}
                            value={entry.assignedTo}
                            disabled={!entry.selected}
                            onChange={(event) =>
                              updateItem(item.id, {
                                assignedTo: event.target.value as PersonName | "",
                              })
                            }
                            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                          >
                            <option value="">בחר שם</option>
                            {PERSON_NAMES.map((person) => (
                              <option key={person} value={person}>
                                {person}
                              </option>
                            ))}
                          </select>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </main>

        <aside
          className={`space-y-4 lg:sticky lg:top-36 lg:self-start ${
            showSummary ? "block" : "hidden lg:block"
          }`}
        >
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">סיכום בחירות</h2>
            <p className="mt-1 text-sm text-stone-500">
              {selectedCount} פריטים נבחרו · נשמר מקומית ובענן
            </p>
          </div>

          {[...PERSON_NAMES, "ללא שיוך" as const].map((person) => {
            const items = summaryByPerson[person] ?? [];
            if (items.length === 0) return null;

            return (
              <div
                key={person}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{person}</h3>
                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                    {items.length}
                  </span>
                </div>
                <ul className="space-y-3">
                  {items.map((item) => (
                    <li key={item.id} className="text-sm">
                      <p className="font-medium leading-5">{item.name}</p>
                      <p className="mt-0.5 text-stone-500">{item.location}</p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {selectedCount === 0 && (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-500">
              עדיין לא נבחרו פריטים. סמנו פריטים מהרשימה ושייכו אותם לשם.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
