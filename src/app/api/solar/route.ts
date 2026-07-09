import { NextResponse } from "next/server";
import type { SolarState } from "@/lib/types";
import { fetchSolarState } from "@/lib/sources/swpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60 * 1000;
let cache: SolarState | null = null;

export async function GET() {
  if (cache && Date.now() - cache.updatedAt < TTL_MS) {
    return NextResponse.json(cache);
  }
  try {
    cache = await fetchSolarState();
  } catch (err) {
    console.warn("[astralis] solar fetch failed:", err);
    if (!cache) {
      // serene default until the Sun answers
      cache = { kp: 2, xray: 1e-7, mood: 0.3, updatedAt: Date.now() };
    } else {
      cache = { ...cache, updatedAt: Date.now() };
    }
  }
  return NextResponse.json(cache);
}
