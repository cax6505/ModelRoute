import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/middleware/auth';
import { createApiError } from '@/lib/schemas';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get('authorization'));
  if (!auth.authenticated && process.env.NODE_ENV === 'production') return createApiError('UNAUTHORIZED', 'Invalid API key', 401);
  const period = new URL(request.url).searchParams.get('period') ?? '7d';
  const days = period === '24h' ? 1 : period === '30d' ? 30 : 7;
  try {
    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    let query = supabase.from('request_logs').select('created_at, provider, latency_ms, estimated_cost_usd, status').gte('created_at', since).limit(10_000);
    if (auth.userId) query = query.eq('user_id', auth.userId);
    const { data, error } = await query;
    if (error) return createApiError('DATABASE_ERROR', 'Failed to load analytics', 500);
    const rows = data ?? [];
    const latencies = rows.map((row) => row.latency_ms).sort((a, b) => a - b);
    const percentile = (value: number) => latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] : null;
    const byProvider = ['groq', 'gemini', 'ollama'].map((provider) => ({ name: provider, requests: rows.filter((row) => row.provider === provider).length, p50: percentileFor(rows.filter((row) => row.provider === provider).map((row) => row.latency_ms), .5), p95: percentileFor(rows.filter((row) => row.provider === provider).map((row) => row.latency_ms), .95) }));
    return Response.json({ requests: rows.length, totalCost: rows.reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0), p50: percentile(.5), p95: percentile(.95), failoverRate: rows.length ? rows.filter((row) => row.status === 'fallback').length / rows.length : 0, byProvider });
  } catch {
    return Response.json({ requests: 0, totalCost: 0, p50: null, p95: null, failoverRate: 0, byProvider: [] });
  }
}

function percentileFor(values: number[], percentile: number) { values.sort((a, b) => a - b); return values.length ? values[Math.min(values.length - 1, Math.floor(values.length * percentile))] : null; }