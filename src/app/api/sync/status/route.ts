import { NextResponse } from "next/server";
import {
  isCloudSyncConfigured,
  isCloudSyncRequired,
} from "@/lib/sync-storage";

export async function GET() {
  const configured = isCloudSyncConfigured();

  return NextResponse.json({
    configured,
    required: isCloudSyncRequired(),
    message: configured
      ? "cloud_sync_ready"
      : isCloudSyncRequired()
        ? "cloud_sync_missing"
        : "cloud_sync_optional",
  });
}
