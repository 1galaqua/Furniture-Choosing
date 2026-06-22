import { NextResponse } from "next/server";
import type { SyncPayload } from "@/lib/selections";
import { normalizeSelections } from "@/lib/selections";
import { isValidSyncCode, normalizeSyncCode } from "@/lib/sync-code";
import { readSyncPayload, writeSyncPayload } from "@/lib/sync-storage";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { code } = await context.params;
  const normalizedCode = normalizeSyncCode(code);

  if (!isValidSyncCode(normalizedCode)) {
    return NextResponse.json({ error: "קוד סנכרון לא תקין" }, { status: 400 });
  }

  const payload = await readSyncPayload(normalizedCode);
  if (!payload) {
    return NextResponse.json({ error: "קוד סנכרון לא נמצא" }, { status: 404 });
  }

  return NextResponse.json({
    code: normalizedCode,
    selections: normalizeSelections(payload.selections),
    updatedAt: payload.updatedAt,
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const { code } = await context.params;
  const normalizedCode = normalizeSyncCode(code);

  if (!isValidSyncCode(normalizedCode)) {
    return NextResponse.json({ error: "קוד סנכרון לא תקין" }, { status: 400 });
  }

  let body: SyncPayload;
  try {
    body = (await request.json()) as SyncPayload;
  } catch {
    return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
  }

  if (typeof body.updatedAt !== "number" || !body.selections) {
    return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
  }

  const payload: SyncPayload = {
    selections: normalizeSelections(body.selections),
    updatedAt: body.updatedAt,
  };

  try {
    const result = await writeSyncPayload(normalizedCode, payload);

  if (result === "invalid") {
    return NextResponse.json({ error: "קוד סנכרון לא תקין" }, { status: 400 });
  }

  if (result === "conflict") {
    const existing = await readSyncPayload(normalizedCode);
    return NextResponse.json(
      {
        error: "conflict",
        code: normalizedCode,
        selections: normalizeSelections(existing?.selections),
        updatedAt: existing?.updatedAt ?? 0,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    code: normalizedCode,
    selections: payload.selections,
    updatedAt: payload.updatedAt,
  });
  } catch (error) {
    if (error instanceof Error && error.message === "cloud_sync_not_configured") {
      return NextResponse.json(
        {
          error: "cloud_sync_not_configured",
          message:
            "יש לחבר Upstash Redis ב-Vercel (משתני UPSTASH_REDIS_REST_URL ו-UPSTASH_REDIS_REST_TOKEN)",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
  }
}
