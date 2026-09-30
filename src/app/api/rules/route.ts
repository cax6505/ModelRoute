import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/middleware/auth';
import { createApiError, UpdateRoutingRuleSchema } from '@/lib/schemas';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

async function authorize(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get('authorization'));
  if (!auth.authenticated && process.env.NODE_ENV === 'production') return null;
  return auth.userId ?? '00000000-0000-0000-0000-000000000000';
}

export async function GET(request: NextRequest) {
  const userId = await authorize(request);
  if (!userId) return createApiError('UNAUTHORIZED', 'Invalid API key', 401);
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('routing_rules')
      .select('id, user_id, task_type, priority_mode, candidates, is_active, updated_at')
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order('task_type')
      .order('priority_mode');
    if (error) return createApiError('DATABASE_ERROR', 'Failed to load routing rules', 500);
    return Response.json({ rules: data ?? [] });
  } catch {
    return Response.json({ rules: [] });
  }
}

export async function PUT(request: NextRequest) {
  const userId = await authorize(request);
  if (!userId) return createApiError('UNAUTHORIZED', 'Invalid API key', 401);
  const parsed = UpdateRoutingRuleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return createApiError('VALIDATION_ERROR', 'Invalid routing rule', 400, { issues: parsed.error.issues });
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('routing_rules')
      .upsert({ ...parsed.data, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id,task_type,priority_mode' })
      .select('id, user_id, task_type, priority_mode, candidates, is_active, updated_at')
      .single();
    if (error) return createApiError('DATABASE_ERROR', 'Failed to save routing rule', 500);
    return Response.json({ rule: data });
  } catch {
    return createApiError('INTERNAL_ERROR', 'Failed to save routing rule', 500);
  }
}