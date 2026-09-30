import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/middleware/auth';
import { createApiError } from '@/lib/schemas';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get('authorization'));
  if (!auth.authenticated && process.env.NODE_ENV === 'production') {
    return createApiError('UNAUTHORIZED', 'Invalid API key', 401);
  }
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('request_logs')
      .select('id, created_at, task_type, provider, model, latency_ms, input_tokens, output_tokens, estimated_cost_usd, status, routing_reason, priority, correlation_id')
      .order('created_at', { ascending: false })
      .limit(100);
    if (auth.userId) query = query.eq('user_id', auth.userId);
    const { data, error } = await query;
    if (error) return createApiError('DATABASE_ERROR', 'Failed to load request history', 500);
    return Response.json({ logs: data ?? [] });
  } catch {
    return Response.json({ logs: [] });
  }
}