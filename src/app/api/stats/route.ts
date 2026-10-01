import { NextRequest } from "next/server";
import { validateRequestAuth } from "@/lib/middleware/auth";
import { createApiError } from "@/lib/schemas";
import { getSupabaseAdmin } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await validateRequestAuth(request);
  if (!auth.authenticated && process.env.NODE_ENV === "production")
    return createApiError("UNAUTHORIZED", "Invalid API key", 401);
  const period = new URL(request.url).searchParams.get("period") ?? "7d";
  const days = period === "24h" ? 1 : period === "30d" ? 30 : 7;
  try {
    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    let query = supabase
      .from("request_logs")
      .select("created_at, provider, latency_ms, estimated_cost_usd, status")
      .gte("created_at", since)
      .limit(10_000);
    if (auth.userId) query = query.eq("user_id", auth.userId);
    const { data, error } = await query;
    if (error)
      return createApiError("DATABASE_ERROR", "Failed to load analytics", 500);
    const rows = data ?? [];
    const latencies = rows.map((row) => row.latency_ms).sort((a, b) => a - b);
    const percentile = (value: number) =>
      latencies.length
        ? latencies[
            Math.min(latencies.length - 1, Math.floor(latencies.length * value))
          ]
        : null;
    const byProvider = ["groq", "gemini", "openrouter"].map((provider) => ({
      name: provider,
      requests: rows.filter((row) => row.provider === provider).length,
      p50: percentileFor(
        rows
          .filter((row) => row.provider === provider)
          .map((row) => row.latency_ms),
        0.5,
      ),
      p95: percentileFor(
        rows
          .filter((row) => row.provider === provider)
          .map((row) => row.latency_ms),
        0.95,
      ),
    }));
    return Response.json({
      requests: rows.length,
      totalCost: rows.reduce(
        (sum, row) => sum + Number(row.estimated_cost_usd ?? 0),
        0,
      ),
      p50: percentile(0.5),
      p95: percentile(0.95),
      failoverRate: rows.length
        ? rows.filter((row) => row.status === "fallback").length / rows.length
        : 0,
      byProvider,
    });
  } catch {
    return createApiError("DATABASE_ERROR", "Analytics are unavailable", 503);
  }
}

function percentileFor(values: number[], percentile: number) {
  values.sort((a, b) => a - b);
  return values.length
    ? values[
        Math.min(values.length - 1, Math.floor(values.length * percentile))
      ]
    : null;
}
