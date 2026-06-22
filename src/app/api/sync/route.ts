import { NextResponse } from "next/server";
import { createSyncSession } from "@/lib/sync-storage";

function mapSyncError(error: unknown): NextResponse {
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

  return NextResponse.json(
    { error: "לא ניתן ליצור קוד סנכרון חדש" },
    { status: 500 },
  );
}

export async function POST() {
  try {
    const session = await createSyncSession();
    return NextResponse.json(session);
  } catch (error) {
    return mapSyncError(error);
  }
}
